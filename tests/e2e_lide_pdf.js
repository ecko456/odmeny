// Prohlížečový průchod PDF pro audit (Playwright + Chromium): oddělení u pozice, export
// lidí do PDF bez nezařazených a vyřazených, uložení oddělení a výzva staré stránce.
//
// Spuštění proti lokálnímu serveru s čistými daty (z kořene repozitáře):
//   ODMENY_DATA_DIR=$S/odm php -S 127.0.0.1:8490 -t . dev-router.php &
//   curl -s -H 'X-Odmeny: 1' http://127.0.0.1:8490/api.php?action=state   # vytvoří setup-token.txt
//   NO_PROXY=127.0.0.1 PW=$(npm root -g)/playwright S=$S node tests/e2e_lide_pdf.js
// Proti Apachi: BASE=http://127.0.0.1/odmeny/ TOKEN_FILE=/var/lib/odmeny/setup-token.txt
// S = pracovní adresář pro snímky a stažené PDF (lide.pdf, oshots/).
const { chromium } = require(process.env.PW);
const fs = require('fs');
const path = require('path');
const S = process.env.S;
const BASE = process.env.BASE || 'http://127.0.0.1:8490/';
const shots = path.join(S, 'oshots');
const problems = [];

// Česká jména schválně tak, aby bylo vidět řazení: Č za C, Ch za H, Ř za R, Š za S, Ž za Z.
const PEOPLE = [
  ['Novák', 'Jan', 'p_cnc', 4], ['Čermák', 'Petr', 'p_cnc', 4], ['Cibulka', 'Adam', 'p_cnc', 3], ['Chalupa', 'Josef', 'p_cnc', 3],
  ['Hrubý', 'Martin', 'p_cnc', 2], ['Šimek', 'Ondřej', 'p_cnc', 2], ['Sýkora', 'Tomáš', 'p_cnc', 1], ['Řezníček', 'Lukáš', 'p_fre', 3],
  ['Růžička', 'David', 'p_fre', 2], ['Zeman', 'Filip', 'p_fre', 1], ['Žák', 'Roman', 'p_fre', 4],
  ['Dvořáková', 'Eva', 'p_kon', 4], ['Procházková', 'Lucie', 'p_kon', 3], ['Kučerová', 'Tereza', 'p_kon', 2], ['Veselá', 'Hana', 'p_kon', 1],
  ['Horáková', 'Jana', 'p_kon', 2], ['Němcová', 'Petra', 'p_kon', 3],
  ['Marek', 'Pavel', 'p_mon', 1], ['Pokorný', 'Jiří', 'p_mon', 2], ['Král', 'Karel', 'p_mon', 3], ['Beneš', 'Michal', 'p_mon', 1],
  ['Fiala', 'Vojtěch', 'p_mon', 2], ['Kolář', 'Jakub', 'p_mon', 4], ['Navrátil', 'Milan', 'p_mon', 1], ['Urban', 'Matěj', 'p_mon', 2],
  ['Blažek', 'Daniel', 'p_bal', 1], ['Kříž', 'Václav', 'p_bal', 2], ['Holub', 'Stanislav', 'p_bal', 1], ['Říhová', 'Kateřina', 'p_bal', 3],
];
for (let i = 0; i < 24; i += 1) PEOPLE.push([`Operátor${String(i + 1).padStart(2, '0')}`, 'Test', i % 2 ? 'p_mon' : 'p_cnc', (i % 4) + 1]);

