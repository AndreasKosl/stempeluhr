// Prüft die veröffentlichte Seite (node tools/test-live.mjs [url])
import { launch, shot } from './pixel.mjs';
const URL = process.argv[2] ?? 'https://andreaskosl.github.io/stempeluhr/';
const { browser, context, page, errors } = await launch();
const res = await page.goto(URL);
console.log('HTTP', res.status(), '| Titel:', await page.title());
await page.locator('h1').first().waitFor();
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60000 });
const m = await page.evaluate(async () => { const j = await (await fetch('manifest.webmanifest')).json(); return { ...j, start_url: new URL(j.start_url, location.href).href }; });
console.log('SW aktiv | Manifest:', m.name, '| start_url:', m.start_url);
// Warten, bis der Service Worker alle App-Dateien im Cache hat (läuft nach dem ersten Laden im Hintergrund)
const cacheState = () =>
  page.evaluate(async () => {
    const want = (await (await fetch('ngsw.json?x=' + Date.now())).json()).assetGroups.find((g) => g.name === 'app').urls;
    const have = new Set();
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) have.add(new URL(r.url).pathname);
    return { want: want.length, missing: want.filter((u) => !have.has(u)).length };
  });
const t0 = Date.now();
let cs = await cacheState();
while (cs.missing && Date.now() - t0 < 60000) {
  await page.waitForTimeout(1000);
  cs = await cacheState();
}
console.log(`Im Cache: ${cs.want - cs.missing}/${cs.want} App-Dateien nach ${Math.round((Date.now() - t0) / 1000)} s`);
await context.setOffline(true);
for (const r of ['abwesenheiten', 'uebersicht', 'uni', 'einstellungen', 'heute']) {
  await page.goto(URL + '#/' + r);
  await page.waitForTimeout(400);
  console.log('Offline', r, '→', (await page.locator('h1').first().innerText()).split(String.fromCharCode(10))[0]);
}
await context.setOffline(false);
await page.goto(URL + '#/heute');
await page.waitForTimeout(500);
await shot(page, '30-live');
console.log('Errors:', errors.filter((e) => !/INTERNET_DISCONNECTED/.test(e)));
await browser.close();
