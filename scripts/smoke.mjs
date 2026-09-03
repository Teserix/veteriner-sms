// Kullanım: boş DATA_DIR ile açılmış sunucuya karşı. Ortam: SMOKE_BASE, SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD
const BASE = process.env.SMOKE_BASE || 'http://localhost:3199';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'Admin12345';
const jar = {};
function cookieHeader() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); }
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i); const v = kv.slice(i + 1);
    const maxAge = /Max-Age=(\d+)/.exec(c);
    if (maxAge && maxAge[1] === '0') delete jar[k]; else jar[k] = v;
  }
}
async function get(path) {
  const res = await fetch(BASE + path, { headers: { cookie: cookieHeader() }, redirect: 'manual' });
  storeCookies(res); const text = await res.text();
  return { status: res.status, location: res.headers.get('location'), text };
}
async function post(path, data, extraHeaders = {}) {
  const body = new URLSearchParams(data).toString();
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader(), origin: BASE, ...extraHeaders }, body, redirect: 'manual' });
  storeCookies(res); const text = await res.text();
  return { status: res.status, location: res.headers.get('location'), text };
}
const csrfOf = (html) => /name="_csrf" value="([^"]+)"/.exec(html)?.[1];
let fails = 0;
function check(name, cond, extra = '') { console.log((cond ? 'OK   ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); if (!cond) fails++; }

// 1) login CSRF: post without pre-token
let r = await post('/giris', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
check('login without pre-token -> 403', r.status === 403, r.status);
// 2) proper login
r = await get('/giris');
let token = csrfOf(r.text);
check('login page has pre token', Boolean(token));
r = await post('/giris', { _csrf: token, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, next: '/' });
check('superadmin login -> redirect /admin', r.status === 302 && r.location === '/admin', `${r.status} ${r.location}`);
r = await get('/admin');
check('GET /admin 200', r.status === 200, r.status);
let csrf = csrfOf(r.text);
// 3) CSRF failure renders 403 page (not 500)
r = await post('/admin/klinik', { _csrf: 'bad', clinic_name: 'X' });
check('bad csrf -> 403 page', r.status === 403 && r.text.includes('Güvenlik hatası'), r.status);
// 4) create clinic
r = await post('/admin/klinik', { _csrf: csrf, clinic_name: 'Pati Veteriner', clinic_phone: '0212 555 11 22', admin_name: 'Dr. Ayşe', admin_email: 'ayse@pati.test', admin_password: 'Gecici123' });
check('create clinic -> 302 /admin', r.status === 302 && r.location.startsWith('/admin?ok='), `${r.status} ${r.location}`);
r = await get('/admin');
const clinicId = /tenants\/([a-f0-9]{12})\.db/.exec(r.text)?.[1];
check('clinic listed with id', Boolean(clinicId), '');
// superadmin cannot see clinic pages
r = await get('/');
check('superadmin GET / -> redirect /admin', r.status === 302 && r.location === '/admin', `${r.status} ${r.location}`);
r = await get('/sahipler');
check('superadmin GET /sahipler -> redirect /admin', r.status === 302 && r.location === '/admin', `${r.status} ${r.location}`);
// logout
r = await post('/cikis', { _csrf: csrf });
check('logout', r.status === 302);
// 5) clinic admin login -> must change password
r = await get('/giris'); token = csrfOf(r.text);
r = await post('/giris', { _csrf: token, email: 'ayse@pati.test', password: 'Gecici123', next: '/' });
check('clinic admin login -> /sifre (must change)', r.status === 302 && r.location.startsWith('/sifre'), `${r.status} ${r.location}`);
r = await get('/');
check('gate redirects to /sifre', r.status === 302 && r.location.startsWith('/sifre'), `${r.status} ${r.location}`);
r = await get('/sifre'); csrf = csrfOf(r.text);
check('GET /sifre 200', r.status === 200, r.status);
r = await post('/sifre', { _csrf: csrf, current: 'Gecici123', password: 'YeniSifre123', password2: 'YeniSifre123' });
check('password change -> /', r.status === 302 && r.location.startsWith('/?ok='), `${r.status} ${r.location}`);
r = await get('/'); csrf = csrfOf(r.text);
check('dashboard 200', r.status === 200 && r.text.includes('Özet'), r.status);
check('dashboard shows clinic name', r.text.includes('Pati Veteriner'));
// 6) quick entry: due today, notify 0
const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
r = await post('/hizli-kayit', { _csrf: csrf, owner_name: 'Mehmet Kaya', phone: '0532 123 45 67', pet_name: 'Boncuk', species: 'Kedi', add_reminder: '1', type: 'asi', title: 'Kuduz aşısı', due_date: today, notify_days_before: '0', sms_opt_in: '1' });
check('quick entry -> /sahipler/1', r.status === 302 && r.location.startsWith('/sahipler/1'), `${r.status} ${r.location}`);
r = await get('/sahipler/1');
check('owner detail 200 with phone formatted', r.status === 200 && r.text.includes('0532 123 45 67'), r.status);
r = await get('/');
check('dashboard lists due today', r.text.includes('Bugün SMS') && r.text.includes('Mehmet Kaya'));
// duplicate phone -> add pet to existing
r = await post('/hizli-kayit', { _csrf: csrf, owner_name: 'Mehmet Kaya', phone: '05321234567', pet_name: 'Zeytin', species: 'Köpek', add_reminder: '0' });
check('quick entry dup phone -> same owner', r.status === 302 && r.location.startsWith('/sahipler/1'), `${r.status} ${r.location}`);
// 7) manual send
r = await post('/hatirlatmalar/1/gonder', { _csrf: csrf }, { referer: BASE + '/sahipler/1?ok=x' });
check('manual send -> redirect back with ok', r.status === 302 && r.location.startsWith('/sahipler/1?ok=') && !r.location.includes('ok=x'), `${r.status} ${r.location}`);
r = await get('/sms');
check('/sms shows sent row', r.status === 200 && r.text.includes('Gönderildi') && r.text.includes('Mehmet Kaya'), r.status);
// resend blocked
r = await post('/hatirlatmalar/1/gonder', { _csrf: csrf });
check('second send blocked', r.location.includes('err='), r.location);
// 8) open redirect protection
r = await post('/hatirlatmalar/1/durum', { _csrf: csrf, status: 'done' }, { referer: 'https://evil.example/x' });
check('evil referer ignored', r.status === 302 && r.location.startsWith('/sahipler/1'), r.location);
// 9) settings page + save + test sms
r = await get('/ayarlar'); csrf = csrfOf(r.text);
check('settings 200', r.status === 200 && r.text.includes('İleti Merkezi'), r.status);
r = await post('/ayarlar', { _csrf: csrf, clinic_name: 'Pati Veteriner', clinic_phone: '0212', template: 'Sayın {sahip}, {hayvan} için {tarih} {tur}. {klinik}', scheduler_enabled: '1', send_hour_start: '9', send_hour_end: '20', daily_sms_limit: '2', sms_provider: 'netgsm', sms_sender: 'PATI VET', cred_netgsm_usercode: 'u', cred_netgsm_password: 'p' });
check('settings save', r.status === 302 && r.location.includes('ok='), r.location);
r = await get('/ayarlar');
check('credentials marked saved', r.text.includes('kayıtlı'));
r = await post('/ayarlar', { _csrf: csrf, clinic_name: 'Pati', clinic_phone: '', template: 'x', scheduler_enabled: '1', send_hour_start: '9', send_hour_end: '20', daily_sms_limit: '2', sms_provider: 'console', sms_sender: '' });
r = await post('/ayarlar/test', { _csrf: csrf, phone: '05001112233' });
check('test sms ok (console)', r.location.includes('ok='), r.location);
r = await post('/ayarlar/test', { _csrf: csrf, phone: '05001112233' });
check('daily cap reached (limit 2: 1 reminder + 1 test)', r.location.includes('err=') && decodeURIComponent(r.location).includes('sınır'), decodeURIComponent(r.location));
// 10) users: create staff, login as staff, check 403s
r = await get('/kullanicilar'); csrf = csrfOf(r.text);
check('users page 200', r.status === 200, r.status);
r = await post('/kullanicilar', { _csrf: csrf, name: 'Personel', email: 'staff@pati.test', password: 'Staff1234', role: 'staff' });
check('create staff', r.status === 302 && r.location.includes('ok='), r.location);
r = await post('/cikis', { _csrf: csrf });
r = await get('/giris'); token = csrfOf(r.text);
r = await post('/giris', { _csrf: token, email: 'staff@pati.test', password: 'Staff1234' });
r = await get('/sifre'); csrf = csrfOf(r.text);
r = await post('/sifre', { _csrf: csrf, current: 'Staff1234', password: 'Staff12345', password2: 'Staff12345' });
r = await get('/'); csrf = csrfOf(r.text);
check('staff dashboard 200', r.status === 200, r.status);
r = await get('/kullanicilar');
check('staff /kullanicilar -> 403', r.status === 403, r.status);
r = await get('/ayarlar');
check('staff /ayarlar -> 403', r.status === 403, r.status);
r = await get('/admin');
check('staff /admin -> 403', r.status === 403, r.status);
r = await post('/sahipler/1/sil', { _csrf: csrf });
check('staff delete owner -> 403', r.status === 403, r.status);
r = await get('/sahipler/1');
check('staff sees owner', r.status === 200 && !r.text.includes('>Sil<'), r.status);
r = await get('/yok-boyle-sayfa');
check('404 page', r.status === 404, r.status);
r = await get('/sahipler?q=%25');
check('LIKE wildcard search safe', r.status === 200 && !r.text.includes('Mehmet Kaya'), r.status);
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
