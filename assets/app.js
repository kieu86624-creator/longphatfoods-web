/* =====================================================================
 *  app.js — Bộ sưu tập + Giỏ hàng + Đặt hàng (window.CATALOG từ data.js)
 *
 *  >>> SỬA THÔNG TIN CỬA HÀNG Ở ĐÂY <<<
 * ===================================================================== */
const CONFIG = {
  storeName:      "Đại Long Phát",     // Tên hiển thị header/footer/đơn hàng
  companyLegal:   "CÔNG TY TNHH THƯƠNG MẠI SẢN XUẤT ĐẠI LONG PHÁT",
  hotline:        "0983019260",         // số nhận đơn / SMS / gọi
  zalo:           "0983019260",         // số Zalo hoặc link zalo.me
  facebook:       "",                   // vd: "https://m.me/tenpage"
  address:        "Số 22 Đường Quang Trung, Phường Thành Vinh, Tỉnh Nghệ An",
  freeShipMinQty: 2,                    // Mua từ N sản phẩm -> miễn ship
  shipFee:        null,                 // Phí ship khi CHƯA đủ điều kiện (số VND). null = "liên hệ"
  deliveryDays:   "2–4 ngày",          // Thời gian giao dự kiến
  orderWebhook:   "/order",             // Cloudflare Pages Function tạo đơn POS (key ở biến bí mật)
};

/* --- Phân nhóm sản phẩm theo từ khóa (thứ tự = ưu tiên) --- */
const CAT_RULES = [
  ["Nụ trầm & Xông hương", /nụ|trầm|lư xông|thác|nến|khuynh diệp|thảo mộc|nụ quế/i],
  ["Mứt",                  /mứt/i],
  ["Chè & Giải khát",      /chè|sâm|bánh lọt|sương s|mủ trôm|khúc bạch|long nhãn|hạt sen|đậu đỏ|hạt lựu|tuyết yến|bưởi/i],
  ["Trái cây sấy",         /sấy|dâu tây|dâu tằm|kiwi|mãng cầu|táo đen|chà là|khoai lang|cóc|ngô nếp/i],
  ["Hạt & Ngũ cốc",        /hạt chia|yến mạch|nho khô|kỳ tử|la hán|nấm|hạt/i],
  ["Gia vị & Rong biển",   /muối hồng|himalaya|rong sụn|sương sáo/i],
  ["Đồ dùng & Khác",       /máy đọc|bàn chải|ghế|vòng|phong thủy/i],
];
const catOf = name => (CAT_RULES.find(([, re]) => re.test(name)) || ["Khác"])[0];

const fmt = n => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const DATA = window.CATALOG || { products: [], brands: [], count: 0, updated: "" };
DATA.products.forEach((p, i) => { p.cat = catOf(p.name); p._i = i; });

/* ---------- Giỏ hàng (localStorage) ---------- */
const CART_KEY = "web_catalog_cart_v1";
function loadCart(){ try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch { return {}; } }
function saveCart(){ try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch {} }

const state = { q: "", cat: "Tất cả", brand: "Tất cả", cart: loadCart(), view: "cart" };

const cartQtyTotal = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
const cartSubtotal = () => Object.entries(state.cart)
  .reduce((s, [i, q]) => s + (DATA.products[i]?.price || 0) * q, 0);
const isFreeShip   = () => cartQtyTotal() >= CONFIG.freeShipMinQty;

