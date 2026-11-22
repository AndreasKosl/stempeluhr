import { readFileSync } from 'node:fs';
import { launch, shot, BASE, BACKUP } from './pixel.mjs';
const { browser, page, errors } = await launch({ geo: { latitude: 51.51, longitude: 7.10 } });
await page.goto(`${BASE}/#/einstellungen`);
await page.setInputFiles('input[type=file]', BACKUP);
await page.getByRole('button', { name: 'Importieren' }).click();

// Homeoffice-Erkennung
await page.goto(`${BASE}/#/heute`);
await page.getByRole('button', { name: 'Einstempeln' }).click();
await page.getByText('erkannt').waitFor({ timeout: 10000 });
console.log('Weit weg →', await page.locator('.snackbar span').innerText());
await page.getByRole('button', { name: 'Ausstempeln' }).click();

// Backup-Export und Re-Import
await page.goto(`${BASE}/#/einstellungen`);
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Backup exportieren' }).click()]);
const path = 'tools/shots/export.json';
await dl.saveAs(path);
const exp = JSON.parse(readFileSync(path, 'utf8'));
console.log('Export →', dl.suggestedFilename(), exp.app, exp.data.entries.length, 'Einträge');
await page.setInputFiles('input[type=file]', path);
console.log('Re-Import Dialog →', await page.locator('app-sheet p').innerText());
await page.getByRole('button', { name: 'Importieren' }).click();
await page.waitForTimeout(300);
console.log('Saldo nach Re-Import →', await page.locator('.card .num').first().innerText());

// ICS
await page.goto(`${BASE}/#/abwesenheiten`);
await page.getByRole('button', { name: 'Kalender', exact: true }).click();
await page.waitForTimeout(300);
await shot(page, '20-kalender-sheet');
const [ics] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Alle als .ics exportieren' }).click()]);
await ics.saveAs('tools/shots/abwesenheiten.ics');
const icsText = readFileSync('tools/shots/abwesenheiten.ics', 'utf8');
console.log('ICS →', (icsText.match(/BEGIN:VEVENT/g) || []).length, 'Termine\n' + icsText.split('\r\n').slice(6, 16).join('\n'));
console.log('Google-Link →', await page.locator('a.cal-btn').first().getAttribute('href'));
console.log('Errors:', errors);
await browser.close();
