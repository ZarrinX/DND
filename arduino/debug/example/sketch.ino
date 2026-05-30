#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_NeoPixel.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR 0x3C

#define PIXEL_PIN   9     // Physical D6 on your Nano ESP32 setup
#define PIXEL_COUNT 7

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_NeoPixel pixels(PIXEL_COUNT, PIXEL_PIN, NEO_GRB + NEO_KHZ800);

void showOled(const char* title, const char* line1, const char* line2 = "") {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("NeoPixel Test");

  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(0, 18);
  display.println(title);

  display.setTextSize(1);
  display.setCursor(0, 44);
  display.println(line1);
  display.println(line2);

  display.display();
}

void setAll(uint8_t r, uint8_t g, uint8_t b) {
  pixels.fill(pixels.Color(r, g, b));
  pixels.show();
}

void colorWipe(uint32_t color, int waitMs) {
  pixels.clear();
  pixels.show();

  for (int i = 0; i < PIXEL_COUNT; i++) {
    pixels.setPixelColor(i, color);
    pixels.show();
    delay(waitMs);
  }
}

void chase(uint32_t color, int waitMs) {
  for (int i = 0; i < PIXEL_COUNT * 3; i++) {
    pixels.clear();
    pixels.setPixelColor(i % PIXEL_COUNT, color);
    pixels.show();
    delay(waitMs);
  }
}

void rainbowCycle(int waitMs) {
  for (long firstHue = 0; firstHue < 65536; firstHue += 2048) {
    for (int i = 0; i < PIXEL_COUNT; i++) {
      int pixelHue = firstHue + (i * 65536L / PIXEL_COUNT);
      pixels.setPixelColor(i, pixels.gamma32(pixels.ColorHSV(pixelHue)));
    }
    pixels.show();
    delay(waitMs);
  }
}

void setup() {
  Wire.begin();

  display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  display.clearDisplay();
  display.display();

  pixels.begin();
  pixels.setBrightness(40);
  pixels.clear();
  pixels.show();

  showOled("READY", "OLED + NeoPixels", "Nano ESP32");
  delay(1500);
}

void loop() {
  showOled("RED", "All pixels solid red");
  setAll(255, 0, 0);
  delay(1500);

  showOled("GREEN", "All pixels solid green");
  setAll(0, 255, 0);
  delay(1500);

  showOled("BLUE", "All pixels solid blue");
  setAll(0, 0, 255);
  delay(1500);

  showOled("WIPE", "Pixels fill one by one", "Color: white");
  colorWipe(pixels.Color(255, 255, 255), 200);
  delay(800);

  showOled("CHASE", "Single pixel moving", "Color: cyan");
  chase(pixels.Color(0, 255, 255), 120);
  delay(800);

  showOled("RAINBOW", "Hue cycle across ring");
  rainbowCycle(40);
  delay(800);

  showOled("OFF", "Clearing pixels");
  pixels.clear();
  pixels.show();
  delay(1000);
}