# AFTER8 Store — repaired build

ไฟล์ชุดนี้เป็นฉบับปรับปรุงสำหรับ GitHub Pages + Supabase

## จุดที่แก้
- แก้ path รูปสินค้าให้รองรับทั้ง `assets/product-*.png` และไฟล์รูปที่อยู่ root ของ repository
- แก้รูปในหน้ารายละเอียดและรูปในตะกร้าไม่ขึ้น
- ทำให้ Shop/Detail/Bag/Checkout เปลี่ยนหน้าได้เสถียรด้วย hash navigation
- กัน JavaScript error หาก Supabase หรือข้อมูลสินค้าโหลดไม่ได้ โดยจะใช้สินค้า demo แทน
- ย้ายการผูก event ไปหลัง DOM โหลดเสร็จ
- เพิ่ม fallback เมื่อรูปโหลดไม่สำเร็จ
- ป้องกัน localStorage/cart ที่เสียรูปแบบทำให้เว็บพัง
- เพิ่ม keyboard accessibility ให้การ์ดสินค้า
- ปรับ Admin/Checkout/Auth ให้มี error handling

## การติดตั้ง
อัปโหลดไฟล์และโฟลเดอร์ทั้งหมดในชุดนี้เข้า repository โดยคงโครงสร้างเดิม โดยเฉพาะ `assets/` และไฟล์ `app.js`, `index.html`, `styles.css`.

จากนั้น GitHub Pages ใช้ branch `main` และ root.

Supabase schema อยู่ใน `supabase-schema.sql`.
