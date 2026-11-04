const $ = s => document.querySelector(s), rs = n => '₹' + n;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const UPI = '9213709770-1@okbizaxis', PN = 'AMIT PAHAWA', WA = '919911960961';
const UL = `upi://pay?pa=${UPI}&pn=${encodeURIComponent(PN)}&cu=INR`;
let menu = [], cart = {}, flt = 'all', st = { paused: 0, msg: '' };

const api = async (p, b) => {
  const r = await fetch('/api/' + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-pin': sessionStorage.pin || '' }, body: b ? JSON.stringify(b) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
};
const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
const total = () => menu.reduce((s, m) => s + (cart[m.id] || 0) * m.price, 0);

/* ---------- menu ---------- */
const row = m => `<div class="it"><i class="dot ${m.type}"></i><div class="nm">${esc(m.name)}<span class="heat">${'🌶'.repeat(m.heat)}</span></div><b>${rs(m.price)}</b>` +
  (cart[m.id] ? `<span class="st"><button data-d="-1" data-i="${m.id}">−</button>${cart[m.id]}<button data-d="1" data-i="${m.id}">+</button></span>` : `<button class="add" data-d="1" data-i="${m.id}">Add</button>`) + '</div>';
function renderMenu() {
  const cats = [...new Set(menu.map(m => m.category))];
  $('#list').innerHTML = cats.map(c => {
    const it = menu.filter(m => m.category === c && (flt === 'all' || m.type === flt));
    return it.length ? `<h3>${esc(c)}</h3>` + it.map(row).join('') : '';
  }).join('') || '<p class="mu">No items to show yet.</p>';
  bar();
}
function bar() {
  $('#cb').hidden = !(count() > 0 && !st.paused && location.hash === '#menu');
  $('#cb span').textContent = `${count()} items · ${rs(total())}`;
}
$('#list').onclick = e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const i = +b.dataset.i; cart[i] = (cart[i] || 0) + +b.dataset.d;
  if (cart[i] <= 0) delete cart[i];
  renderMenu();
};
document.querySelectorAll('.chip').forEach(c => c.onclick = () => {
  flt = c.dataset.f; document.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); renderMenu();
});
async function load() {
  try {
    const d = await api('menu'); menu = d.menu; st = d;
    $('#pb').hidden = !d.paused; $('#pb').textContent = d.msg || 'Orders are paused right now. Please check back soon.';
  } catch (x) { $('#list').innerHTML = `<p class="err">${esc(x.message)}</p>`; return; }
  renderMenu();
}

/* ---------- checkout ---------- */
$('#vo').onclick = () => {
  const ls = menu.filter(m => cart[m.id]);
  $('#co').innerHTML = `<h3>Your order</h3>${ls.map(m => `<div>${cart[m.id]} × ${esc(m.name)} <span class="mu">${rs(cart[m.id] * m.price)}</span></div>`).join('')}
  <p class="tot">Total ${rs(total())}</p>
  <input id="nm" placeholder="Your name" autocomplete="name"><input id="ph" placeholder="Phone number" inputmode="tel" autocomplete="tel">
  <select id="mode"><option>Dine-in</option><option>Packing</option></select>
  <select id="pay"><option value="Cash">Pay cash at the shop</option><option value="UPI">Pay with UPI</option></select>
  <input id="note" placeholder="Note (optional), like less spicy"><p id="err" class="err"></p>
  <button class="pri" id="go">Place order</button><button class="ghost" id="x">Close</button>`;
  $('#co').showModal();
};
$('#co').onclick = async e => {
  if (e.target.id === 'x') return $('#co').close();
  if (e.target.id !== 'go') return;
  const d = { name: $('#nm').value, phone: $('#ph').value, mode: $('#mode').value, pay: $('#pay').value, note: $('#note').value, items: Object.entries(cart).map(([i, q]) => ({ id: +i, qty: q })) };
  const lines = menu.filter(m => cart[m.id]).map(m => `${cart[m.id]} x ${m.name}`).join('\n');
  e.target.disabled = true;
  try { const r = await api('order', d); cart = {}; renderMenu(); done(r, d, lines); }
  catch (x) { $('#err').textContent = x.message; e.target.disabled = false; }
};
function done(r, d, lines) {
  const link = `upi://pay?pa=${UPI}&pn=${encodeURIComponent(PN)}&am=${r.total}&cu=INR&tn=${r.id}`;
  const wa = `https://wa.me/${WA}?text=` + encodeURIComponent(`Spicy order ${r.id}\n${lines}\nTotal: ${rs(r.total)}\n${d.mode}, paying by ${d.pay}\nName: ${d.name}, Phone: ${d.phone}`);
  $('#co').innerHTML = `<h3>Order ${r.id} placed</h3><p>Total ${rs(r.total)}. ${d.pay === 'UPI' ? 'Pay with UPI now and show the payment screen at the counter. Staff will verify it.' : 'Pay cash at the shop.'}</p>` +
    (d.pay === 'UPI' ? `<a class="pri" href="${link}">Pay ${rs(r.total)} in your UPI app</a><div id="qr" class="qr"></div>` : '') +
    `<a class="pri" href="${wa}" target="_blank" rel="noopener">Send order on WhatsApp</a><button class="ghost" id="x">Close</button>`;
  if (d.pay === 'UPI' && window.QRCode) new QRCode($('#qr'), { text: link, width: 180, height: 180 });
}