/* ---------- Khởi tạo tĩnh ---------- */
function initStatic(){
  $$("[data-store-name]").forEach(el => el.textContent = CONFIG.storeName);
  $$("[data-company-legal]").forEach(el => el.textContent = CONFIG.companyLegal || "");
  $$("[data-address]").forEach(el => el.textContent = CONFIG.address || "");
  $$("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
  const upd = $("[data-updated]"); if (upd) upd.textContent = DATA.updated || "—";
  const cf = $("[data-count-foot]"); if (cf) cf.textContent = DATA.count;

  // Hotline (mọi nơi: topbar, header, hero, footer, contact)
  $$("[data-hotline-text]").forEach(el => el.textContent = CONFIG.hotline || "Cập nhật");
  $$("[data-hotline-a]").forEach(el => { if (CONFIG.hotline) el.setAttribute("href", "tel:" + tel(CONFIG.hotline)); });
  // Zalo trong footer
  if (CONFIG.zalo) { const zw = $("[data-zalo-wrap]"); if (zw) zw.hidden = false;
    $$("[data-zalo-a]").forEach(el => el.setAttribute("href", linkify(CONFIG.zalo))); }

  const cats = new Set(DATA.products.map(p => p.cat));
  $("[data-stats]").innerHTML = [
    [DATA.count, "Sản phẩm"], [cats.size, "Nhóm hàng"], [DATA.brands.length, "Thương hiệu"],
  ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");

  const cc = [];
  if (CONFIG.hotline)  cc.push(["Hotline",  CONFIG.hotline, "tel:" + tel(CONFIG.hotline), false]);
  else                 cc.push(["Hotline",  "Cập nhật số điện thoại", "", true]);
  if (CONFIG.zalo)     cc.push(["Zalo",     CONFIG.zalo, linkify(CONFIG.zalo), false]);
  if (CONFIG.facebook) cc.push(["Facebook/Messenger", CONFIG.facebook, linkify(CONFIG.facebook), false]);
  if (CONFIG.address)  cc.push(["Địa chỉ",  CONFIG.address, "", false]);
  if (!CONFIG.zalo && !CONFIG.facebook && !CONFIG.address)
    cc.push(["Kênh khác", "Thêm Zalo / Facebook / địa chỉ trong app.js", "", true]);
  $("[data-contact]").innerHTML = cc.map(([lbl, val, href, todo]) => {
    const inner = `<div class="lbl">${lbl}</div><div class="val">${escapeHtml(val)}</div>`;
    const cls = "ccard" + (todo ? " todo" : "");
    return href ? `<a class="${cls}" href="${href}" target="_blank" rel="noopener">${inner}</a>`
                : `<div class="${cls}">${inner}</div>`;
  }).join("");
}
const tel = v => v.replace(/[^\d+]/g, "");
function linkify(v){
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\d+][\d\s]+$/.test(v)) return "https://zalo.me/" + tel(v);
  return v;
}

/* ---------- Bộ lọc ---------- */
function initFilters(){
  const bf = $("[data-brand-filter]");
  ["Tất cả", ...DATA.brands].forEach(b => {
    const btn = document.createElement("button");
    btn.textContent = b; btn.setAttribute("aria-pressed", b === state.brand);
    btn.onclick = () => { state.brand = b; press(bf, btn); render(); };
    bf.appendChild(btn);
  });
  const counts = {};
  DATA.products.forEach(p => counts[p.cat] = (counts[p.cat] || 0) + 1);
  const cats = ["Tất cả", ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])];
  const cc = $("[data-cats]");
  cats.forEach(c => {
    const btn = document.createElement("button");
    btn.textContent = `${c} (${c === "Tất cả" ? DATA.count : counts[c]})`;
    btn.setAttribute("aria-pressed", c === state.cat);
    btn.onclick = () => { state.cat = c; press(cc, btn); render(); };
    cc.appendChild(btn);
  });
}
const press = (box, active) =>
  Array.from(box.children).forEach(b => b.setAttribute("aria-pressed", b === active));

/* ---------- Lưới sản phẩm ---------- */
const FALLBACK = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='%23efe9db'/></svg>";
function filtered(){
  const q = state.q.trim().toLowerCase();
  return DATA.products.filter(p =>
    (state.brand === "Tất cả" || p.brand.includes(state.brand)) &&
    (state.cat === "Tất cả" || p.cat === state.cat) &&
    (!q || p.name.toLowerCase().includes(q)));
}
function render(){
  const list = filtered();
  $("[data-count]").textContent = `${list.length} sản phẩm`;
  $("[data-empty]").hidden = list.length > 0;
  $("[data-grid]").innerHTML = list.map(p => `
    <article class="card" data-open="${p._i}">
      <div class="card-media">
        <img src="${p.img}" alt="${escapeAttr(p.name)}" loading="lazy" onerror="this.src='${FALLBACK}'"/>
        <span class="card-cat">${p.cat}</span>
      </div>
      <div class="card-body">
        <h3 class="card-name">${escapeHtml(p.name)}</h3>
        <span class="card-brand">${p.brand.join(" · ")}</span>
        <div class="card-foot">
          <span class="card-price">${fmt(p.price)}</span>
          <button class="btn-add" data-add="${p._i}" aria-label="Thêm vào giỏ">+ Giỏ</button>
        </div>
      </div>
    </article>`).join("");
  syncCartBadge();
}

