// Erzeugt die PWA-Icons aus SVG (node tools/make-icons.mjs)
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const glyph = (fg, accent) => `
  <circle cx="256" cy="268" r="150" fill="none" stroke="${fg}" stroke-width="34"/>
  <rect x="226" y="76" width="60" height="40" rx="12" fill="${fg}"/>
  <rect x="352" y="112" width="44" height="30" rx="10" fill="${fg}" transform="rotate(45 374 127)"/>
  <path d="M256 268 V170" stroke="${fg}" stroke-width="30" stroke-linecap="round"/>
  <path d="M256 268 L326 316" stroke="${accent}" stroke-width="30" stroke-linecap="round"/>
  <circle cx="256" cy="268" r="20" fill="${fg}"/>`;

const svg = {
  any: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="112" fill="#0061a4"/>${glyph('#ffffff', '#c5f08f')}</svg>`,
  maskable: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#0061a4"/>
    <g transform="translate(256 256) scale(0.72) translate(-256 -262)">${glyph('#ffffff', '#c5f08f')}</g></svg>`,
  monochrome: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(256 256) scale(0.72) translate(-256 -262)">${glyph('#ffffff', '#ffffff')}</g></svg>`,
};

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon.svg', svg.any);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const jobs = [
  ['any', 192, 'icon-192x192'],
  ['any', 512, 'icon-512x512'],
  ['maskable', 192, 'maskable-192x192'],
  ['maskable', 512, 'maskable-512x512'],
  ['monochrome', 512, 'monochrome-512x512'],
];
for (const [kind, size, name] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg[kind].replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
  await page.screenshot({ path: `public/icons/${name}.png`, omitBackground: true });
}
await browser.close();
console.log('ok');