async function watch(page, label) {
  page.on('console', msg => { if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) problems.push(`${label} console: ${msg.text()}`); });
  page.on('response', r => { if (r.status() >= 400 && !(r.status() === 426 && /action=data/.test(r.url()))) problems.push(`${label} HTTP ${r.status()} ${r.url()}`); });
  page.on('pageerror', err => problems.push(`${label} pageerror: ${err.message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', e => console.error(`CSP ${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`));
  });
}

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await watch(page, 'desk');
  await page.goto(BASE);
  await page.waitForSelector('#setupForm');
  const token = fs.readFileSync(process.env.TOKEN_FILE || path.join(S, 'odm', 'setup-token.txt'), 'utf8').trim();
  await page.fill('[name="token"]', token);
  await page.fill('[name="label"]', 'Vedoucí dílny');
  await page.click('#setupForm button[type="submit"]');
  await page.waitForSelector('.odm-card');
  await page.check('#saved');
  await page.click('#finish');
  await page.waitForSelector('#skip');
  await page.click('#skip');
  await page.waitForSelector('#view-prehled.on');

  // Testovací zařazení: pět pozic, Montáž bez oddělení (je oddělením sama), plus lidé, kteří v PDF být nesmí.
  await page.evaluate(people => {
    const cnc = mkPos('p_cnc', 'CNC', ['Zaučuje se, pracuje pod dohledem.', 'Samostatně obsluhuje stroj na běžných dílech.', 'Seřizuje stroj a řeší běžné chyby.', 'Programuje, zaučuje ostatní a odpovídá za kvalitu směny.']);
    const fre = mkPos('p_fre', 'Frézka', []);
    const kon = mkPos('p_kon', 'Kontrola', ['Měří pod dohledem.', 'Samostatně měří běžné díly.', 'Měří složité díly a vede záznamy.', 'Schvaluje první kusy a školí měření.']);
    const mon = mkPos('p_mon', 'Montáž', []);
    const bal = mkPos('p_bal', 'Balení', []);
    cnc.dept = 'Obrobna'; fre.dept = 'Obrobna'; kon.dept = 'Kontrola kvality'; bal.dept = 'Expedice';
    const state = blank();
    state.positions = [cnc, fre, kon, mon, bal];
    people.forEach(([last, first, positionId, level], i) => { state.employees[`k${i}`] = { key: `k${i}`, last, first, positionId, level, note: '' }; });
    state.employees.x1 = { key: 'x1', last: 'Vyřazený', first: 'Karel', positionId: 'p_cnc', level: 4, note: '', excluded: true };
    state.employees.x2 = { key: 'x2', last: 'Nezařazená', first: 'Jana', positionId: null, level: null, note: '' };
    state.employees.x3 = { key: 'x3', last: 'Bezúrovně', first: 'Petr', positionId: 'p_mon', level: null, note: '' };
    S = sanitizeState(state);
    save();
    renderAll();
  }, PEOPLE);

  // Oddělení se zadává v editoru pozice (Balení: Expedice → Sklad a expedice).
  await page.click('#nav [data-view="pozice"]');
  await page.click('#posList [data-selpos="p_bal"]');
  await page.fill('#posDept', 'Sklad a expedice');
  await page.press('#posDept', 'Tab');
  await page.waitForTimeout(200);
  if (!/Sklad a expedice/.test(await page.textContent('#posList [data-selpos="p_bal"]'))) problems.push('oddělení není vidět v seznamu pozic');
  await page.screenshot({ path: `${shots}/pdf-01-pozice.png`, fullPage: true });

  await page.click('#nav [data-view="lide"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shots}/pdf-02-lide.png` });
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnPeoplePdf')]);
  if (!/^zamestnanci-podle-oddeleni-\d{4}-\d{2}-\d{2}\.pdf$/.test(download.suggestedFilename())) problems.push(`název PDF: ${download.suggestedFilename()}`);
  await download.saveAs(path.join(S, 'lide.pdf'));
  await page.waitForSelector('#toast.on');
  const toastText = await page.textContent('#toast');
  if (!/53 zaměstnanců.*oddělení: 4.*nezařazení \(2\) a vyřazení \(1\)/.test(toastText)) problems.push(`hláška po exportu: ${toastText}`);
  await page.screenshot({ path: `${shots}/pdf-03-toast.png` });

  // Oddělení se uložilo do šifrovaných dat na serveru.
  await page.waitForFunction(() => !store.dirty && !store.saving && store.rev > 0, null, { timeout: 15000 });
  const depts = await page.evaluate(async () => (await Vault.loadData()).state.positions.map(p => `${p.id}=${p.dept || ''}`).join(','));
  if (depts !== 'p_cnc=Obrobna,p_fre=Obrobna,p_kon=Kontrola kvality,p_mon=,p_bal=Sklad a expedice') problems.push(`uložená oddělení: ${depts}`);

  // Mobil: tlačítka v Lidech a pole Oddělení se zalomí, nic nepřetéká.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ['lide', 'pozice']) {
    await page.evaluate(v => showView(v), view);
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) problems.push(`mobil ${view}: vodorovné přetečení ${overflow} px`);
    await page.screenshot({ path: `${shots}/pdf-05-mobil-${view}.png`, fullPage: false });
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // Stránka otevřená před aktualizací: server uložení odmítne (426) a aplikace vyzve k obnovení.
  await page.route('**/api.php?action=data', route => (route.request().method() === 'POST'
    ? route.fulfill({ status: 426, contentType: 'application/json', body: JSON.stringify({ error: 'Aplikace byla aktualizována.', reload: true }) })
    : route.continue()));
  await page.click('#nav [data-view="pozice"]');
  await page.fill('#posDept', 'Expedice');
  await page.press('#posDept', 'Tab');
  await page.waitForSelector('#dlg[open]', { timeout: 10000 });
  const dlg = await page.textContent('#dlg');
  if (!/Aplikace byla aktualizována/.test(dlg)) problems.push(`dialog po 426: ${dlg}`);
  await page.screenshot({ path: `${shots}/pdf-04-aktualizace.png` });

  await browser.close();
  if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
  console.log('e2e PDF pro audit ok');
})().catch(error => { console.error(error); process.exit(1); });