/* ---------- Chi tiết sản phẩm: trọng lượng + quy cách (từ POS weight hoặc tên) ---------- */
function weightText(p){
  let g = p.weight || 0;
  if (!g) {                                   // không có weight POS -> đọc từ tên
    let m = p.name.match(/(\d+(?:[.,]\d+)?)\s*KG/i);
    if (m) g = Math.round(parseFloat(m[1].replace(",", ".")) * 1000);
    else { m = p.name.match(/(\d{2,4})\s*GR?\b/i); if (m) g = parseInt(m[1], 10); }
  }
  if (!g) return "";
  return g >= 1000 ? (+(g / 1000).toFixed(g % 1000 ? 1 : 0)) + " kg" : g + " g";
}
function packText(p){
  let m = p.name.match(/(\d+)\s*(?:x\s*)?(túi|hộp|set|hũ|lọ|gói|quả|combo|khay)/i);
  if (m) return m[1] + " " + m[2].toLowerCase();
  m = p.name.match(/combo\s*(\d+)/i);   if (m) return "combo " + m[1];
  m = p.name.match(/\((\d+)\s*túi\)/i); if (m) return m[1] + " túi";
  return "";
}
function detailRows(p){
  const rows = [];
  const w = weightText(p); if (w) rows.push(["Trọng lượng", w]);
  const pk = packText(p);  if (pk) rows.push(["Quy cách", pk]);
  rows.push(["Nhóm hàng", p.cat]);
  rows.push(["Thương hiệu", p.brand.join(" · ")]);
  return rows.map(([k, v]) => `<div class="drow"><span>${k}</span><b>${escapeHtml(v)}</b></div>`).join("");
}

/* ---------- Modal chi tiết ---------- */
function openModal(p){
  const imgs = (p.imgs && p.imgs.length) ? p.imgs : [p.img];
  $("[data-modal-body]").innerHTML = `
    <div class="modal-gallery">
      <img data-main src="${imgs[0]}" alt="${escapeAttr(p.name)}" onerror="this.src='${FALLBACK}'"/>
      ${imgs.length > 1 ? `<div class="modal-thumbs">${imgs.map((s, i) =>
        `<img src="${s}" class="${i === 0 ? "on" : ""}" data-src="${s}"/>`).join("")}</div>` : ""}
    </div>
    <div class="modal-info">
      <div class="cat">${p.cat}</div>
      <h3>${escapeHtml(p.name)}</h3>
      <div class="price">${fmt(p.price)}</div>
      <div class="detail-list">${detailRows(p)}</div>
      ${p.desc ? `<p class="detail-desc">${escapeHtml(p.desc)}</p>` : ""}
      <div class="qtyrow">
        <div class="stepper"><button data-mq="-1">−</button><span data-mqv>1</span><button data-mq="1">+</button></div>
        <button class="btn btn-primary" data-modal-add="${p._i}">Thêm vào giỏ</button>
      </div>
      <p class="ship-note">🚚 Mua từ ${CONFIG.freeShipMinQty} sản phẩm → <strong>miễn ship tận nhà</strong></p>
    </div>`;
  show("[data-modal]");
  let q = 1;
  const qv = $("[data-mqv]");
  $$("[data-mq]").forEach(b => b.onclick = () => { q = Math.max(1, q + (+b.dataset.mq)); qv.textContent = q; });
  $("[data-modal-add]").onclick = () => { addToCart(p._i, q); closeModal(); openCart(); };
  $$(".modal-thumbs img").forEach(t => t.onclick = () => {
    $("[data-main]").src = t.dataset.src;
    $$(".modal-thumbs img").forEach(x => x.classList.remove("on")); t.classList.add("on");
  });
  $$("[data-modal-close]").forEach(el => el.onclick = closeModal);
}
const closeModal = () => hide("[data-modal]");

/* ---------- Thao tác giỏ ---------- */
function addToCart(i, qty = 1){
  state.cart[i] = (state.cart[i] || 0) + qty; saveCart(); syncCartBadge();
  toast(`Đã thêm “${DATA.products[i].name}” vào giỏ`);
  if (!$("[data-drawer]").hidden) renderCart();
}
function setQty(i, qty){
  if (qty <= 0) delete state.cart[i]; else state.cart[i] = qty;
  saveCart(); syncCartBadge(); renderCart();
}
function syncCartBadge(){
  const n = cartQtyTotal(), b = $("[data-cart-count]");
  b.textContent = n; b.hidden = n === 0;
}

