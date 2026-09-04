/* =====================================================================
 *  Cloudflare Pages Function — GET /lookup?phone=<SĐT>
 *  Tra cứu đơn hàng của khách theo số điện thoại (dữ liệu từ Pancake POS).
 *  Khóa POS đọc từ biến môi trường POS_API_KEY (Settings → Variables).
 * ===================================================================== */
const SHOP_ID = "1636075895";
const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };
const STATUS = {
  0: "Đơn mới", 1: "Đã xác nhận", 2: "Đã gửi hàng", 3: "Đang giao",
  4: "Giao thành công", 5: "Đã hủy", 6: "Đang hoàn", 7: "Đã hoàn",
  8: "Đã xóa", 9: "Khách bom hàng", 11: "Chờ hàng", 12: "Chờ in",
  13: "Đã in", 15: "Đơn nháp", 16: "Đợi hàng", 17: "Đã đặt NCC",
};

export async function onRequestOptions() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const phone = (new URL(request.url).searchParams.get("phone") || "").replace(/\D/g, "");
  try {
    if (!env.POS_API_KEY) return json({ ok: false, error: "missing_api_key" }, 500);
    if (phone.length < 8) return json({ ok: false, error: "invalid_phone" }, 400);

    const url = `https://pos.pages.fm/api/v1/shops/${SHOP_ID}/orders?api_key=${env.POS_API_KEY}` +
                `&page_number=1&page_size=20&search=${encodeURIComponent(phone)}`;
    const r = await fetch(url);
    if (!r.ok) return json({ ok: false, error: "pos_" + r.status }, 502);
    const j = await r.json();
    const data = Array.isArray(j.data) ? j.data : [];

    const orders = data.map(o => ({
      id: o.system_id || o.id,
      status: (o.status in STATUS) ? STATUS[o.status] : (o.status_name || "—"),
      status_code: o.status,
      total: o.total_price || 0,
      cod: o.cod || 0,
      date: o.inserted_at || "",
      items: (o.items || []).map(it => {
        const vi = it.variation_info || {};
        return `${it.quantity} x ${vi.name || vi.product_display_id || "SP"}`;
      }).join(", "),
      customer: o.bill_full_name || "",
    }));

    return json({ ok: true, count: orders.length, orders });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}
