import { launch, shot, BASE, BACKUP } from './pixel.mjs';
const { browser, page, errors } = await launch();
await page.goto(`${BASE}/#/einstellungen`);
await shot(page, '00-leer-einstellungen');
await page.setInputFiles('input[type=file]', BACKUP);
await page.getByText('importieren?').waitFor();
await shot(page, '01-import-dialog');
console.log('Dialog:', await page.locator('app-sheet p').innerText());
await page.getByRole('button', { name: 'Importieren' }).click();
await page.waitForTimeout(500);

for (const [route, name] of [['heute', '02-heute'], ['uebersicht', '03-woche'], ['abwesenheiten', '06-abwesenheiten'], ['uni', '07-uni']]) {
  await page.goto(`${BASE}/#/${route}`);
  await page.waitForTimeout(600);
  await shot(page, name);
}
await page.goto(`${BASE}/#/uebersicht`);
await page.getByRole('button', { name: 'Monat' }).click();
await page.waitForTimeout(300);
await shot(page, '04-monat');
await page.getByRole('button', { name: 'Jahr' }).click();
await page.waitForTimeout(300);
await shot(page, '05-jahr');
console.log('Jahr:', (await page.locator('.card.primary').innerText()).replace(/\s+/g, ' '));

await page.goto(`${BASE}/#/abwesenheiten`);
const yearLabel = page.locator('.content > .row span.grow').first();
for (const y of [2025, 2026, 2027]) {
  let cur = Number(await yearLabel.innerText());
  while (cur !== y) {
    await page.getByLabel(cur > y ? 'Vorjahr' : 'Folgejahr').click();
    const next = cur > y ? cur - 1 : cur + 1;
    await page.locator('.vac h2', { hasText: String(next) }).waitFor(); // erst weiter, wenn die Karte aktualisiert ist
    cur = next;
  }
  console.log(`Urlaub ${y}:`, (await page.locator('.vac').innerText()).replace(/\s+/g, ' '));
}
await page.goto(`${BASE}/#/einstellungen`);
await page.waitForTimeout(300);
await page.screenshot({ path: 'tools/shots/08-einstellungen.png', scale: 'css', fullPage: true });
console.log('Saldo:', await page.locator('.card .num').first().innerText());
console.log('Errors:', errors);
await browser.close();
