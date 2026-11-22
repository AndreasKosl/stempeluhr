// Gemeinsames Setup: Pixel-11-Pro-Emulation (Basis: Playwright "Pixel 10 Pro", gleiches Format)
import { chromium, devices } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';

export const BASE = process.env.BASE ?? 'http://localhost:4200';
// Persönliche Backups liegen nicht im Repo (.gitignore) – Büro-Koordinaten werden daraus gelesen.
export const BACKUP = process.env.BACKUP ?? 'StempelUhrDataBackup2026-11-22.json';
function officeFromBackup() {
  if (!existsSync(BACKUP)) return null;
  const loc = JSON.parse(readFileSync(BACKUP, 'utf8')).locations?.find((l) => l.latitude != null);
  return loc ? { latitude: loc.latitude, longitude: loc.longitude } : null;
}
export const OFFICE = officeFromBackup() ?? { latitude: 52.5163, longitude: 13.3777 };

export async function launch({ geo = OFFICE, dark = false } = {}) {
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({
    ...devices['Pixel 10 Pro'],
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    geolocation: geo,
    permissions: ['geolocation'],
    colorScheme: dark ? 'dark' : 'light',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return { browser, context, page, errors };
}

export const shot = (page, name) => page.screenshot({ path: `tools/shots/${name}.png`, scale: 'css' });
