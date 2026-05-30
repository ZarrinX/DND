/*
 * OLED Diagnostic Sketch — full-RAM version
 * Mirrors the exact global layout of sketch.ino so RAM pressure is identical.
 * Open Serial Monitor at 115200 baud.
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>

#define OLED_WIDTH     128
#define OLED_HEIGHT     64
#define OLED_RESET      -1
#define OLED_ADDR     0x3C
#define NEOPIXEL_PIN    6
#define NEOPIXEL_COUNT  7
#define SERIAL_BUF_LEN 192

// Same globals as sketch.ino so RAM pressure is identical
static char     gLines[6][22];
static char     gSerialBuf[SERIAL_BUF_LEN];
static uint16_t gSerialIdx = 0;

Adafruit_SSD1306  oled(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RESET);
Adafruit_NeoPixel pixels(NEOPIXEL_COUNT, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);

// Returns approximate free heap+stack space
static int freeRam() {
  extern int __heap_start, *__brkval;
  int v;
  return (int)&v - (__brkval == 0 ? (int)&__heap_start : (int)__brkval);
}

void setup() {
  Serial.begin(115200);
  while (!Serial);
  delay(500);

  Serial.println(F("--- full-RAM OLED diag ---"));
  Serial.print(F("Free RAM at start: ")); Serial.println(freeRam());

  Wire.begin();
  Wire.setClock(100000UL);
  Serial.println(F("Wire ok"));

  bool ok = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  Wire.setClock(100000UL);
  Serial.print(F("begin() returned: "));
  Serial.println(ok ? F("true") : F("false"));
  Serial.print(F("Free RAM after begin: ")); Serial.println(freeRam());

  Serial.println(F("calling clearDisplay..."));
  oled.clearDisplay();
  Serial.println(F("clearDisplay ok"));

  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0, 0);
  oled.print(F("Hello!"));
  Serial.println(F("text buffered"));

  Serial.println(F("calling display() — may hang here..."));
  oled.display();
  Serial.println(F("display() ok"));

  Serial.println(F("init NeoPixel..."));
  pixels.begin();
  pixels.setBrightness(255);
  pixels.fill(pixels.Color(0, 80, 0));
  pixels.show();
  Serial.println(F("pixels ok — should be green"));
}

void loop() {}
