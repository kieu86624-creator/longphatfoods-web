/* GET /congty/api/data — trả số liệu cho dashboard. Phải đăng nhập mới đọc được. */
import { canPhien, json } from "./_auth.js";

const KHOI = ["nhansu", "kho", "kiemtoan", "ads", "donhang"];

export async function onRequestGet(context) {
  const { phien, loi } = await canPhien(context);
  if (loi) return loi;
  if (!context.env.CONGTY_KV) return json({ ok: false, tin: "Chưa gắn KV (CONGTY_KV)." }, 500);

  const kv = context.env.CONGTY_KV;
  const out = { ok: true, nguoi_xem: phien.u, khoi: {}, cap_nhat: {} };

  await Promise.all(KHOI.map(async (k) => {
    const [raw, luc] = await Promise.all([kv.get(`dulieu:${k}`), kv.get(`capnhat:${k}`)]);
    out.khoi[k] = raw ? JSON.parse(raw) : null;
    out.cap_nhat[k] = luc || null;
  }));

  return json(out);
}
