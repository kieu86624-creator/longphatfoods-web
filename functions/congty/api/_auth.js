/* =====================================================================
 *  Dùng chung cho các API của trang Công Ty.
 *  Mật khẩu KHÔNG lưu dạng thô ở đâu cả — chỉ lưu chuỗi băm PBKDF2.
 *  Phiên đăng nhập là cookie có chữ ký HMAC, sửa một ký tự là hỏng chữ ký.
 * ===================================================================== */

const TEN_COOKIE = "congty_session";
const HAN_GIO = 12; // phiên sống 12 tiếng rồi phải đăng nhập lại

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const tuB64url = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Băm mật khẩu bằng PBKDF2-SHA256, phải khớp với tao_mat_khau.ps1 trên máy. */
export async function bamMatKhau(matKhau, saltB64, vong = 120000) {
  const salt = tuB64url(saltB64.replace(/\+/g, "-").replace(/\//g, "_"));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(matKhau), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: vong }, key, 256
  );
  return b64url(bits);
}

/** So sánh không phụ thuộc thời gian, tránh dò mật khẩu bằng cách đo độ trễ. */
export function soSanhAnToan(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

async function khoaKy(secret) {
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

export async function taoPhien(user, secret) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    u: user, exp: Date.now() + HAN_GIO * 3600 * 1000
  })));
  const chuKy = b64url(await crypto.subtle.sign("HMAC", await khoaKy(secret),
    new TextEncoder().encode(payload)));
  return `${payload}.${chuKy}`;
}

export async function docPhien(request, secret) {
  const raw = (request.headers.get("cookie") || "")
    .split(";").map((s) => s.trim())
    .find((s) => s.startsWith(TEN_COOKIE + "="));
  if (!raw) return null;
  const [payload, chuKy] = raw.slice(TEN_COOKIE.length + 1).split(".");
  if (!payload || !chuKy) return null;
  const ok = await crypto.subtle.verify("HMAC", await khoaKy(secret),
    tuB64url(chuKy), new TextEncoder().encode(payload));
  if (!ok) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(tuB64url(payload)));
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}

export function cookiePhien(giaTri, songGiay) {
  // HttpOnly: JavaScript trên trang không đọc được cookie, giảm rủi ro bị đánh cắp phiên.
  return `${TEN_COOKIE}=${giaTri}; HttpOnly; Secure; SameSite=Strict; Path=/congty; Max-Age=${songGiay}`;
}

export const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

/** Cổng gác: mọi API xem số liệu đều phải đi qua đây. */
export async function canPhien(context) {
  const secret = context.env.CONGTY_SESSION_SECRET;
  if (!secret) return { loi: json({ ok: false, tin: "Chưa cấu hình CONGTY_SESSION_SECRET." }, 500) };
  const phien = await docPhien(context.request, secret);
  if (!phien) return { loi: json({ ok: false, tin: "Chưa đăng nhập." }, 401) };
  return { phien };
}