/* ---------- Ngăn kéo giỏ hàng ---------- */
function openCart(){ state.view = "cart"; renderCart(); show("[data-drawer]"); }
const closeCart = () => hide("[data-drawer]");

function renderCart(){
  if (state.view === "checkout") return renderCheckout();
  if (state.view === "done")     return; // giữ nguyên màn hoàn tất
  $("[data-drawer-title]").textContent = "Giỏ hàng";
  const entries = Object.entries(state.cart).filter(([i]) => DATA.products[i]);
  const body = $("[data-drawer-body]");

  if (!entries.length){
    body.innerHTML = `<div class="cart-empty">
      <div class="cart-empty-ic">🛍️</div>
      <p>Giỏ hàng đang trống.</p>
      <button class="btn btn-line" data-drawer-close>Tiếp tục mua sắm</button></div>`;
    $("[data-drawer-foot]").innerHTML = "";
    $$("[data-drawer-close]", body).forEach(b => b.onclick = closeCart);
    return;
  }

  body.innerHTML = freeShipBar() + entries.map(([i, q]) => {
    const p = DATA.products[i];
    return `<div class="cart-item">
      <img src="${p.img}" alt="" onerror="this.src='${FALLBACK}'"/>
      <div class="ci-main">
        <div class="ci-name">${escapeHtml(p.name)}</div>
        <div class="ci-price">${fmt(p.price)}</div>
        <div class="ci-row">
          <div class="stepper sm"><button data-dec="${i}">−</button><span>${q}</span><button data-inc="${i}">+</button></div>
          <button class="ci-del" data-del="${i}" aria-label="Xóa">Xóa</button>
        </div>
      </div>
      <div class="ci-line">${fmt(p.price * q)}</div>
    </div>`;
  }).join("");

  const sub = cartSubtotal(), free = isFreeShip();
  const shipTxt = free ? "Miễn phí" : (CONFIG.shipFee == null ? "Liên hệ" : fmt(CONFIG.shipFee));
  const totTxt  = free ? fmt(sub)
                 : (CONFIG.shipFee == null ? `${fmt(sub)} + ship` : fmt(sub + CONFIG.shipFee));
  $("[data-drawer-foot]").innerHTML = `
    <div class="sum"><span>Tạm tính</span><b>${fmt(sub)}</b></div>
    <div class="sum"><span>Giao hàng</span><b class="${free ? "free" : ""}">${shipTxt}</b></div>
    <div class="sum total"><span>Tổng cộng</span><b>${totTxt}</b></div>
    <button class="btn btn-primary block" data-checkout>Tiến hành đặt hàng →</button>`;

  $$("[data-inc]", body).forEach(b => b.onclick = () => setQty(+b.dataset.inc, state.cart[b.dataset.inc] + 1));
  $$("[data-dec]", body).forEach(b => b.onclick = () => setQty(+b.dataset.dec, state.cart[b.dataset.dec] - 1));
  $$("[data-del]", body).forEach(b => b.onclick = () => setQty(+b.dataset.del, 0));
  $("[data-checkout]").onclick = () => { state.view = "checkout"; renderCheckout(); };
}

function freeShipBar(){
  const q = cartQtyTotal(), need = CONFIG.freeShipMinQty;
  if (q >= need)
    return `<div class="fsbar ok">🎉 Đơn của bạn được <strong>MIỄN PHÍ giao hàng tận nhà!</strong></div>`;
  const left = need - q;
  return `<div class="fsbar">
    <div class="fsbar-txt">Mua thêm <strong>${left} sản phẩm</strong> để được <strong>miễn ship tận nhà</strong></div>
    <div class="fsbar-track"><span style="width:${Math.min(q / need, 1) * 100}%"></span></div></div>`;
}

