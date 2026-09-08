/* POST /congty/api/ingest — máy nhà đẩy số liệu lên.
 * Không dùng phiên đăng nhập; xác thực bằng token riêng để lộ token này
 * cũng chỉ ghi được dữ liệu, không đọc được gì. */
import { soSanhAnToan, json } from "./_auth.js";

const KHOI_HOP_LE = ["nhansu", "kho", "kiemtoan", "ads", "donhang"];
const TOI_DA_BYTE = 3 * 1024 * 1024; // 3 MB mỗi khối, đủ rộng mà không cho nhồi rác

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.CONGTY_INGEST_TOKEN) return json({ ok: false, tin: "Chưa cấu hình CONGTY_INGEST_TOKEN." }, 500);
  if (!env.CONGTY_KV) return json({ ok: false, tin: "Chưa gắn KV (CONGTY_KV)." }, 500);

  const tok = request.headers.get("x-ingest-token") || "";
  if (!soSanhAnToan(tok, env.CONGTY_INGEST_TOKEN)) {
    return json({ ok: false, tin: "Token không đúng." }, 401);
  }

  const url = new URL(request.url);
  const khoi = url.searchParams.get("khoi") || "";
  if (!KHOI_HOP_LE.includes(khoi)) {
    return json({ ok: false, tin: `Khối không hợp lệ. Chấp nhận: ${KHOI_HOP_LE.join(", ")}` }, 400);
  }

  const raw = await request.text();
  if (!raw) return json({ ok: false, tin: "Không có nội dung." }, 400);
  if (raw.length > TOI_DA_BYTE) return json({ ok: false, tin: "Khối dữ liệu quá lớn." }, 413);
  try { JSON.parse(raw); } catch { return json({ ok: false, tin: "Nội dung không phải JSON." }, 400); }

  await env.CONGTY_KV.put(`dulieu:${khoi}`, raw);
  await env.CONGTY_KV.put(`capnhat:${khoi}`, new Date().toISOString());
  return json({ ok: true, tin: `Đã nhận khối '${khoi}' (${raw.length} byte).` });
}
