/*
 * I2C Scanner
 * Upload this sketch, then open Serial Monitor at 115200 baud.
 * It will print the address of every I2C device it finds.
 */

#include <Wire.h>

void setup() {
  Serial.begin(115200);
  while (!Serial);

  // Explicitly pass SDA/SCL so this works on both classic Nano (A4/A5)
  // and Nano ESP32 where Wire.begin() defaults can differ between core versions.
  Wire.begin(A4, A5);
  Serial.print(F("I2C scanner — SDA=A4, SCL=A5 — scanning...\n"));

  uint8_t found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission();
    if (err == 0) {
      Serial.print(F("  Device found at 0x"));
      if (addr < 16) Serial.print('0');
      Serial.println(addr, HEX);
      found++;
    }
  }

  if (found == 0) {
    Serial.println(F("  No I2C devices found."));
    Serial.println(F("  Check wiring: SDA -> A4, SCL -> A5 on Nano."));
  } else {
    Serial.print(found);
    Serial.println(F(" device(s) found."));
  }
}

void loop() {}