/* ---------- Màn thanh toán ---------- */
function renderCheckout(){
  $("[data-drawer-title]").textContent = "Thông tin đặt hàng";
  const sub = cartSubtotal(), free = isFreeShip();
  const shipTxt = free ? "Miễn phí" : (CONFIG.shipFee == null ? "Liên hệ" : fmt(CONFIG.shipFee));
  $("[data-drawer-body]").innerHTML = `
    <a class="back-link" data-back>← Quay lại giỏ</a>
    ${freeShipBar()}
    <form class="checkout" data-form>
      <label>Họ và tên <span>*</span><input name="name" required placeholder="Nguyễn Văn A"/></label>
      <label>Số điện thoại <span>*</span><input name="phone" required inputmode="tel" placeholder="0900 000 000"/></label>
      <label>Địa chỉ nhận hàng <span>*</span><textarea name="address" required rows="2" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP"></textarea></label>
      <label>Ghi chú <input name="note" placeholder="Thời gian nhận, yêu cầu khác…"/></label>
      <div class="checkout-sum">
        <div class="sum"><span>Tạm tính (${cartQtyTotal()} sp)</span><b>${fmt(sub)}</b></div>
        <div class="sum"><span>Giao hàng</span><b class="${free ? "free" : ""}">${shipTxt}</b></div>
      </div>
      <button type="submit" class="btn btn-primary block">Xác nhận đặt hàng</button>
    </form>`;
  $("[data-back]").onclick = () => { state.view = "cart"; renderCart(); };
  $("[data-drawer-foot]").innerHTML = "";
  $("[data-form]").onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    const info = {
      name: f.name.value.trim(), phone: f.phone.value.trim(),
      address: f.address.value.trim(), note: f.note.value.trim(),
    };
    if (!/^[\d\s+().-]{8,}$/.test(info.phone)) { toast("Số điện thoại chưa hợp lệ"); return; }
    info.orderId = "DH" + String(Date.now()).slice(-8);
    info.time = new Date().toLocaleString("vi-VN");
    submitOrder(info);
  };
}

/* ---------- Gửi đơn thẳng vào POS (chờ phản hồi) ---------- */
function orderPayload(info){
  const items = Object.entries(state.cart).filter(([i]) => DATA.products[i])
    .map(([i, q]) => { const p = DATA.products[i]; return { name: p.name, qty: q, price: p.price, line: p.price * q, vid: p.vid }; });
  const sub = cartSubtotal(), free = isFreeShip();
  return {
    orderId: info.orderId, time: info.time, store: CONFIG.storeName,
    name: info.name, phone: info.phone, address: info.address, note: info.note || "",
    items: items.map(x => `${x.qty} x ${x.name}`).join("; "),
    itemsJson: items, qty: cartQtyTotal(), subtotal: sub,
    ship: free ? "Miễn phí" : (CONFIG.shipFee == null ? "Liên hệ" : CONFIG.shipFee),
    total: free ? sub : (CONFIG.shipFee == null ? sub : sub + CONFIG.shipFee),
    delivery: CONFIG.deliveryDays,
  };
}
async function sendOrder(info){
  if (!CONFIG.orderWebhook) return { ok: false, error: "no_webhook" };
  try {
    const r = await fetch(CONFIG.orderWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify(orderPayload(info)),
    });
    return await r.json().catch(() => ({ ok: r.ok }));
  } catch (e) { return { ok: false, error: String(e) }; }
}
async function submitOrder(info){
  state.view = "done";
  $("[data-drawer-title]").textContent = "Đang gửi đơn…";
  $("[data-drawer-foot]").innerHTML = "";
  $("[data-drawer-body]").innerHTML = `<div class="done"><div class="spinner"></div><p class="done-sub">Đang gửi đơn của bạn…</p></div>`;
  const result = await sendOrder(info);
  renderDone(info, result);
}

