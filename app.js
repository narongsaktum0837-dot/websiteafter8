/* AFTER8 Store — stable GitHub Pages + Supabase frontend
 * Works with product images stored either as assets/product-*.png or at repository root.
 */
const SUPABASE_URL = "https://ncykqglaztgutpiphogx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_rtR-hYrxgKhg1EG2qWRsSQ_eIeZddNg";

const demoProducts = [
  { id:"demo-1", name:"A8 STRIPE POLO", price:1890, category:"Polos", sizes:["S","M","L","XL"], image:"assets/product-polo.png", featured:true, description:"100% cotton, classic polo collar, embroidered A8 logo, relaxed fit." },
  { id:"demo-2", name:"AFTER8 PREMIUM TEE / WHITE", price:1290, category:"T-Shirts", sizes:["S","M","L","XL"], image:"assets/product-tee.png", featured:true, description:"240 GSM premium combed cotton, reactive dye, relaxed fit, silicone wash finish." },
  { id:"demo-3", name:"AFTER8 / 001 SUNRISE DENIM", price:3990, category:"Jackets", sizes:["S","M","L","XL"], image:"assets/product-jacket.png", featured:true, description:"Premium denim 14.5 oz, oversized fit, sunrise embroidery, limited numbering." }
];

const VALID_VIEWS = new Set(["home","shop","detail","cart","checkout","account","contact","admin"]);
const FALLBACK_IMAGE = "assets/product-tee.png";
let products = [];
let cart = loadCart();
let selectedProduct = null;
let selectedSize = "M";
let session = null;
let sb = null;
let toastTimer = null;

const $ = id => document.getElementById(id);

function loadCart(){
  try {
    const value = JSON.parse(localStorage.getItem("after8-cart") || "[]");
    return Array.isArray(value) ? value.filter(x => x && x.id && Number(x.qty) > 0) : [];
  } catch { return []; }
}

function money(n){
  const value = Number(n || 0);
  return "฿" + value.toLocaleString("th-TH", {maximumFractionDigits:0});
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

function safeId(value){ return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "_"); }

/* Supports:
 *  - assets/product-polo.png (new package)
 *  - product-polo.png (current GitHub root)
 *  - https://.../image.png (Supabase/external)
 */
