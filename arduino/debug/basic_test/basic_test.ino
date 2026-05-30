/*
 * basic_test.ino — absolute minimal hardware test
 *
 * Board:   Arduino Nano ESP32
 * Tests:   OLED (SSD1306, I2C 0x3C) + NeoPixel ring (pin 6, 7 pixels)
 *
 * Expected behaviour:
 *   1. OLED shows "OLED OK" immediately on boot
 *   2. All 7 pixels cycle: RED (1s) → GREEN (1s) → BLUE (1s) → repeat
 *   3. Serial prints each step at 115200 baud
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_NeoPixel.h>

#define NEOPIXEL_PIN    6
#define NEOPIXEL_COUNT  7
#define OLED_I2C_ADDR   0x3C

Adafruit_SSD1306  oled(128, 64, &Wire, -1);
Adafruit_NeoPixel pixels(NEOPIXEL_COUNT, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  delay(500);

  // ── OLED ──────────────────────────────────────────────────────────────────
  Serial.println("Init OLED...");
  Wire.begin();
  Wire.setClock(100000UL);
  bool ok = oled.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR);
  Wire.setClock(100000UL);

  if (!ok) {
    Serial.println("OLED FAILED — check wiring and address");
  } else {
    Serial.println("OLED ok");
    oled.clearDisplay();
    oled.setTextSize(2);
    oled.setTextColor(SSD1306_WHITE);
    oled.setCursor(0, 20);
    oled.print("OLED OK");
    Wire.setClock(100000UL);
    oled.display();
    Serial.println("OLED display() done");
  }

  // ── NeoPixel ──────────────────────────────────────────────────────────────
  Serial.println("Init NeoPixels...");
  pixels.begin();
  pixels.setBrightness(80);
  Serial.println("NeoPixels ok — cycling R/G/B");
}

void loop() {
  uint32_t colors[3] = {
    pixels.Color(255, 0, 0),   // red
    pixels.Color(0, 255, 0),   // green
    pixels.Color(0, 0, 255),   // blue
  };
  const char* names[3] = { "RED", "GREEN", "BLUE" };

  for (int c = 0; c < 3; c++) {
    Serial.println(names[c]);
    for (int i = 0; i < NEOPIXEL_COUNT; i++) pixels.setPixelColor(i, colors[c]);
    pixels.show();
    delay(1000);
  }
}