/* ---------- UPI tab ---------- */
$('#cp').onclick = async () => { try { await navigator.clipboard.writeText(UPI); $('#cp').textContent = 'Copied'; } catch (x) { $('#cp').textContent = UPI; } };

/* ---------- staff ---------- */
const oc = o => {
  const it = JSON.parse(o.items), t = new Date(o.created.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const pay = o.pay_status === 'unpaid'
    ? `<button data-o="${o.id}" data-ps="Cash received">Cash received</button><button data-o="${o.id}" data-ps="UPI verified">UPI verified</button>`
    : `<button data-o="${o.id}" data-ps="unpaid">Undo payment</button>`;
  return `<div class="card o${o.status === 'done' ? ' dn' : ''}"><b>${o.id}</b> · ${esc(o.name)} · <a href="tel:${o.phone}">${o.phone}</a>
  <div class="mu">${t} · ${o.mode} · chose ${o.pay_method}</div>${it.map(l => `<div>${l.q} × ${esc(l.n)}</div>`).join('')}
  ${o.note ? `<div class="mu">Note: ${esc(o.note)}</div>` : ''}<div class="tot">${rs(o.total)} · ${o.pay_status}</div>
  <div class="btns">${pay}<button data-o="${o.id}" data-st="${o.status === 'done' ? 'new' : 'done'}">${o.status === 'done' ? 'Reopen' : 'Mark done'}</button></div></div>`;
};
const mr = m => `<div class="mr" data-id="${m.id}"><i class="dot ${m.type}"></i><input class="mn" value="${esc(m.name)}"><input class="mp" type="number" value="${m.price}"><label><input type="checkbox" class="ma" ${m.active ? 'checked' : ''}> Show</label><button class="sv">Save</button></div>`;
async function staff(first) {
  try {
    const o = await api('staff/orders');
    $('#sl').hidden = true; $('#sd').hidden = false;
    $('#pz').textContent = o.paused ? 'Orders are paused. Tap to resume' : 'Orders are open. Tap to pause';
    $('#pz').dataset.p = o.paused; if (first) $('#pm').value = o.msg;
    $('#ord').innerHTML = o.orders.map(oc).join('') || '<p class="mu">No orders yet.</p>';
    if (first) menuEd();
  } catch (x) { sessionStorage.removeItem('pin'); $('#sl').hidden = false; $('#sd').hidden = true; if (first) $('#lerr').textContent = x.message; }
}
async function menuEd() {
  const d = await api('staff/menu');
  $('#mn').innerHTML = d.menu.map(mr).join('');
  $('#cats').innerHTML = [...new Set(d.menu.map(m => m.category))].map(c => `<option value="${esc(c)}">`).join('');
}
$('#login').onclick = () => { sessionStorage.pin = $('#pin').value; staff(true); };
$('#sd').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.o) { await api('staff/order', { id: b.dataset.o, pay_status: b.dataset.ps, status: b.dataset.st }); staff(); }
    else if (b.id === 'pz') { await api('staff/pause', { paused: +b.dataset.p ? 0 : 1, msg: $('#pm').value }); staff(); load(); }
    else if (b.classList.contains('sv')) {
      const r = b.closest('.mr');
      await api('staff/menu', { id: +r.dataset.id, name: r.querySelector('.mn').value, price: +r.querySelector('.mp').value, active: r.querySelector('.ma').checked });
      b.textContent = 'Saved'; setTimeout(() => (b.textContent = 'Save'), 1500); load();
    } else if (b.id === 'add') {
      if (!$('#an').value.trim() || !+$('#ap').value) return alert('Enter the item name and price.');
      await api('staff/menu', { name: $('#an').value, category: $('#ac').value || 'Other', type: $('#at').value, price: +$('#ap').value, heat: 0 });
      ['#an', '#ac', '#ap'].forEach(s => ($(s).value = '')); menuEd(); load();
    }
  } catch (x) { alert(x.message); }
};

/* ---------- tabs ---------- */
function route() {
  const h = location.hash.slice(1), id = ['home', 'menu', 'upi', 'contact', 'staff'].includes(h) ? h : 'home';
  document.querySelectorAll('main>section').forEach(s => (s.hidden = s.id !== id));
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
  if (id === 'upi' && !$('#sq').children.length && window.QRCode) new QRCode($('#sq'), { text: UL, width: 200, height: 200 });
  if (id === 'staff' && sessionStorage.pin) staff(true);
  bar(); scrollTo(0, 0);
}
addEventListener('hashchange', route);
setInterval(() => { if (location.hash === '#staff' && sessionStorage.pin && !$('#sd').hidden) staff(); }, 20000);
load(); route();
