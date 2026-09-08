/* POST /congty/api/login — đăng nhập trang Công Ty. */
import { bamMatKhau, soSanhAnToan, taoPhien, cookiePhien, json } from "./_auth.js";

// Chặn dò mật khẩu: đếm số lần sai theo IP, quá thì nghỉ.
const TOI_DA_SAI = 8;
const CUA_SO_PHUT = 15;

export async function onRequestPost(context) {
  const { request, env } = context;
  const { CONGTY_USER, CONGTY_PASS_HASH, CONGTY_SALT, CONGTY_SESSION_SECRET, CONGTY_KV } = env;

  if (!CONGTY_USER || !CONGTY_PASS_HASH || !CONGTY_SALT || !CONGTY_SESSION_SECRET) {
    return json({ ok: false, tin: "Trang chưa được cấu hình tài khoản." }, 500);
  }

  const ip = request.headers.get("cf-connecting-ip") || "?";
  const khoaDem = `dangnhap_sai:${ip}`;
  if (CONGTY_KV) {
    const sai = parseInt((await CONGTY_KV.get(khoaDem)) || "0", 10);
    if (sai >= TOI_DA_SAI) {
      return json({ ok: false, tin: `Sai quá ${TOI_DA_SAI} lần. Thử lại sau ${CUA_SO_PHUT} phút.` }, 429);
    }
  }

  let body = {};
  try { body = await request.json(); } catch { /* body hỏng thì coi như sai */ }
  const user = String(body.user || "");
  const pass = String(body.pass || "");

  const bam = await bamMatKhau(pass, CONGTY_SALT);
  const dung = soSanhAnToan(user, CONGTY_USER) && soSanhAnToan(bam, CONGTY_PASS_HASH);

  if (!dung) {
    if (CONGTY_KV) {
      const sai = parseInt((await CONGTY_KV.get(khoaDem)) || "0", 10) + 1;
      await CONGTY_KV.put(khoaDem, String(sai), { expirationTtl: CUA_SO_PHUT * 60 });
    }
    // Không nói rõ sai tên hay sai mật khẩu — nói rõ là chỉ đường cho người dò.
    return json({ ok: false, tin: "Tên đăng nhập hoặc mật khẩu không đúng." }, 401);
  }

  if (CONGTY_KV) await CONGTY_KV.delete(khoaDem);
  const phien = await taoPhien(user, CONGTY_SESSION_SECRET);
  return json({ ok: true, tin: "Đăng nhập thành công." }, 200,
    { "set-cookie": cookiePhien(phien, 12 * 3600) });
}

export async function onRequestGet() {
  return json({ ok: false, tin: "Dùng POST để đăng nhập." }, 405);
}
