# Đại Long Phát — Web bán hàng (longphatfoods.com.vn)

Website đặc sản Đại Long Phát, deploy trên Cloudflare Pages.

## Cấu trúc
- `index.html` + `assets/` — giao diện web (đọc sản phẩm từ `assets/data.js`).
- `functions/order.js` — Cloudflare Pages Function nhận đơn (`POST /order`) → tạo đơn trong Pancake POS. Khóa POS đặt ở biến môi trường **POS_API_KEY** (Pages → Settings → Variables).

## Cập nhật sản phẩm
Chạy `build_catalog.ps1` (trong repo gốc) để cập nhật `assets/data.js` từ POS, rồi commit & push — Cloudflare tự deploy.
