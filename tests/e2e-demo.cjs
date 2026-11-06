// End-to-end test of Movi in demo mode (no server).
// Run: cd docs && python3 -m http.server 8765   then   cd tests && npm install && npm run e2e:demo
const { chromium } = require('playwright');
const SH = require('path').join(__dirname, 'screenshots', 'demo'), BASE = process.env.MOVI_URL || 'http://127.0.0.1:8765/';
require('fs').mkdirSync(SH, { recursive: true });
const log = (...a) => console.log(...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = (n, full = false) => page.screenshot({ path: `${SH}/${n}.png`, fullPage: full });
  const step = async (name, fn) => { try { await fn(); log('ok', name); } catch (e) { log('FAIL', name, e.message.split('\n')[0]); errors.push(name + ': ' + e.message.split('\n')[0]); await shot('fail-' + name.replace(/\W+/g, '_')); } };

  await page.goto(BASE);
  await step('welcome shows', () => page.waitForSelector('.welcome', { timeout: 15000 }));
  await shot('01-welcome');
  await step('signup', async () => {
    await page.fill('[name=display_name]', 'Nico Test');
    await page.waitForTimeout(400);
    const u = await page.inputValue('[name=username]');
    if (u !== 'nicotest') throw new Error('auto username ' + u);
    await page.fill('[name=email]', 'nico@test.dev');
    await page.fill('[name=password]', 'secret123');
    await page.click('#auth-go');
    await page.waitForSelector('.ob h1', { timeout: 8000 });
  });
  await shot('02-onboarding');
  await step('onboarding rank 3', async () => {
    const feels = ['loved', 'loved', 'fine'];
    for (const f of feels) {
      await page.click('.ob [data-act="rank"]');
      await page.waitForSelector('.feel');
      await page.click(`.feel.${f}`);
      for (let g = 0; g < 10 && await page.$('#pick-new'); g++) { await page.click(g % 2 ? '#pick-old' : '#pick-new'); await page.waitForTimeout(330); }
      await page.waitForSelector('.big-score');
      await page.click('[data-where="Theater"]');
      await page.fill('#flow [name=note]', 'Test note ' + f);
      await page.click('[data-act="flow-done"]');
      await page.waitForSelector('.ob h1');
      await page.waitForTimeout(150);
    }
    await page.click('[data-act="ob-next"]');
    await page.waitForSelector('#ob-people .urow');
  });
  await shot('03-onboarding-people');
  await step('follow 3 people', async () => {
    for (let i = 0; i < 3; i++) { await page.click('#ob-people [data-act="follow"]'); await page.waitForTimeout(200); }
    await page.click('[data-act="ob-done"]');
    await page.waitForSelector('.post', { timeout: 8000 });
  });
  await shot('04-feed');
  await step('like + comment', async () => {
    const other = await page.$('.post:not(:has([data-act=delete-post]))');
    await (await other.$('[data-act=like]')).click();
    await (await other.$('[data-act=comments]')).click();
    await other.waitForSelector('.cmt-form input');
    await (await other.$('.cmt-form input')).fill('Great pick!');
    await (await other.$('.cmt-form button')).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.cmt')].some(c => c.textContent.includes('Great pick!')));
  });
  await shot('05-feed-comment');
  await step('own posts in feed', async () => {
    const n = await page.$$eval('.post [data-act=delete-post]', e => e.length);
    if (n < 3) throw new Error('own posts ' + n);
  });
  await step('demo reactions -> notifications', async () => {
    await page.waitForTimeout(9000);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('movi:unread')));
    await page.goto(BASE + '#/notifications');
    await page.waitForSelector('.note-row', { timeout: 8000 });
  });
  await shot('06-notifications');
  await step('discover', async () => {
    await page.goto(BASE + '#/discover');
    await page.waitForSelector('#quick .card');
    await page.waitForSelector('#top-movi .card', { timeout: 8000 });
    await page.waitForSelector('#friends-trending .card', { timeout: 8000 });
    await page.click('#quick [data-act="watch"]');
  });
  await shot('07-discover');
  await step('film sheet + rec score + friends', async () => {
    await page.click('#friends-trending .card .hit');
    await page.waitForSelector('.panel .plot:not(.muted)');
    await page.waitForSelector('.panel .who');
  });
  await shot('08-film-sheet');
  await step('recommend to friend', async () => {
    await page.click('.panel [data-act="recommend"]');
    await page.waitForSelector('.pick-people .pp');
    await page.click('.pick-people .pp');
    await page.fill('#rec-msg', 'You will love it');
    await page.click('#rec-send');
    await page.waitForSelector('#modal[hidden]', { state: 'attached' });
    await page.keyboard.press('Escape');
  });
  await step('quick add + rank via search', async () => {
    await page.click('[data-act="quick-add"]');
    await page.fill('#qa', 'pulp fiction');
    await page.waitForTimeout(300);
    await page.click('.qa-row');
    await page.click('.feel.loved');
    for (let g = 0; g < 10 && await page.$('#pick-new'); g++) { await page.click('#pick-new'); await page.waitForTimeout(330); }
    await page.waitForSelector('.big-score');
    await shot('09-reveal');
    await page.click('[data-act="flow-done"]');
  });
  await step('lists + filters', async () => {
    await page.goto(BASE + '#/lists');
    await page.waitForSelector('.rowi');
    await page.selectOption('[data-ctl="sort"]', 'title');
    await page.click('[data-ctl="bucket"] [data-v="loved"]');
    const n = await page.$$eval('.rowi', e => e.length);
    if (n < 2) throw new Error('loved rows ' + n);
  });
  await shot('10-lists');
  await step('want tab', async () => { await page.goto(BASE + '#/lists/want'); await page.waitForSelector('.card'); });
  await step('own profile taste', async () => {
    await page.goto(BASE + '#/u/nicotest/taste');
    await page.waitForSelector('.badges .bdg');
  });
  await shot('11-profile-taste', true);
  await step('other profile compare', async () => {
    const href = await page.evaluate(async () => '#/u/maya.watches/compare');
    await page.goto(BASE + href);
    await page.waitForSelector('.phead');
    await page.waitForSelector('.compare-hero');
  });
  await shot('12-compare', true);
  await step('private profile request', async () => {
    await page.goto(BASE + '#/u/jules.indie');
    await page.waitForSelector('.empty h3');
    await page.click('.phead [data-act="follow"]');
    await page.waitForSelector('.phead [data-act="unfollow"]');
  });
  await step('leaderboard', async () => {
    await page.goto(BASE + '#/leaderboard');
    await page.waitForSelector('.board li.me');
    await page.click('[data-btab="everyone"]');
    await page.waitForSelector('.board li');
  });
  await shot('13-leaderboard');
  await step('together', async () => {
    await page.goto(BASE + '#/together');
    await page.waitForSelector('.pp');
    await page.click('.pp');
    await page.click('#t-go');
    await page.waitForSelector('#t-out .card');
  });
  await shot('14-together');
  await step('search people', async () => {
    await page.goto(BASE + '#/search?tab=people');
    await page.fill('#q', 'kenji');
    await page.waitForSelector('#results .urow');
  });
  await step('settings save', async () => {
    await page.goto(BASE + '#/settings');
    await page.fill('[name=bio]', 'I rank everything');
    await page.click('#prof-form .btn.primary');
    await page.waitForTimeout(300);
    await page.goto(BASE + '#/u/nicotest');
    await page.waitForSelector('.bio');
  });
  await step('sign out / in', async () => {
    await page.goto(BASE + '#/settings');
    await page.click('[data-act="sign-out"]');
    await page.waitForSelector('.welcome');
    await page.click('[data-atab="signin"]');
    await page.fill('#auth-form [name=email]', 'nico@test.dev');
    await page.fill('#auth-form [name=password]', 'wrongpass');
    await page.click('#auth-go');
    await page.waitForFunction(() => document.querySelector('#auth-err').textContent.includes('Wrong'));
    await page.fill('#auth-form [name=password]', 'secret123');
    await page.click('#auth-go');
    await page.waitForSelector('.post');
  });
  await step('rankings persisted', async () => {
    await page.goto(BASE + '#/lists');
    await page.click('[data-ctl="bucket"] [data-v="all"]');
    const n = await page.$$eval('.rowi', e => e.length);
    if (n !== 4) throw new Error('rows ' + n);
    const note = await page.textContent('.rows');
    if (!note.includes('Test note')) throw new Error('note missing');
  });
  await step('deep link film', async () => {
    await page.goto(BASE + '#/film/2');
    await page.waitForSelector('.panel h2');
  });

  const m = await ctx.newPage();
  m.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(BASE + '#/feed');
  await m.waitForSelector('.post');
  await m.screenshot({ path: `${SH}/15-mobile-feed.png` });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await m.goto(BASE + '#/u/nicotest');
  await m.waitForSelector('.phead');
  await m.screenshot({ path: `${SH}/16-mobile-profile.png` });
  await m.click('.tab-add');
  await m.waitForSelector('#qa');
  await m.screenshot({ path: `${SH}/17-mobile-quickadd.png` });
  const overflow2 = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  log('overflow', overflow, overflow2);
  log('ERRORS', JSON.stringify(errors, null, 1));
  process.exitCode = errors.length ? 1 : 0;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
