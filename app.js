// AFTER8 store — Supabase-backed frontend.
// 1) Put your Supabase URL and anon key below.
// 2) Run supabase-schema.sql in Supabase SQL Editor.
// 3) Create an admin account, then set its profile role to "admin".
const SUPABASE_URL = "https://ncykqglaztgutpiphogx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_rtR-hYrxgKhg1EG2qWRsSQ_eIeZddNg";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const demoProducts = [
  {id:"demo-1",name:"A8 STRIPE POLO",price:1890,category:"Polos",sizes:["S","M","L","XL"],image:"product-polo.png",featured:true},
  {id:"demo-2",name:"AFTER8 PREMIUM TEE / WHITE",price:1290,category:"T-Shirts",sizes:["S","M","L","XL"],image:"product-tee.png",featured:true},
  {id:"demo-3",name:"AFTER8 / 001 SUNRISE DENIM",price:3990,category:"Jackets",sizes:["S","M","L","XL"],image:"product-jacket.png",featured:true}
];
let products=[], cart=JSON.parse(localStorage.getItem("after8-cart")||"[]"), selectedProduct=null, selectedSize="M", session=null;

const $=id=>document.getElementById(id);
function money(n){return "฿"+Number(n).toLocaleString("th-TH")}
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2200)}
function go(id){document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));$(id).classList.remove("hidden");if(id==="shop")renderShop();if(id==="cart")renderCart();if(id==="checkout")renderCheckout();if(id==="account")renderAccount();if(id==="admin")renderAdmin();scrollTo(0,0)}
function saveCart(){localStorage.setItem("after8-cart",JSON.stringify(cart));updateCount()}
function updateCount(){$("count").textContent=cart.reduce((s,x)=>s+x.qty,0)}
function productCard(p){return `<article class="card" onclick="showProduct('${p.id}')"><div class="pic"><img src="${(p.image ? p.image.replace(/^assets\//,"") : "product-tee.png")}" alt="${p.name}"></div><div class="meta"><span>${p.name}</span><span>${money(p.price)}</span></div></article>`}
async function loadProducts(){
  const {data,error}=await sb.from("products").select("*").eq("published",true).order("created_at",{ascending:false});
  products=(!error&&data&&data.length)?data:demoProducts;
  $("latest").innerHTML=products.slice(0,3).map(productCard).join("");
  fillFilters();renderShop();
}
function fillFilters(){
  const cats=[...new Set(products.map(p=>p.category).filter(Boolean))];
  $("cat").innerHTML='<option value="">All categories</option>'+cats.map(x=>`<option>${x}</option>`).join("");
  const sizes=[...new Set(products.flatMap(p=>p.sizes||[]))];
  $("size").innerHTML='<option value="">All sizes</option>'+sizes.map(x=>`<option>${x}</option>`).join("");
}
function renderShop(){
  const q=$("search").value.toLowerCase(),cat=$("cat").value,size=$("size").value;
  const arr=products.filter(p=>(!q||p.name.toLowerCase().includes(q))&&(!cat||p.category===cat)&&(!size||(p.sizes||[]).includes(size)));
  $("resultCount").textContent=arr.length+" items";$("products").innerHTML=arr.length?arr.map(productCard).join(""):'<p>ไม่พบสินค้า</p>';
}
function showProduct(id){
  selectedProduct=products.find(p=>p.id===id); if(!selectedProduct)return;
  selectedSize=(selectedProduct.sizes||["M"])[0];
  $("detailBox").innerHTML=`<div class="detail"><div class="gallery"><div class="pic"><img src="${selectedProduct.image ? selectedProduct.image.replace(/^assets\//,"") : "product-tee.png"}"></div><div class="pic"><img src="${selectedProduct.image||"assets/product-tee.png"}"></div></div><div><div class="ey">${selectedProduct.category||"AFTER8"}</div><h1>${selectedProduct.name}</h1><div class="price">${money(selectedProduct.price)}</div><p class="muted">${selectedProduct.description||"Premium AFTER8 garment. Relaxed fit with carefully considered details."}</p><div class="ey">SIZE</div><div class="opts">${(selectedProduct.sizes||["S","M","L","XL"]).map((s,i)=>`<button class="opt ${i===0?"active":""}" onclick="pickSize(this,'${s}')">${s}</button>`).join("")}</div><div class="stack"><button class="btn" onclick="addToCart()">Add to bag</button><button class="btn light" onclick="buyNow()">Buy now</button></div></div></div>`;
  go("detail");
}
function pickSize(el,s){document.querySelectorAll(".opt").forEach(x=>x.classList.remove("active"));el.classList.add("active");selectedSize=s}
function addToCart(){if(!selectedProduct)return;let x=cart.find(x=>x.id===selectedProduct.id&&x.size===selectedSize);if(x)x.qty++;else cart.push({id:selectedProduct.id,name:selectedProduct.name,price:selectedProduct.price,image:selectedProduct.image,size:selectedSize,qty:1});saveCart();toast("เพิ่มสินค้าในตะกร้าแล้ว")}
function buyNow(){addToCart();go("checkout")}
function renderCart(){
  if(!cart.length){$("cartBox").innerHTML='<div class="summary">ยังไม่มีสินค้าในตะกร้า<br><br><a class="btn" href="#shop">เลือกซื้อสินค้า</a></div>';return}
  const sub=cart.reduce((s,x)=>s+x.price*x.qty,0),ship=sub>=3000?0:80;
  $("cartBox").innerHTML=`<div class="layout"><div>${cart.map((x,i)=>`<div class="cartrow"><div class="pic"><img src="${x.image||"assets/product-tee.png"}"></div><div><b>${x.name}</b><div class="muted">${x.size}</div><div>${money(x.price)} × ${x.qty}</div></div><button class="textbtn" onclick="removeItem(${i})">×</button></div>`).join("")}</div><aside class="summary"><div class="sum"><span>Subtotal</span><b>${money(sub)}</b></div><div class="sum"><span>Shipping</span><span>${ship?money(ship):"FREE"}</span></div><div class="sum"><b>Total</b><b>${money(sub+ship)}</b></div><br><button class="btn" style="width:100%" onclick="go('checkout')">Checkout</button></aside></div>`;
}
function removeItem(i){cart.splice(i,1);saveCart();renderCart()}
async function renderCheckout(){
  if(!cart.length){$("checkoutBox").innerHTML="Cart is empty.";return}
  const sub=cart.reduce((s,x)=>s+x.price*x.qty,0),ship=sub>=3000?0:80;
  const user=session?.user;
  $("checkoutBox").innerHTML=`<div class="layout"><form class="form" onsubmit="placeOrder(event)"><input id="fullName" required placeholder="ชื่อ-นามสกุล"><input id="phone" required placeholder="เบอร์โทร"><textarea id="address" required placeholder="ที่อยู่"></textarea><input id="province" required placeholder="จังหวัด"><input id="postal" required placeholder="รหัสไปรษณีย์"><select id="payment"><option value="transfer">โอนเงิน</option><option value="cod">เก็บเงินปลายทาง</option></select><button class="btn" type="submit">ยืนยันคำสั่งซื้อ</button>${user?'':'<p class="muted">กรุณา Login ก่อนยืนยันคำสั่งซื้อ</p>'}</form><aside class="summary"><div class="sum"><span>Subtotal</span><b>${money(sub)}</b></div><div class="sum"><span>Shipping</span><span>${ship?money(ship):"FREE"}</span></div><div class="sum"><b>Total</b><b>${money(sub+ship)}</b></div></aside></div>`;
}
async function placeOrder(e){
  e.preventDefault();
  if(!session){toast("กรุณา Login ก่อนสั่งซื้อ");go("account");return}
  const sub=cart.reduce((s,x)=>s+x.price*x.qty,0),ship=sub>=3000?0:80,total=sub+ship;
  const {data:order,error}=await sb.from("orders").insert({user_id:session.user.id,customer_name:$("fullName").value,phone:$("phone").value,address:$("address").value,province:$("province").value,postal_code:$("postal").value,payment_method:$("payment").value,subtotal:sub,shipping:ship,total,status:$("payment").value==="transfer"?"awaiting_payment":"pending"}).select().single();
  if(error){toast(error.message);return}
  const items=cart.map(x=>({order_id:order.id,product_id:x.id.startsWith("demo-")?null:x.id,product_name:x.name,unit_price:x.price,size:x.size,quantity:x.qty}));
  const {error:itemError}=await sb.from("order_items").insert(items);
  if(itemError){toast(itemError.message);return}
  cart=[];saveCart();toast("สร้างคำสั่งซื้อแล้ว");go("home");
}
async function renderAccount(){
  $("accountStatus").textContent=session?`เข้าสู่ระบบ: ${session.user.email}`:"ยังไม่ได้เข้าสู่ระบบ";
  $("logoutBtn").style.display=session?"block":"none";
}
$("authForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error)toast(error.message);else toast("เข้าสู่ระบบสำเร็จ")});
$("signupBtn").onclick=async()=>{const {error}=await sb.auth.signUp({email:$("email").value,password:$("password").value});if(error)toast(error.message);else toast("สมัครสมาชิกแล้ว กรุณาตรวจอีเมลถ้าระบบร้องขอ")};
$("logoutBtn").onclick=async()=>{await sb.auth.signOut();toast("ออกจากระบบแล้ว")};
$("loginBtn").onclick=()=>go("account");$("cartBtn").onclick=()=>go("cart");
$("search").oninput=renderShop;$("cat").onchange=renderShop;$("size").onchange=renderShop;
async function renderAdmin(){
  if(!session){$("adminBox").innerHTML='<p>กรุณา Login ด้วยบัญชีแอดมิน</p>';return}
  const {data:profile}=await sb.from("profiles").select("role").eq("id",session.user.id).single();
  if(profile?.role!=="admin"){$("adminBox").innerHTML="<p>บัญชีนี้ไม่มีสิทธิ์ Admin</p>";return}
  const {data:orders=[]}=await sb.from("orders").select("*").order("created_at",{ascending:false}).limit(50);
  $("adminBox").innerHTML=`<div class="adminstat"><div class="stat">ORDERS<strong>${orders.length}</strong></div><div class="stat">SALES<strong>${money(orders.reduce((s,o)=>s+Number(o.total||0),0))}</strong></div><div class="stat">PRODUCTS<strong>${products.length}</strong></div><div class="stat">STATUS<strong>LIVE</strong></div></div><table class="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${orders.map(o=>`<tr><td>${o.id.slice(0,8)}</td><td>${o.customer_name}</td><td>${money(o.total)}</td><td>${o.payment_method}</td><td><select onchange="setOrderStatus('${o.id}',this.value)"><option ${o.status==="pending"?"selected":""}>pending</option><option ${o.status==="awaiting_payment"?"selected":""}>awaiting_payment</option><option ${o.status==="preparing"?"selected":""}>preparing</option><option ${o.status==="shipped"?"selected":""}>shipped</option><option ${o.status==="completed"?"selected":""}>completed</option><option ${o.status==="cancelled"?"selected":""}>cancelled</option></select></td></tr>`).join("")}</tbody></table>`;
}
async function setOrderStatus(id,status){const {error}=await sb.from("orders").update({status}).eq("id",id);toast(error?error.message:"อัปเดตสถานะแล้ว")}
sb.auth.onAuthStateChange((_e,s)=>{session=s;renderAccount()});
window.addEventListener("hashchange",()=>{const id=location.hash.replace("#","")||"home";go(["home","shop","detail","cart","checkout","account","contact","admin"].includes(id)?id:"home")});
updateCount();
if(SUPABASE_URL.startsWith("http")) loadProducts(); else {products=demoProducts;$("latest").innerHTML=products.map(productCard).join("");fillFilters();renderShop();toast("โหมดตัวอย่าง: ใส่ Supabase URL/Key ก่อนใช้งานจริง")}