function imageUrl(value){
  const raw = String(value || "").trim();
  if(!raw) return FALLBACK_IMAGE;
  if(/^https?:\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  const clean = raw.replace(/^\.\//, "");
  if(clean.startsWith("/")) return clean;
  return clean;
}

function setImageFallback(img){
  if(!img || img.dataset.fallbackApplied === "1") return;
  img.dataset.fallbackApplied = "1";
  img.src = FALLBACK_IMAGE;
}

function toast(message){
  const el = $("toast");
  if(!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function updateCount(){
  const count = $("count");
  if(count) count.textContent = cart.reduce((sum,x) => sum + Math.max(0, Number(x.qty) || 0), 0);
}

function saveCart(){
  try { localStorage.setItem("after8-cart", JSON.stringify(cart)); } catch {}
  updateCount();
}

function go(id, updateHash = true){
  const viewId = VALID_VIEWS.has(id) ? id : "home";
  document.querySelectorAll(".view").forEach(view => view.classList.add("hidden"));
  const view = $(viewId);
  if(view) view.classList.remove("hidden");

  if(viewId === "shop") renderShop();
  if(viewId === "detail") renderDetail();
  if(viewId === "cart") renderCart();
  if(viewId === "checkout") renderCheckout();
  if(viewId === "account") renderAccount();
  if(viewId === "admin") renderAdmin();

  if(updateHash && location.hash !== `#${viewId}`){
    history.pushState(null, "", `#${viewId}`);
  }
  window.scrollTo({top:0, behavior:"smooth"});
}

function currentView(){
  const id = location.hash.replace(/^#/, "");
  return VALID_VIEWS.has(id) ? id : "home";
}

function productCard(product){
  const id = escapeHtml(product.id);
  const name = escapeHtml(product.name);
  const image = imageUrl(product.image);
  return `<article class="card" role="button" tabindex="0" data-product-id="${id}" aria-label="ดู ${name}">
    <div class="pic"><img loading="lazy" src="${escapeHtml(image)}" alt="${name}" onerror="setImageFallback(this)"></div>
    <div class="meta"><span>${name}</span><span>${money(product.price)}</span></div>
  </article>`;
}

async function loadProducts(){
  products = demoProducts.slice();
  if(sb){
    try {
      const {data, error} = await sb.from("products").select("*").eq("published", true).order("created_at", {ascending:false});
      if(!error && Array.isArray(data) && data.length) products = data;
      else if(error) console.warn("Supabase products unavailable; using demo products.", error);
    } catch(error) {
      console.warn("Supabase request failed; using demo products.", error);
    }
  }
  fillFilters();
  renderLatest();
  renderShop();
}

function renderLatest(){
  const latest = $("latest");
  if(!latest) return;
  latest.innerHTML = products.slice(0,3).map(productCard).join("");
}

function fillFilters(){
  const cat = $("cat");
  const size = $("size");
  if(!cat || !size) return;
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const sizes = [...new Set(products.flatMap(p => Array.isArray(p.sizes) ? p.sizes : []))];
  cat.innerHTML = '<option value="">All categories</option>' + cats.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
  size.innerHTML = '<option value="">All sizes</option>' + sizes.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
}

function renderShop(){
  const search = $("search"), cat = $("cat"), size = $("size"), target = $("products"), count = $("resultCount");
  if(!search || !cat || !size || !target) return;
  const q = search.value.trim().toLowerCase();
  const category = cat.value;
  const selected = size.value;
  const list = products.filter(p => {
    const name = String(p.name || "").toLowerCase();
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    return (!q || name.includes(q)) && (!category || p.category === category) && (!selected || sizes.includes(selected));
  });
  if(count) count.textContent = `${list.length} items`;
  target.innerHTML = list.length ? list.map(productCard).join("") : '<p class="empty">ไม่พบสินค้า</p>';
}

function showProduct(id){
  const found = products.find(p => String(p.id) === String(id));
  if(!found){ toast("ไม่พบสินค้านี้"); return; }
  selectedProduct = found;
  selectedSize = (Array.isArray(found.sizes) && found.sizes.length ? found.sizes[0] : "M");
  renderDetail();
  go("detail");
}

function renderDetail(){
  const box = $("detailBox");
  if(!box || !selectedProduct) return;
  const p = selectedProduct;
  const name = escapeHtml(p.name);
  const category = escapeHtml(p.category || "AFTER8");
  const image = escapeHtml(imageUrl(p.image));
  const description = escapeHtml(p.description || "Premium AFTER8 garment. Relaxed fit with carefully considered details.");
  const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ["S","M","L","XL"];

  box.innerHTML = `<div class="detail">
    <div class="gallery">
      <div class="pic"><img src="${image}" alt="${name}" onerror="setImageFallback(this)"></div>
      <div class="pic"><img src="${image}" alt="${name} alternate view" onerror="setImageFallback(this)"></div>
    </div>
    <div class="detail-info">
      <div class="ey">${category}</div>
      <h1>${name}</h1>
      <div class="price">${money(p.price)}</div>
      <p class="muted">${description}</p>
      <div class="ey">SIZE</div>
      <div class="opts">${sizes.map(s => `<button type="button" class="opt ${s===selectedSize?"active":""}" data-size="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}</div>
      <div class="stack"><button type="button" class="btn" id="addToBagBtn">Add to bag</button><button type="button" class="btn light" id="buyNowBtn">Buy now</button></div>
    </div>
  </div>`;
}

function pickSize(size){
  selectedSize = size;
  document.querySelectorAll(".opt[data-size]").forEach(btn => btn.classList.toggle("active", btn.dataset.size === size));
}

function addToCart(){
  if(!selectedProduct){ toast("กรุณาเลือกสินค้า"); return; }
  const id = String(selectedProduct.id);
  const price = Number(selectedProduct.price || 0);
  const item = cart.find(x => String(x.id) === id && x.size === selectedSize);
  if(item) item.qty = Number(item.qty || 0) + 1;
  else cart.push({id, name:selectedProduct.name, price, image:selectedProduct.image, size:selectedSize, qty:1});
  saveCart();
  toast("เพิ่มสินค้าในตะกร้าแล้ว");
}

function buyNow(){
  addToCart();
  go("checkout");
}

function cartImage(item){ return escapeHtml(imageUrl(item.image)); }

function renderCart(){
  const box = $("cartBox");
  if(!box) return;
  if(!cart.length){
    box.innerHTML = '<div class="summary empty-cart">ยังไม่มีสินค้าในตะกร้า<br><br><a class="btn" href="#shop">เลือกซื้อสินค้า</a></div>';
    return;
  }
  const subtotal = cart.reduce((sum,x) => sum + Number(x.price || 0) * Number(x.qty || 0), 0);
  const shipping = subtotal >= 3000 ? 0 : 80;
  box.innerHTML = `<div class="layout">
    <div>${cart.map((item,index) => `<div class="cartrow">
      <div class="pic"><img loading="lazy" src="${cartImage(item)}" alt="${escapeHtml(item.name)}" onerror="setImageFallback(this)"></div>
      <div><b>${escapeHtml(item.name)}</b><div class="muted">Size ${escapeHtml(item.size || "-")}</div><div>${money(item.price)} × ${Number(item.qty || 0)}</div></div>
      <button type="button" class="textbtn remove-item" data-index="${index}" aria-label="ลบสินค้า">×</button>
    </div>`).join("")}</div>
    <aside class="summary"><div class="sum"><span>Subtotal</span><b>${money(subtotal)}</b></div><div class="sum"><span>Shipping</span><span>${shipping ? money(shipping) : "FREE"}</span></div><div class="sum"><b>Total</b><b>${money(subtotal + shipping)}</b></div><br><button type="button" class="btn full" id="cartCheckoutBtn">Checkout</button></aside>
  </div>`;
}

function removeItem(index){
  if(index < 0 || index >= cart.length) return;
  cart.splice(index,1); saveCart(); renderCart(); toast("ลบสินค้าแล้ว");
}

function renderCheckout(){
  const box = $("checkoutBox");
  if(!box) return;
  if(!cart.length){ box.innerHTML = '<div class="summary">Cart is empty.<br><br><a class="btn" href="#shop">กลับไป Shop</a></div>'; return; }
  const subtotal = cart.reduce((sum,x) => sum + Number(x.price || 0) * Number(x.qty || 0), 0);
  const shipping = subtotal >= 3000 ? 0 : 80;
  box.innerHTML = `<div class="layout">
    <form id="checkoutForm" class="form">
      <input id="fullName" required placeholder="ชื่อ-นามสกุล">
      <input id="phone" required inputmode="tel" placeholder="เบอร์โทร">
      <textarea id="address" required placeholder="ที่อยู่"></textarea>
      <input id="province" required placeholder="จังหวัด">
      <input id="postal" required inputmode="numeric" placeholder="รหัสไปรษณีย์">
      <select id="payment"><option value="transfer">โอนเงิน</option><option value="cod">เก็บเงินปลายทาง</option></select>
      <button class="btn" type="submit">ยืนยันคำสั่งซื้อ</button>
      ${session ? "" : '<p class="muted">กรุณา Login ก่อนยืนยันคำสั่งซื้อ</p>'}
    </form>
    <aside class="summary"><div class="sum"><span>Subtotal</span><b>${money(subtotal)}</b></div><div class="sum"><span>Shipping</span><span>${shipping ? money(shipping) : "FREE"}</span></div><div class="sum"><b>Total</b><b>${money(subtotal + shipping)}</b></div></aside>
  </div>`;
}

async function placeOrder(event){
  event.preventDefault();
  if(!session){ toast("กรุณา Login ก่อนสั่งซื้อ"); go("account"); return; }
  if(!sb){ toast("ระบบฐานข้อมูลยังไม่พร้อม"); return; }
  const subtotal = cart.reduce((sum,x) => sum + Number(x.price || 0) * Number(x.qty || 0), 0);
  const shipping = subtotal >= 3000 ? 0 : 80;
  const payment = $("payment").value;
  try {
    const {data:order,error} = await sb.from("orders").insert({
      user_id:session.user.id,
      customer_name:$('fullName').value.trim(),
      phone:$('phone').value.trim(),
      address:$('address').value.trim(),
      province:$('province').value.trim(),
      postal_code:$('postal').value.trim(),
      payment_method:payment,
      subtotal,
      shipping,
      total:subtotal + shipping,
      status:payment === "transfer" ? "awaiting_payment" : "pending"
    }).select().single();
    if(error) throw error;
    const items = cart.map(x => ({
      order_id:order.id,
      product_id:String(x.id).startsWith("demo-") ? null : x.id,
      product_name:x.name,
      unit_price:Number(x.price || 0),
      size:x.size,
      quantity:Number(x.qty || 0)
    }));
    const {error:itemError} = await sb.from("order_items").insert(items);
    if(itemError) throw itemError;
    cart = []; saveCart(); toast("สร้างคำสั่งซื้อแล้ว"); go("home");
  } catch(error) { console.error(error); toast(error?.message || "สร้างคำสั่งซื้อไม่สำเร็จ"); }
}

function renderAccount(){
  const status = $("accountStatus"), logout = $("logoutBtn");
  if(status) status.textContent = session ? `เข้าสู่ระบบ: ${session.user.email}` : "ยังไม่ได้เข้าสู่ระบบ";
  if(logout) logout.style.display = session ? "block" : "none";
}

async function signIn(event){
  event.preventDefault();
  if(!sb){ toast("ระบบ Login ยังไม่พร้อม"); return; }
  try {
    const {error} = await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
    if(error) throw error;
    toast("เข้าสู่ระบบสำเร็จ");
  } catch(error){ toast(error?.message || "เข้าสู่ระบบไม่สำเร็จ"); }
}

async function signUp(){
  if(!sb){ toast("ระบบสมัครสมาชิกยังไม่พร้อม"); return; }
  try {
    const {error} = await sb.auth.signUp({email:$('email').value.trim(),password:$('password').value});
    if(error) throw error;
    toast("สมัครสมาชิกแล้ว กรุณาตรวจอีเมลถ้าระบบร้องขอ");
  } catch(error){ toast(error?.message || "สมัครสมาชิกไม่สำเร็จ"); }
}

async function logout(){
  if(sb){ try { await sb.auth.signOut(); } catch(error){ console.warn(error); } }
  session = null; renderAccount(); toast("ออกจากระบบแล้ว");
}

async function renderAdmin(){
  const box = $("adminBox");
  if(!box) return;
  if(!session || !sb){ box.innerHTML = '<p>กรุณา Login ด้วยบัญชีแอดมิน</p>'; return; }
  try {
    const {data:profile} = await sb.from("profiles").select("role").eq("id",session.user.id).single();
    if(profile?.role !== "admin"){ box.innerHTML = "<p>บัญชีนี้ไม่มีสิทธิ์ Admin</p>"; return; }
    const {data:orders,error} = await sb.from("orders").select("*").order("created_at",{ascending:false}).limit(50);
    if(error) throw error;
    const list = orders || [];
    box.innerHTML = `<div class="adminstat"><div class="stat">ORDERS<strong>${list.length}</strong></div><div class="stat">SALES<strong>${money(list.reduce((sum,o)=>sum+Number(o.total||0),0))}</strong></div><div class="stat">PRODUCTS<strong>${products.length}</strong></div><div class="stat">STATUS<strong>LIVE</strong></div></div>
      <div class="table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${list.map(o => `<tr><td>${escapeHtml(String(o.id).slice(0,8))}</td><td>${escapeHtml(o.customer_name)}</td><td>${money(o.total)}</td><td>${escapeHtml(o.payment_method)}</td><td><select class="order-status" data-order-id="${escapeHtml(o.id)}"><option value="pending" ${o.status==="pending"?"selected":""}>pending</option><option value="awaiting_payment" ${o.status==="awaiting_payment"?"selected":""}>awaiting_payment</option><option value="preparing" ${o.status==="preparing"?"selected":""}>preparing</option><option value="shipped" ${o.status==="shipped"?"selected":""}>shipped</option><option value="completed" ${o.status==="completed"?"selected":""}>completed</option><option value="cancelled" ${o.status==="cancelled"?"selected":""}>cancelled</option></select></td></tr>`).join("")}</tbody></table></div>`;
  } catch(error){ console.error(error); box.innerHTML = `<p class="error">${escapeHtml(error?.message || "โหลด Admin ไม่สำเร็จ")}</p>`; }
}

async function setOrderStatus(id,status){
  if(!sb) return;
  try {
    const {error} = await sb.from("orders").update({status}).eq("id",id);
    if(error) throw error;
    toast("อัปเดตสถานะแล้ว");
  } catch(error){ toast(error?.message || "อัปเดตไม่สำเร็จ"); }
}

function bindEvents(){
  document.addEventListener("click", event => {
    const card = event.target.closest(".card[data-product-id]");
    if(card) showProduct(card.dataset.productId);
    const size = event.target.closest(".opt[data-size]");
    if(size) pickSize(size.dataset.size);
    if(event.target.closest("#addToBagBtn")) addToCart();
    if(event.target.closest("#buyNowBtn")) buyNow();
    const remove = event.target.closest(".remove-item");
    if(remove) removeItem(Number(remove.dataset.index));
    if(event.target.closest("#cartCheckoutBtn")) go("checkout");
  });
  document.addEventListener("keydown", event => {
    const card = event.target.closest?.(".card[data-product-id]");
    if(card && (event.key === "Enter" || event.key === " ")){ event.preventDefault(); showProduct(card.dataset.productId); }
  });
  $("authForm")?.addEventListener("submit", signIn);
  $("signupBtn")?.addEventListener("click", signUp);
  $("logoutBtn")?.addEventListener("click", logout);
  $("loginBtn")?.addEventListener("click", () => go("account"));
  $("cartBtn")?.addEventListener("click", () => go("cart"));
  $("search")?.addEventListener("input", renderShop);
  $("cat")?.addEventListener("change", renderShop);
  $("size")?.addEventListener("change", renderShop);
  $("checkoutBox")?.addEventListener("submit", event => { if(event.target.id === "checkoutForm") placeOrder(event); });
  $("adminBox")?.addEventListener("change", event => { const select = event.target.closest(".order-status"); if(select) setOrderStatus(select.dataset.orderId, select.value); });
  window.addEventListener("hashchange", () => go(currentView(), false));
  window.addEventListener("popstate", () => go(currentView(), false));
}

async function init(){
  bindEvents();
  updateCount();
  try {
    if(window.supabase?.createClient && SUPABASE_URL.startsWith("http") && !SUPABASE_ANON_KEY.includes("YOUR_")){
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const {data:{session:activeSession}} = await sb.auth.getSession();
      session = activeSession || null;
      sb.auth.onAuthStateChange((_event,newSession) => { session = newSession; renderAccount(); });
    }
  } catch(error){ console.warn("Supabase init failed; running in demo mode.", error); sb = null; }
  renderAccount();
  await loadProducts();
  go(currentView(), false);
}

window.imageUrl = imageUrl;
window.setImageFallback = setImageFallback;
window.showProduct = showProduct;
window.addToCart = addToCart;
window.buyNow = buyNow;
window.go = go;
window.placeOrder = placeOrder;
window.setOrderStatus = setOrderStatus;

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
else init();
