/* Yêu cầu máy nhà đẩy số mới.
 *  POST  — sếp bấm "Tải lại" trên web (cần đăng nhập) → ghi lại một yêu cầu.
 *  GET   — máy nhà hỏi "có ai yêu cầu không?" (cần token đẩy dữ liệu).
 * Đây là lệnh DUY NHẤT web có thể ra cho máy nhà, và nó không nhận tham số nào,
 * nên chiếm được tài khoản cũng chỉ ép được máy đẩy số chứ không chạy được gì khác.
 */
import { canPhien, soSanhAnToan, json } from "./_auth.js";

const KHOA = "yeucau:lammoi";

export async function onRequestPost(context) {
  const { phien, loi } = await canPhien(context);
  if (loi) return loi;
  if (!context.env.CONGTY_KV) return json({ ok: false, tin: "Chưa gắn KV." }, 500);

  const luc = new Date().toISOString();
  await context.env.CONGTY_KV.put(KHOA, JSON.stringify({ luc, boi: phien.u }));
  return json({
    ok: true, luc,
    tin: "Đã báo máy nhà đẩy số mới. Máy kiểm mỗi 2 phút, kéo xong mất thêm 1–3 phút.",
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const tok = request.headers.get("x-ingest-token") || "";
  if (!env.CONGTY_INGEST_TOKEN || !soSanhAnToan(tok, env.CONGTY_INGEST_TOKEN)) {
    return json({ ok: false, tin: "Token không đúng." }, 401);
  }
  if (!env.CONGTY_KV) return json({ ok: false, tin: "Chưa gắn KV." }, 500);
  const raw = await env.CONGTY_KV.get(KHOA);
  return json({ ok: true, yeu_cau: raw ? JSON.parse(raw) : null });
}