/* ---------- Màn hoàn tất + gửi đơn ---------- */
function buildOrderText(info){
  const lines = Object.entries(state.cart).filter(([i]) => DATA.products[i]).map(([i, q]) => {
    const p = DATA.products[i];
    return `• ${q} x ${p.name} — ${fmt(p.price)} = ${fmt(p.price * q)}`;
  });
  const sub = cartSubtotal(), free = isFreeShip();
  const ship = free ? "Miễn phí (đơn ≥ " + CONFIG.freeShipMinQty + " sp)"
              : (CONFIG.shipFee == null ? "Liên hệ" : fmt(CONFIG.shipFee));
  const total = free ? fmt(sub) : (CONFIG.shipFee == null ? fmt(sub) + " + ship" : fmt(sub + CONFIG.shipFee));
  return [
    `ĐƠN HÀNG MỚI — ${CONFIG.storeName}`,
    info.orderId ? `Mã đơn: ${info.orderId}` : null,
    "————————————",
    ...lines,
    "————————————",
    `Tạm tính: ${fmt(sub)}`,
    `Giao hàng: ${ship}`,
    `TỔNG: ${total}`,
    `Giao dự kiến: ${CONFIG.deliveryDays}`,
    "————————————",
    `Khách: ${info.name}`,
    `SĐT: ${info.phone}`,
    `Địa chỉ: ${info.address}`,
    info.note ? `Ghi chú: ${info.note}` : null,
  ].filter(Boolean).join("\n");
}
function renderDone(info, result){
  result = result || { ok: true };
  const ok = result.ok !== false;
  const code = (result && result.order_id) ? String(result.order_id) : info.orderId;
  const text = buildOrderText(info);

  if (ok) {
    $("[data-drawer-title]").textContent = "Đặt hàng thành công";
    $("[data-drawer-body]").innerHTML = `
      <div class="done">
        <div class="done-ic">✅</div>
        <h3>Đặt hàng thành công!</h3>
        <p class="done-sub">Cảm ơn <strong>${escapeHtml(info.name)}</strong>. Đơn của bạn đã được <strong>xác nhận</strong> — cửa hàng sẽ liên hệ &amp; giao hàng tận nơi.</p>
        <div class="done-delivery">
          <div class="dd-row">🚚 <span>Dự kiến nhận hàng trong <strong>${CONFIG.deliveryDays}</strong></span></div>
          <div class="dd-row">🧾 <span>Mã đơn: <strong>${escapeHtml(code)}</strong></span></div>
        </div>
        <pre class="order-box" data-order>${escapeHtml(text)}</pre>
        <button class="btn btn-primary block" data-finish>Hoàn tất</button>
        ${CONFIG.hotline ? `<p class="done-hint">Cần hỗ trợ? Gọi <a href="tel:${tel(CONFIG.hotline)}">${CONFIG.hotline}</a></p>` : ""}
      </div>`;
  } else {
    $("[data-drawer-title]").textContent = "Xác nhận đơn hàng";
    $("[data-drawer-body]").innerHTML = `
      <div class="done">
        <div class="done-ic">📞</div>
        <h3>Gần xong!</h3>
        <p class="done-sub">Chưa gửi được đơn tự động. Vui lòng gọi để chốt đơn — chúng tôi xác nhận ngay.</p>
        <div class="done-delivery"><div class="dd-row">🧾 <span>Mã đơn: <strong>${escapeHtml(code)}</strong></span></div></div>
        <pre class="order-box" data-order>${escapeHtml(text)}</pre>
        ${CONFIG.hotline ? `<a class="btn btn-primary block" href="tel:${tel(CONFIG.hotline)}">📞 Gọi đặt: ${CONFIG.hotline}</a>` : ""}
        <button class="btn btn-line block" data-copy>📋 Sao chép đơn</button>
        <button class="btn btn-ghost block" data-finish>Đóng</button>
      </div>`;
    const cp = $("[data-copy]");
    if (cp) cp.onclick = async () => {
      try { await navigator.clipboard.writeText(text); toast("Đã sao chép"); }
      catch { toast("Hãy bôi đen & copy thủ công"); }
    };
  }
  $("[data-drawer-foot]").innerHTML = "";
  $("[data-finish]").onclick = () => {
    state.cart = {}; saveCart(); syncCartBadge(); state.view = "cart"; closeCart(); renderCart();
    toast("Cảm ơn quý khách!");
  };
}

/* ---------- Toast ---------- */
let toastT;
function toast(msg){
  const t = $("[data-toast]"); t.textContent = msg; t.hidden = false; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.hidden = true, 250); }, 2200);
}

/* ---------- show/hide overlay ---------- */
function show(sel){ $(sel).hidden = false; document.body.style.overflow = "hidden"; }
function hide(sel){ $(sel).hidden = true; if ($("[data-modal]").hidden && $("[data-drawer]").hidden) document.body.style.overflow = ""; }

/* ---------- Utils ---------- */
const escapeHtml = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const escapeAttr = s => escapeHtml(s).replace(/"/g, "&quot;");

/* ---------- Boot + sự kiện ---------- */
initStatic();
initFilters();
render();
$("#q").addEventListener("input", e => { state.q = e.target.value; render(); });
document.addEventListener("click", e => {
  const open = e.target.closest("[data-open]");
  const add  = e.target.closest("[data-add]");
  if (add)  { e.stopPropagation(); addToCart(+add.dataset.add, 1); return; }
  if (open) { openModal(DATA.products[+open.dataset.open]); }
  if (e.target.closest("[data-open-cart]")) openCart();
  if (e.target.closest("[data-drawer-close]")) closeCart();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeCart(); } });
