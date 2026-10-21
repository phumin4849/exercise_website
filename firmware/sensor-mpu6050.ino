// ESP32 + MPU-6050 + FSR ส่งข้อมูลให้หน้า "วัด" ของ InjuryGuard ผ่าน USB Serial
// บรรทัดละ 1 ตัวอย่าง:  SIDE,ax,ay,az,gx,gy,gz,fsr    หน่วย: g, องศา/วินาที, ค่า ADC ดิบ 0-4095
// การต่อสาย (ดู docs/HARDWARE.md):
//   MPU-6050: VCC 3.3V, GND, SDA = GPIO21, SCL = GPIO22      (บอร์ดอื่นใช้ขา I2C ตามบอร์ด)
//   FSR: 3.3V --- FSR --- GPIO34 --- 10 kΩ --- GND            (GPIO34 อ่านอย่างเดียว ใช้กับ ADC ได้ดี)
// ติดเซนเซอร์ 1 ชุดต่อ 1 ข้าง แล้วเปลี่ยน SIDE เป็น 'L' หรือ 'R' ก่อนอัปโหลดให้แต่ละบอร์ด
// แกนของ MPU-6050: ให้ x ชี้ไปข้างหน้า, y ชี้ออกด้านข้าง, z ชี้ขึ้นแนวดิ่งตอนยืน
#include <Wire.h>

const int MPU = 0x68;               // ตัวที่ 2 ที่หน้าแข้ง: ต่อขา AD0 เข้า 3.3V จะเป็น 0x69 (ยังไม่ได้ใช้ในโค้ดนี้)
const char SIDE = 'L';
const int FSR_PIN = 34;
const unsigned long PERIOD_US = 4000;   // 250 Hz  (สาย 921600 baud ส่งไหว ถ้าจะเพิ่มความถี่ต้องลดความยาวบรรทัด)

void writeReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU); Wire.write(reg); Wire.write(val); Wire.endTransmission(true);
}

void setup() {
  Serial.begin(921600);
  Wire.begin();
  Wire.setClock(400000);
  writeReg(0x6B, 0x00);   // ปลุกเซนเซอร์
  writeReg(0x1C, 0x18);   // ความเร่ง ±16g  (2048 LSB/g)
  writeReg(0x1B, 0x18);   // ไจโร ±2000 °/s (16.4 LSB/(°/s))
  writeReg(0x1A, 0x00);   // DLPF ปิด แบนด์วิดท์กว้างสุด
  analogReadResolution(12);
  analogSetPinAttenuation(FSR_PIN, ADC_11db);
}

void loop() {
  static unsigned long next = 0;
  if (micros() < next) return;
  next = micros() + PERIOD_US;

  Wire.beginTransmission(MPU); Wire.write(0x3B); Wire.endTransmission(false);
  Wire.requestFrom(MPU, 14, true);
  int16_t ax = Wire.read() << 8 | Wire.read();
  int16_t ay = Wire.read() << 8 | Wire.read();
  int16_t az = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read();                       // อุณหภูมิ ข้ามไป
  int16_t gx = Wire.read() << 8 | Wire.read();
  int16_t gy = Wire.read() << 8 | Wire.read();
  int16_t gz = Wire.read() << 8 | Wire.read();
  int fsr = analogRead(FSR_PIN);

  const float a = 1.0 / 2048.0, g = 1.0 / 16.4;
  Serial.print(SIDE);            Serial.print(',');
  Serial.print(ax * a, 2);       Serial.print(',');
  Serial.print(ay * a, 2);       Serial.print(',');
  Serial.print(az * a, 2);       Serial.print(',');
  Serial.print((int)(gx * g));   Serial.print(',');
  Serial.print((int)(gy * g));   Serial.print(',');
  Serial.print((int)(gz * g));   Serial.print(',');
  Serial.println(fsr);
}
