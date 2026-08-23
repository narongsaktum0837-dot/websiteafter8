# AFTER8 Store

เว็บร้านเสื้อ AFTER8 แบบ static frontend + Supabase backend.

## โครงสร้าง
- `index.html` — หน้าเว็บ
- `styles.css` — ดีไซน์
- `app.js` — สินค้า, ตะกร้า, login, checkout, admin
- `supabase-schema.sql` — ตาราง + RLS + ข้อมูลสินค้าเริ่มต้น
- `assets/` — รูปสินค้าที่ผู้ใช้ส่งมา

## ตั้งค่า Supabase
1. สร้างโปรเจกต์ Supabase
2. เปิด SQL Editor แล้วรัน `supabase-schema.sql`
3. ไปที่ Project Settings > API แล้วคัดลอก Project URL และ anon/publishable key
4. ใส่ค่าใน `app.js`
5. สร้างบัญชีผ่านหน้า Account
6. ใน SQL Editor รัน:
   `update public.profiles set role='admin' where email='อีเมลแอดมิน';`

## อัปขึ้น GitHub
อัปโหลดไฟล์ทั้งหมดนี้เข้า repository `websiteafter8`.
เปิด Settings > Pages แล้วเลือก branch `main` / root.
GitHub Pages จะสร้าง URL ให้.

## หมายเหตุ
- ห้ามใส่ Supabase service_role key ใน frontend
- การโอนเงินในเวอร์ชันนี้เป็นการตรวจสอบโดยแอดมิน
- COD ไม่ต้องมี payment gateway
- ก่อนเปิดขายจริง ควรเพิ่มระบบตรวจสต็อกแบบ transaction และระบบแจ้งเตือน/หลักฐานการโอน
