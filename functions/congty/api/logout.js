/* POST /congty/api/logout — xoá phiên. */
import { cookiePhien, json } from "./_auth.js";

export async function onRequestPost() {
  return json({ ok: true, tin: "Đã đăng xuất." }, 200, { "set-cookie": cookiePhien("", 0) });
}
