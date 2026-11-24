// Deep-Link für Automationen (MacroDroid-Geofence): #/stempeln/kommen?ort=buero und #/stempeln/gehen
import { launch, BASE } from './pixel.mjs';
const { browser, page, errors } = await launch();
const M = 60_000;
await page.clock.install({ time: new Date('2026-11-23T07:55:00+01:00') });
const toast = () => page.locator('.snackbar span').innerText().catch(() => '(kein Toast)');
const entries = () => page.evaluate(() => JSON.parse(localStorage.getItem('stempeluhr.data.v1') ?? '{}').entries ?? []);

await page.goto(`${BASE}/#/stempeln/kommen?ort=buero`);
await page.waitForURL(/#\/heute$/);
await page.waitForTimeout(300);
console.log('Kommen →', await toast(), '·', page.url());

// Erneut auslösen (z. B. Geofence feuert doppelt) – darf keinen zweiten Eintrag erzeugen
await page.clock.fastForward(5 * M);
await page.goto(`${BASE}/#/stempeln/kommen?ort=buero`);
await page.waitForURL(/#\/heute$/);
await page.waitForTimeout(300);
const work = (await entries()).filter((e) => e.kind === 'work');
console.log('Arbeitseinträge nach 2× Kommen:', work.length, '· Ort:', work[0]?.place, '· läuft:', work[0]?.end == null);

await page.clock.fastForward(8 * 60 * M);
await page.goto(`${BASE}/#/stempeln/gehen`);
await page.waitForURL(/#\/heute$/);
await page.waitForTimeout(300);
console.log('Gehen →', await toast());

// Ohne ?ort → normale GPS-Erkennung
await page.goto(`${BASE}/#/stempeln/kommen`);
await page.getByText(/erkannt|gesetzt/).waitFor({ timeout: 10000 }); // ohne Büro-Standort: „… gesetzt“
console.log('Kommen (GPS) →', await toast());

console.log(errors.length ? `Fehler: ${errors.join('\n')}` : 'Keine Konsolenfehler');
await browser.close();
