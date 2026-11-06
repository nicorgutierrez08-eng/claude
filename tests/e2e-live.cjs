// End-to-end test of Movi against a real Supabase project: two users follow, like, comment,
// recommend, go private and approve requests. Use a local stack (supabase start) or a test project.
// Run: cd docs && python3 -m http.server 8765
//      cd tests && npm install && SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run e2e:live
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const SH = path.join(__dirname, 'screenshots', 'live'), CDN = path.join(__dirname, 'screenshots', 'cdn-cache'), BASE = process.env.MOVI_URL || 'http://127.0.0.1:8765/';
fs.mkdirSync(SH, { recursive: true }); fs.mkdirSync(CDN, { recursive: true });
const SB_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321', ANON = process.env.SUPABASE_ANON_KEY;
if (!ANON) { console.error('Set SUPABASE_ANON_KEY (and SUPABASE_URL)'); process.exit(1); }
const T = Date.now() % 100000;
const errors = [];
const log = (...a) => console.log(...a);
async function newUser(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'application/javascript', body: `window.MOVI_CONFIG={supabaseUrl:"${SB_URL}",supabaseAnonKey:"${ANON}"};` }));
  // Only needed where the browser has no direct internet access: fetch the CDN through curl instead.
  if (process.env.MOVI_CDN_VIA_CURL) await ctx.route('https://cdn.jsdelivr.net/**', r => {
    const url = r.request().url();
    const f = path.join(CDN, crypto.createHash('md5').update(url).digest('hex'));
    if (!fs.existsSync(f)) fs.writeFileSync(f, execFileSync('curl', ['-sSL', '-m', '60', url]));
    r.fulfill({ contentType: 'application/javascript; charset=utf-8', body: fs.readFileSync(f), headers: { 'access-control-allow-origin': '*' } });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(name + ' pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errors.push(name + ' console: ' + m.text()); });
  return page;
}
const step = async (name, page, fn) => { try { await fn(); log('ok', name); } catch (e) { log('FAIL', name, e.message.split('\n')[0]); errors.push(name + ': ' + e.message.split('\n')[0]); await page.screenshot({ path: `${SH}/fail-${name.replace(/\W+/g, '_')}.png` }); } };
async function signUp(page, name, user) {
  await page.goto(BASE);
  await page.waitForSelector('.welcome', { timeout: 20000 });
  if (await page.$('.demo-note')) throw new Error('still in demo mode');
  await page.fill('[name=display_name]', name);
  await page.fill('[name=username]', user);
  await page.fill('[name=email]', `${user}@test.dev`);
  await page.fill('[name=password]', 'secret123');
  await page.click('#auth-go');
  await page.waitForSelector('.ob h1', { timeout: 15000 });
}
async function rankFirst(page, sel, feel = 'loved') {
  await page.click(sel);
  await page.waitForSelector('.feel');
  await page.click(`.feel.${feel}`);
  for (let g = 0; g < 10 && await page.$('#pick-new'); g++) { await page.click(g % 2 ? '#pick-old' : '#pick-new'); await page.waitForTimeout(350); }
  await page.waitForSelector('.big-score', { timeout: 10000 });
  await page.fill('#flow [name=note]', 'note from ' + feel);
  await page.click('[data-act="flow-done"]');
  await page.waitForTimeout(600);
}
(async () => {
  const browser = await chromium.launch();
  const A = await newUser(browser, 'alice'), B = await newUser(browser, 'bob');
  const ua = 'alice' + T, ub = 'bob' + T;
  await step('alice signup', A, () => signUp(A, 'Alice Live', ua));
  await step('alice ranks 3', A, async () => {
    for (const f of ['loved', 'loved', 'fine']) { await rankFirst(A, '.ob [data-act="rank"]', f); await A.waitForSelector('.ob h1'); }
    await A.click('[data-act="ob-next"]');
    await A.waitForTimeout(800);
    await A.click('[data-act="ob-done"]');
    await A.waitForSelector('.post', { timeout: 10000 });
  });
  await A.screenshot({ path: `${SH}/a-feed.png` });
  await step('bob signup + follow alice', B, async () => {
    await signUp(B, 'Bob Live', ub);
    await B.click('.ob [data-act="rank"]'); await B.waitForSelector('.feel'); await B.click('.feel.loved');
    await B.waitForSelector('.big-score'); await B.click('[data-act="flow-done"]'); await B.waitForTimeout(600);
    await B.click('[data-act="ob-next"]');
    await B.waitForSelector('#ob-people .urow');
    const row = B.locator('#ob-people .urow', { hasText: '@' + ua });
    await row.locator('[data-act="follow"]').click();
    await row.locator('[data-act="unfollow"]').waitFor();
    await B.click('[data-act="ob-done"]');
    await B.waitForSelector('.post', { timeout: 10000 });
  });
  await step('bob sees alice posts + likes + comments', B, async () => {
    const post = B.locator('.post', { hasText: 'Alice Live' }).first();
    await post.waitFor();
    await post.locator('[data-act=like]').click();
    await B.waitForTimeout(500);
    await post.locator('[data-act=comments]').click();
    await post.locator('.cmt-form input').fill('Nice ranking Alice');
    await post.locator('.cmt-form button').click();
    await post.locator('.cmt', { hasText: 'Nice ranking Alice' }).waitFor();
  });
  await B.screenshot({ path: `${SH}/b-feed.png` });
  await step('bob film sheet shows alice score + recommends', B, async () => {
    const post = B.locator('.post', { hasText: 'Alice Live' }).first();
    await post.locator('.pposter').click();
    await B.waitForSelector('.panel .who', { timeout: 10000 });
    await B.waitForSelector('.panel .statline b');
    await B.screenshot({ path: `${SH}/b-sheet.png` });
    await B.keyboard.press('Escape');
    await B.click('[data-act="quick-add"]');
    await B.fill('#qa', 'inception');
    await B.waitForTimeout(300);
    await B.click('.qa-row');
    await B.waitForSelector('.feel');
    await B.keyboard.press('Escape');
    await B.goto(BASE + '#/film/12');
    await B.waitForSelector('.panel [data-act="recommend"]');
    await B.click('.panel [data-act="recommend"]');
    await B.waitForSelector('.pick-people .pp');
    await B.click('.pick-people .pp');
    await B.fill('#rec-msg', 'Watch this Alice');
    await B.click('#rec-send');
    await B.waitForSelector('#modal[hidden]', { state: 'attached' });
  });
  await step('alice notifications', A, async () => {
    await A.goto(BASE + '#/notifications');
    await A.waitForSelector('.note-row');
    const t = await A.textContent('.notes');
    for (const w of ['started following you', 'liked your ranking', 'commented', 'recommended']) if (!t.includes(w)) throw new Error('missing ' + w + ' in ' + t);
  });
  await A.screenshot({ path: `${SH}/a-notifications.png` });
  await step('alice recs tab', A, async () => {
    await A.goto(BASE + '#/lists/recs');
    await A.waitForSelector('.rec');
    if (!(await A.textContent('.rec')).includes('Watch this Alice')) throw new Error('rec msg');
    await A.click('.rec [data-act="watch-from"]');
    await A.goto(BASE + '#/lists/want');
    await A.waitForSelector('.card');
  });
  await step('alice goes private, bob refollows pending, alice approves', A, async () => {
    await A.goto(BASE + '#/settings');
    await A.check('[name=is_private]');
    await A.click('#prof-form .btn.primary');
    await A.waitForTimeout(800);
    await B.goto(BASE + `#/u/${ua}`);
    await B.waitForSelector('.phead [data-act="unfollow"]');
    B.once('dialog', d => d.accept());
    await B.click('.phead [data-act="unfollow"]');
    await B.click('#dlg-ok');
    await B.waitForSelector('.phead [data-act="follow"]');
    await B.goto(BASE + `#/u/${ua}`);
    await B.waitForSelector('.empty h3');
    if (!(await B.textContent('.empty h3')).includes('private')) throw new Error('not private for bob');
    await B.click('.phead [data-act="follow"]');
    await B.waitForSelector('.phead [data-act="unfollow"]');
    if (!(await B.textContent('.phead [data-act="unfollow"]')).includes('Requested')) throw new Error('not requested');
    await A.goto(BASE + '#/notifications');
    await A.waitForSelector('[data-act="approve"]');
    await A.click('[data-act="approve"]');
    await A.waitForTimeout(800);
    await B.goto(BASE + `#/u/${ua}/rankings`);
    await B.waitForSelector('.rowi', { timeout: 10000 });
  });
  await step('leaderboard + taste + compare', B, async () => {
    await B.goto(BASE + '#/leaderboard');
    await B.waitForSelector('.board li.me');
    await B.goto(BASE + `#/u/${ua}/compare`);
    await B.waitForSelector('.compare-hero');
    await B.goto(BASE + `#/u/${ub}/taste`);
    await B.waitForSelector('.badges');
  });
  await step('alice re-rank + remove + persisted after reload', A, async () => {
    await A.goto(BASE + '#/lists/been');
    await A.waitForSelector('.rowi');
    await A.click('.rowi');
    await A.waitForSelector('.panel [data-act="remove"]');
    await A.click('.panel [data-act="remove"]');
    await A.click('#dlg-ok');
    await A.waitForTimeout(800);
    await A.reload();
    await A.goto(BASE + '#/lists/been');
    await A.waitForSelector('.rowi');
    const n = await A.$$eval('.rowi', e => e.length);
    if (n !== 2) throw new Error('rows after remove ' + n);
  });
  await step('bob delete account', B, async () => {
    await B.goto(BASE + '#/settings');
    await B.click('[data-act="delete-account"]');
    await B.click('#dlg-ok');
    await B.waitForSelector('.welcome', { timeout: 10000 });
    await A.goto(BASE + `#/u/${ub}`);
    await A.waitForSelector('.empty h3');
  });
  log('ERRORS', JSON.stringify(errors, null, 1));
  process.exitCode = errors.length ? 1 : 0;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
