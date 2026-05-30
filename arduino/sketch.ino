/*
 * DND Companion — Arduino Firmware
 *
 * Board:   Arduino Nano ESP32 (ESP32-S3, 3.3V)
 * Display: SSD1306 128×64 OLED — I2C, address 0x3C
 * LEDs:    7-pixel NeoPixel ring — pixel 0 = center, pixels 1–6 = ring
 *
 * Required libraries (install via Arduino Library Manager):
 *   - Adafruit SSD1306   (install Adafruit GFX Library when prompted)
 *   - Adafruit NeoPixel
 *   - ArduinoJson        v6.x  (NOT v5 or v7)
 *
 * Baud rate: 115200
 *
 * JSON protocol — newline-terminated packets from the Electron app:
 *
 *   { "event": "manual",
 *     "leds": { "color": "#ff0000", "animation": "pulse", "brightness": 75,
 *               "center": { "color": "#00ff00", "animation": "solid",
 *                           "brightness": 50, "invertPhase": false } } }
 *
 *   { "event": "macro",
 *     "display": { "line1": "HP: 18/24", "line2": "Fighter Lv5", ... },
 *     "leds":    { ... same as manual ... } }
 *
 *   { "event": "display",
 *     "display": { "line1": "...", ..., "line6": "..." } }
 *
 *   { "event": "function", "name": "my_function" }
 *
 * Display auto-scale:
 *   ≤3 lines of content → textSize 2 (larger, matches Electron 2x preview)
 *   4–6 lines of content → textSize 1
 *
 * NOTE: arduino/AGENTS.md protocol table is outdated. The authoritative
 * protocol definition is electron/src/shared/types.ts.
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>
#include <WiFi.h>          // needed to shut the radio down
#include "esp_wifi.h"      // esp_wifi_stop / deinit
#include "esp_bt.h"        // esp_bt_controller_disable

// ─── Hardware config ──────────────────────────────────────────────────────────
#define NEOPIXEL_PIN     9        // physical D6 on Nano ESP32
#define NEOPIXEL_COUNT   7        // index 0 = center, 1–6 = ring

#define OLED_WIDTH     128
#define OLED_HEIGHT     64
#define OLED_RESET      -1        // no dedicated reset pin
#define OLED_I2C_ADDR 0x3C

// ─── Serial config ────────────────────────────────────────────────────────────
#define SERIAL_BAUD      115200
#define SERIAL_BUF_LEN   384     // max incoming JSON line length (bytes)

// ─── Animation IDs ────────────────────────────────────────────────────────────
#define ANIM_SOLID  0
#define ANIM_PULSE  1
#define ANIM_FLASH  2

#define PULSE_PERIOD_MS  1500UL
#define FLASH_PERIOD_MS   600UL

// ─── M_PI guard (not always defined on AVR toolchain) ─────────────────────────
#ifndef M_PI
#define M_PI 3.14159265f
#endif

// ─── LED group state ──────────────────────────────────────────────────────────
struct LedGroup {
  uint8_t r, g, b;
  uint8_t brightness;   // 1–100
  uint8_t animation;    // ANIM_*
  bool    invertPhase;  // reverse pulse/flash timing vs ring
};

// ─── Global state ─────────────────────────────────────────────────────────────
static LedGroup gRing   = { 0, 0, 0, 50, ANIM_SOLID, false };
static LedGroup gCenter = { 0, 0, 0, 50, ANIM_SOLID, false };
static char     gLines[6][22];           // 6 display rows, 21 chars + NUL
static uint8_t  gScale        = 1;       // 1 or 2 — set by incoming payload
static uint8_t  gDisplayAnim  = ANIM_SOLID;
static char     gSerialBuf[SERIAL_BUF_LEN];
static uint16_t gSerialIdx = 0;

// ─── Peripherals ──────────────────────────────────────────────────────────────
Adafruit_SSD1306  oled(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RESET);
Adafruit_NeoPixel pixels(NEOPIXEL_COUNT, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);


// ═════════════════════════════════════════════════════════════════════════════
//  Helpers
// ═════════════════════════════════════════════════════════════════════════════

static uint8_t hexNib(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  return 0;
}

// Parse "#rrggbb" into r, g, b. Returns false if the string is malformed.
static bool parseHexColor(const char* hex, uint8_t& r, uint8_t& g, uint8_t& b) {
  if (!hex || hex[0] != '#' || strlen(hex) < 7) return false;
  r = (hexNib(hex[1]) << 4) | hexNib(hex[2]);
  g = (hexNib(hex[3]) << 4) | hexNib(hex[4]);
  b = (hexNib(hex[5]) << 4) | hexNib(hex[6]);
  return true;
}

static uint8_t parseAnimation(const char* s) {
  if (!s) return ANIM_SOLID;
  if (strcmp(s, "pulse") == 0) return ANIM_PULSE;
  if (strcmp(s, "flash") == 0) return ANIM_FLASH;
  return ANIM_SOLID;
}

// Send a contrast value (0–255) to the SSD1306 via raw I2C.
// Caches the last-sent value — skips the I2C transaction if nothing changed.
static uint8_t gLastContrast = 255;  // matches SSD1306 power-on default
static void setOledContrast(uint8_t val) {
  if (val == gLastContrast) return;
  gLastContrast = val;
  Wire.beginTransmission(OLED_I2C_ADDR);
  Wire.write(0x00);  // command stream
  Wire.write(0x81);  // SSD1306_SETCONTRAST
  Wire.write(val);
  Wire.endTransmission();
}

// Returns a brightness multiplier 0.0–1.0 for the current time.
// ANIM_SOLID always returns 1.0 (invertPhase has no effect on solid).
static float animFactor(uint8_t animation, bool invert) {
  unsigned long t = millis();
  float f;
  switch (animation) {
    case ANIM_PULSE: {
      float phase = (float)(t % PULSE_PERIOD_MS) / (float)PULSE_PERIOD_MS;
      f = (1.0f + cosf(phase * 2.0f * (float)M_PI)) * 0.5f;  // 1 → 0 → 1
      break;
    }
    case ANIM_FLASH:
      f = ((t % FLASH_PERIOD_MS) < (FLASH_PERIOD_MS / 2)) ? 1.0f : 0.0f;
      break;
    default:
      return 1.0f;
  }
  return invert ? 1.0f - f : f;
}

// Build the 32-bit NeoPixel color for a LedGroup at the current animation frame.
static uint32_t groupColor(const LedGroup& grp) {
  float scale = animFactor(grp.animation, grp.invertPhase)
                * (float)grp.brightness / 100.0f;
  return pixels.Color(
    (uint8_t)(grp.r * scale),
    (uint8_t)(grp.g * scale),
    (uint8_t)(grp.b * scale)
  );
}


// ═════════════════════════════════════════════════════════════════════════════
//  Display renderer
// ═════════════════════════════════════════════════════════════════════════════

static void renderDisplay() {
  oled.clearDisplay();

  uint8_t textSize = gScale;
  uint8_t lineH    = (gScale == 2) ? 18 : 10;  // 2x: 16px+2gap, 1x: 8px+2gap

  oled.setTextSize(textSize);
  oled.setTextColor(SSD1306_WHITE);

  for (uint8_t i = 0; i < 6; i++) {
    if (gLines[i][0] == '\0') continue;
    oled.setCursor(0, i * lineH);
    oled.print(gLines[i]);
  }

  oled.display();
}


// ═════════════════════════════════════════════════════════════════════════════
//  JSON payload handlers
// ═════════════════════════════════════════════════════════════════════════════

static void applyDisplay(JsonObject disp) {
  // Replace all lines on every display update so stale lines don't linger.
  memset(gLines, 0, sizeof(gLines));

  const char* keys[6] = { "line1", "line2", "line3", "line4", "line5", "line6" };
  for (uint8_t i = 0; i < 6; i++) {
    if (disp.containsKey(keys[i])) {
      const char* v = disp[keys[i]] | "";
      strncpy(gLines[i], v, 21);
      gLines[i][21] = '\0';
    }
  }

  renderDisplay();
}

static void applyLeds(JsonObject leds) {
  parseHexColor(leds["color"] | "#000000", gRing.r, gRing.g, gRing.b);
  gRing.animation  = parseAnimation(leds["animation"]);
  gRing.brightness = (uint8_t)constrain((int)(leds["brightness"] | 50), 1, 100);

  JsonObject ctr = leds["center"];
  if (!ctr.isNull()) {
    parseHexColor(ctr["color"] | "#000000", gCenter.r, gCenter.g, gCenter.b);
    gCenter.animation   = parseAnimation(ctr["animation"]);
    gCenter.brightness  = (uint8_t)constrain((int)(ctr["brightness"] | 50), 1, 100);
    gCenter.invertPhase = ctr["invertPhase"] | false;
  }
}

// ── Named function dispatcher ─────────────────────────────────────────────────
// Add your own handlers here as `strcmp(name, "my_fn") == 0` blocks.
static void dispatchFunction(const char* name) {
  // Example:
  //   if (strcmp(name, "initiative") == 0) { playInitiativeEffect(); return; }
  //   if (strcmp(name, "short_rest")  == 0) { playRestEffect();       return; }
  (void)name;
}

// ── Serial line processor ─────────────────────────────────────────────────────
static void processLine(char* buf) {
  StaticJsonDocument<1024> doc;
  if (deserializeJson(doc, buf) != DeserializationError::Ok) return;

  const char* event = doc["event"] | "";
  if (event[0] == '\0') return;

  if (strcmp(event, "function") == 0) {
    const char* name = doc["name"] | "";
    if (name[0] != '\0') dispatchFunction(name);
    return;
  }

  if (doc.containsKey("display")) {
    gScale       = (uint8_t)constrain((int)(doc["scale"] | 1), 1, 2);
    gDisplayAnim = parseAnimation(doc["displayAnimation"] | "solid");
    applyDisplay(doc["display"].as<JsonObject>());
  }
  if (doc.containsKey("leds"))    applyLeds(doc["leds"].as<JsonObject>());
}


// ═════════════════════════════════════════════════════════════════════════════
//  Setup
// ═════════════════════════════════════════════════════════════════════════════

void setup() {
  // ── Kill radios ───────────────────────────────────────────────────────────
  // The ESP32-S3 radio stack runs background RTOS tasks even when WiFi/BT are
  // never called. These cause periodic ~5 s preemptions on the main loop.
  WiFi.mode(WIFI_OFF);
  esp_wifi_stop();
  esp_wifi_deinit();
  btStop();
  esp_bt_controller_disable();

  Serial.begin(SERIAL_BAUD);
  memset(gLines, 0, sizeof(gLines));

  // ── OLED ─────────────────────────────────────────────────────────────────
  Wire.begin();
  oled.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR);

  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0, 0);  oled.print(F("DND Companion"));
  oled.setCursor(0, 12); oled.print(F("Waiting..."));
  oled.display();

  // ── NeoPixel ─────────────────────────────────────────────────────────────
  pixels.begin();
  pixels.setBrightness(255);
  pixels.clear();
  pixels.show();

  // ── Startup self-test (5 seconds) ────────────────────────────────────────
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0, 0);
  oled.print(F("All good in the hood"));
  oled.display();

  unsigned long startMs = millis();
  while (millis() - startMs < 3000UL) {
    float t     = (float)(millis() - startMs) / 3000.0f;  // 0.0 → 1.0
    float fade  = (1.0f - cosf(t * 2.0f * (float)M_PI)) * 0.5f;  // 0 → 1 → 0
    uint8_t val = (uint8_t)(fade * 255.0f);
    for (uint8_t i = 0; i < NEOPIXEL_COUNT; i++)
      pixels.setPixelColor(i, pixels.Color(0, val, 0));
    pixels.show();
    delay(16);
  }

  pixels.clear();
  pixels.show();
  oled.clearDisplay();
  oled.display();
}


// ═════════════════════════════════════════════════════════════════════════════
//  Loop
// ═════════════════════════════════════════════════════════════════════════════

void loop() {
  // ── Read serial ───────────────────────────────────────────────────────────
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      gSerialBuf[gSerialIdx] = '\0';
      if (gSerialIdx > 0) processLine(gSerialBuf);
      gSerialIdx = 0;
    } else if (c != '\r') {
      if (gSerialIdx < SERIAL_BUF_LEN - 1) {
        gSerialBuf[gSerialIdx++] = c;
      } else {
        gSerialIdx = 0;  // line overflow — discard and resync
      }
    }
  }

  // ── Update OLED contrast (display animation) ─────────────────────────────
  setOledContrast((uint8_t)(animFactor(gDisplayAnim, false) * 255.0f));

  // ── Update LEDs ───────────────────────────────────────────────────────────
  pixels.setPixelColor(0, groupColor(gCenter));          // pixel 0 = center

  uint32_t ringCol = groupColor(gRing);
  for (uint8_t i = 1; i < NEOPIXEL_COUNT; i++) {         // pixels 1–6 = ring
    pixels.setPixelColor(i, ringCol);
  }
  pixels.show();

  delay(16);  // ~60 fps LED refresh rate
}
