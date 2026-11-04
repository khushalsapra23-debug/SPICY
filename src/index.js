const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
const sett = async db => {
  const o = {};
  (await db.prepare('SELECT k,v FROM settings').all()).results.forEach(x => (o[x.k] = x.v));
  return { paused: +o.paused || 0, msg: o.msg || '' };
};

export default {
  async fetch(q, e) {
    const p = new URL(q.url).pathname, m = q.method, db = e.DB;
    if (!p.startsWith('/api/')) return e.ASSETS.fetch(q);
    try {
      if (p === '/api/menu')
        return J({ menu: (await db.prepare('SELECT * FROM menu WHERE active=1 AND price>0 ORDER BY sort,id').all()).results, ...(await sett(db)) });

      if (p === '/api/order' && m === 'POST') {
        const b = await q.json(), s = await sett(db);
        if (s.paused) return J({ error: s.msg || 'Orders are paused right now.' }, 503);
        const name = String(b.name || '').trim().slice(0, 60), phone = String(b.phone || '').replace(/\D/g, '').slice(-10);
        if (!name || phone.length !== 10) return J({ error: 'Enter your name and a 10-digit phone number.' }, 400);
        const rows = (await db.prepare('SELECT id,name,price FROM menu WHERE active=1 AND price>0').all()).results;
        const by = Object.fromEntries(rows.map(r => [r.id, r]));
        let total = 0; const lines = [];
        for (const i of (b.items || []).slice(0, 40)) {
          const r = by[i.id], n = Math.min(20, Math.max(1, i.qty | 0));
          if (r) { total += r.price * n; lines.push({ n: r.name, q: n, p: r.price }); }
        }
        if (!lines.length) return J({ error: 'Your cart is empty or those items are no longer available.' }, 400);
        const id = 'SP' + Math.random().toString(36).slice(2, 7).toUpperCase();
        await db.prepare('INSERT INTO orders(id,name,phone,mode,pay_method,items,total,note) VALUES(?,?,?,?,?,?,?,?)')
          .bind(id, name, phone, b.mode === 'Packing' ? 'Packing' : 'Dine-in', b.pay === 'UPI' ? 'UPI' : 'Cash', JSON.stringify(lines), total, String(b.note || '').slice(0, 200)).run();
        return J({ id, total });
      }

      if (p.startsWith('/api/staff/')) {
        if (!e.STAFF_PIN || q.headers.get('x-pin') !== e.STAFF_PIN) return J({ error: 'Wrong PIN' }, 401);
        const b = m === 'POST' ? await q.json() : {};
        if (p === '/api/staff/orders')
          return J({ orders: (await db.prepare('SELECT * FROM orders ORDER BY created DESC LIMIT 100').all()).results, ...(await sett(db)) });
        if (p === '/api/staff/order') {
          await db.prepare('UPDATE orders SET pay_status=COALESCE(?,pay_status),status=COALESCE(?,status) WHERE id=?').bind(b.pay_status ?? null, b.status ?? null, b.id).run();
          return J({ ok: 1 });
        }
        if (p === '/api/staff/menu' && m === 'GET')
          return J({ menu: (await db.prepare('SELECT * FROM menu ORDER BY sort,id').all()).results });
        if (p === '/api/staff/menu') {
          if (b.id) await db.prepare('UPDATE menu SET name=?,price=?,active=? WHERE id=?').bind(String(b.name).slice(0, 80), b.price | 0, b.active ? 1 : 0, b.id).run();
          else await db.prepare('INSERT INTO menu(name,category,type,heat,price,active,sort) VALUES(?,?,?,?,?,1,999)')
            .bind(String(b.name).slice(0, 80), String(b.category || 'Other').slice(0, 40), b.type === 'nonveg' ? 'nonveg' : 'veg', b.heat | 0, b.price | 0).run();
          return J({ ok: 1 });
        }
        if (p === '/api/staff/pause') {
          await db.prepare("REPLACE INTO settings(k,v) VALUES('paused',?),('msg',?)").bind(b.paused ? '1' : '0', String(b.msg || '').slice(0, 200)).run();
          return J({ ok: 1 });
        }
      }
      return J({ error: 'Not found' }, 404);
    } catch (x) {
      return J({ error: 'Server error. Please try again.' }, 500);
    }
  }
};
