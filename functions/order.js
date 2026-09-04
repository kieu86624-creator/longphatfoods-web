/* =====================================================================
 *  Cloudflare Pages Function — POST /order
 *  Nhận đơn từ web longphatfoods.com.vn → tạo đơn trong Pancake POS.
 *  api_key KHÔNG nằm trong code — đọc từ biến môi trường bí mật POS_API_KEY
 *  (đặt trong Cloudflare Pages → Settings → Environment variables).
 * ===================================================================== */
const SHOP_ID      = "1636075895";
const WAREHOUSE_ID = "08deecd2-b6d8-48fe-ae29-66f6268cb4f7"; // Kho Chính
const FREESHIP_MIN = 2;
const TG_CHAT_ID   = "8943513268";                            // chat nhận báo đơn mới (không bí mật)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
};

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.POS_API_KEY) {
      return json({ ok: false, error: "missing_api_key" }, 500);
    }
    const d = await request.json().catch(() => null);
    if (!d || !Array.isArray(d.itemsJson) || !d.itemsJson.length) {
      return json({ ok: false, error: "no_items" }, 400);
    }

    const items = [];
    let qtyTotal = 0;
    for (const it of d.itemsJson) {
      if (!it || !it.vid) continue;
      const q = Math.max(1, parseInt(it.qty, 10) || 1);
      items.push({ variation_id: it.vid, quantity: q });
      qtyTotal += q;
    }
    if (!items.length) return json({ ok: false, error: "no_valid_items" }, 400);

    const name    = (d.name || "").toString().trim();
    const phone   = (d.phone || "").toString().trim();
    const address = (d.address || "").toString().trim();

    let note = "Đơn từ web longphatfoods.com.vn";
    if (d.orderId) note += " · Mã: " + d.orderId;
    if (d.note)    note += " · Ghi chú KH: " + d.note;

    const payload = {
      items,
      bill_full_name: name,
      bill_phone_number: phone,
      shipping_address: { full_name: name, phone_number: phone, address },
      warehouse_id: WAREHOUSE_ID,
      is_free_shipping: qtyTotal >= FREESHIP_MIN,
      note,
      status: 0,
    };

    const url = `https://pos.pages.fm/api/v1/shops/${SHOP_ID}/orders?api_key=${env.POS_API_KEY}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const text = await r.text();

    if (r.status === 200 || r.status === 201) {
      let o = {};
      try { const j = JSON.parse(text); o = j.data || j; } catch (e) {}
      const orderId = o.system_id || o.id || null;
      // Báo đơn mới về Telegram (chạy nền, không chặn phản hồi, lỗi không làm hỏng đơn).
      const notify = notifyTelegram(env, d, payload, orderId);
      if (context.waitUntil) context.waitUntil(notify); else await notify.catch(() => {});
      return json({ ok: true, order_id: orderId });
    }
    return json({ ok: false, error: "pos_" + r.status, detail: text }, 502);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

// Gửi tin báo đơn mới vào Telegram. Token đọc từ secret TG_BOT_TOKEN (Pages → Settings → Variables).
async function notifyTelegram(env, d, payload, orderId) {
  try {
    const token = env.TG_BOT_TOKEN;
    if (!token) return; // chưa cấu hình token → bỏ qua, không ảnh hưởng đơn
    const money = n => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
    const ship  = payload.is_free_shipping ? "Miễn phí (đơn ≥ " + FREESHIP_MIN + " sp)" : "Tính khi giao";
    const lines = [
      "🛒 ĐƠN MỚI TỪ WEB — longphatfoods.com.vn",
      orderId ? ("🧾 Mã POS: #" + orderId) : null,
      d.orderId ? ("🔖 Mã web: " + d.orderId) : null,
      "👤 " + (d.name || "—"),
      "📞 " + (d.phone || "—"),
      "🏠 " + (d.address || "—"),
      "📦 " + (d.items || "—"),
      "🚚 " + ship,
      "💰 Tổng: " + money(d.total),
      d.note ? ("📝 Ghi chú: " + d.note) : null,
      d.time ? ("🕒 " + d.time) : null,
    ].filter(Boolean);
    const body = { chat_id: TG_CHAT_ID, text: lines.join("\n"), disable_web_page_preview: true };
    await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
  } catch (e) { /* nuốt lỗi: đơn vẫn được tạo dù báo Telegram lỗi */ }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}
