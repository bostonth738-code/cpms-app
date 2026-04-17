# 📖 คำแนะนำการติดตั้งภาษาไทย

## 🎯 วัตถุประสงค์
ติดตั้งภาษาไทย (Thai - th-TH) ใน Windows เพื่อให้ใช้ Voice Dictation ได้

---

## ✅ วิธีการติดตั้ง (3 ขั้นตอน)

### **ขั้นตอนที่ 1: รัน Script**

#### **วิธี A: ใช้ Batch File (ง่ายสุด) ⭐**
1. ไปที่ **`c:\Users\USER\Downloads\cpms-app`**
2. หาไฟล์ **`install-thai-language.bat`**
3. **คลิกขวา** → **"Run as administrator"**
4. รอสักครู่ (2-5 นาที)
5. กด **Enter** เมื่อเสร็จ

#### **วิธี B: ใช้ PowerShell (สำหรับผู้เชี่ยวชาญ)**
1. เปิด PowerShell
2. คลิกขวา → **"Run as administrator"**
3. รัน command นี้:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
   & 'C:\Users\USER\Downloads\cpms-app\install-thai-language.ps1'
   ```
4. รอให้เสร็จ

---

### **ขั้นตอนที่ 2: ตรวจสอบการติดตั้ง**

ทำตามนี้:
1. เปิด **Settings** (Windows + I)
2. ไปที่ **Time & Language** → **Language & region**
3. ดูรายชื่อภาษา - ควรเห็น **Thai** ในรายชื่อ
4. (ถ้าต้องการ) เลือก **Thai** เป็น Preferred language

---

### **ขั้นตอนที่ 3: ใช้งาน Voice Dictation**

#### **ใน Windows:**
1. เปิด TextBox หรือ NotePad
2. กด **Windows + H** (เปิด Dictate)
3. คลิก **🎤 Settings**
4. เปลี่ยนภาษา → **Thai**
5. พูดได้เลย! ✓

#### **ใน Google Docs (แนะนำ):**
1. ไปที่ **docs.google.com**
2. สร้าง Document ใหม่
3. คลิก **Tools** → **Voice typing**
4. เลือกภาษา **Thai (ไทย)**
5. พูดแล้วจะพิมพ์เป็นไทย! ✓

---

## ⚠️ ข้อสำคัญ

- ✅ Script ต้องรัน **as Administrator**
- ✅ ต้องมี Internet connection (ดาวน์โหลด Language Pack)
- ✅ อาจใช้เวลา 2-5 นาที
- ✅ อาจต้องรีสตาร์ท Windows หลังติดตั้ง

---

## 🆘 แก้ไขปัญหา

### **ปัญหา: "ไม่มี Admin Permission"**
**วิธีแก้:**
- ปิด PowerShell/Command Prompt
- คลิกขวาไฟล์ → **Run as administrator**

### **ปัญหา: "Language Pack ไม่พบ"**
**วิธีแก้:**
- ตรวจสอบ Internet connection
- ลองรัน Windows Update ก่อน
- ลองติดตั้งแบบ Manual ผ่าน Settings

### **ปัญหา: "Voice Typing ยังพิมพ์เป็นจีน"**
**วิธีแก้:**
- ใช้ **Google Docs** แทน (ดีกว่ามาก)
- หรือไปที่ **Windows + H** → **Settings** → เปลี่ยนภาษา

---

## 📌 ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | วัตถุประสงค์ |
|-----|-----------|
| `install-thai-language.bat` | Batch file สำหรับรัน (ง่ายสุด) |
| `install-thai-language.ps1` | PowerShell script (เก่งกว่า) |
| `INSTALL_README.md` | ไฟล์นี้ |

---

## ✅ ยืนยันการติดตั้ง

หลังติดตั้งสำเร็จ ลอง:
1. เปิด **Windows + H**
2. ดูว่า **ภาษาม เป็น Thai** หรือไม่
3. พูด "สวัสดี"
4. ควรพิมพ์เป็นไทย ✓

---

**พร้อมแล้ว! ลองติดตั้งได้เลยครับ!** 🚀
