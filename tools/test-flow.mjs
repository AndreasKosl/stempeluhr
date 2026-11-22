import { launch, shot, BASE, BACKUP } from './pixel.mjs';
const { browser, page, errors } = await launch();
const H = 3_600_000, M = 60_000;
await page.clock.install({ time: new Date('2026-11-23T08:00:00+01:00') });
await page.goto(`${BASE}/#/einstellungen`);
await page.setInputFiles('input[type=file]', BACKUP);
await page.getByRole('button', { name: 'Importieren' }).click();
await page.goto(`${BASE}/#/heute`);
const toast = () => page.locator('.snackbar span').innerText().catch(() => '(kein Toast)');
const text = async (sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ');

await page.getByRole('button', { name: 'Einstempeln' }).click();
await page.getByText('erkannt').waitFor({ timeout: 10000 });
console.log('Start →', await toast());
await page.clock.fastForward(3 * H + 10 * M); // 11:10
await page.waitForTimeout(300);
console.log('11:10 →', await text('.hero'));
await shot(page, '10-laeuft');

await page.getByRole('button', { name: /Pause 11:30/ }).click();
console.log('Mittag →', await toast());
await page.clock.fastForward(80 * M); // 12:30
await page.waitForTimeout(300);
console.log('12:30 Uhr (Soll 4:00) →', await text('.ring .clock'));

await page.getByRole('button', { name: 'Pause', exact: true }).click();
await page.clock.fastForward(10 * M);
await page.waitForTimeout(300);
await shot(page, '11-pause');
console.log('In Pause →', await text('.ring .state'));
await page.getByRole('button', { name: 'Weiter' }).click();
await page.clock.fastForward(4 * H + 5 * M); // 16:45
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Ausstempeln' }).click();
console.log('Stop (Soll 8:05) →', await toast());
await page.waitForTimeout(300);
await shot(page, '12-fertig');

await page.goto(`${BASE}/#/tag/2026-11-23`);
await page.waitForTimeout(300);
console.log('Tag →', await text('.card.primary'));
await shot(page, '13-tag');
await page.locator('.list-item').first().click();
await page.waitForTimeout(300);
await shot(page, '14-eintrag-sheet');
await page.getByRole('button', { name: 'Abbrechen' }).click();

await page.goto(`${BASE}/#/uni`);
await page.getByLabel('Fach / Thema (optional)').fill('Mathe II');
await page.getByRole('button', { name: 'Lernzeit starten' }).click();
await page.clock.fastForward(45 * M);
await page.waitForTimeout(300);
await shot(page, '15-uni-laeuft');
await page.getByRole('button', { name: 'Stoppen' }).click();
await page.waitForTimeout(300);
console.log('Uni →', await text('.stats.grid'));
await shot(page, '16-uni');

await page.goto(`${BASE}/#/heute`);
await page.waitForTimeout(300);
console.log('Heute nach Uni (Uni darf nicht zählen) →', await text('.ring .clock'));

await page.goto(`${BASE}/#/abwesenheiten`);
await page.getByRole('button', { name: 'Eintragen' }).click();
await page.getByRole('button', { name: 'Krankheit' }).click();
await page.locator('#ae-from').fill('2026-11-25');
await page.locator('#ae-to').fill('2026-11-26');
await page.waitForTimeout(200);
await shot(page, '17-abwesenheit-sheet');
await page.getByRole('button', { name: 'Speichern' }).click();
await page.waitForTimeout(300);
console.log('Krank →', await text('.content > .stats'));
await page.goto(`${BASE}/#/uebersicht`);
await page.waitForTimeout(300);
await shot(page, '18-woche-neu');

await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(`${BASE}/#/heute`);
await page.waitForTimeout(300);
await shot(page, '19-dark');
console.log('Errors:', errors);
await browser.close();
