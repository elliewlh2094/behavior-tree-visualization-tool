// Run the v1.4 release Lighthouse audit suite. Produces 4 reports:
//   {VERSION}-audit-{light,dark}        — StartScreen, desktop, navigation
//   {VERSION}-editor-audit-{light,dark} — Editor, mobile, snapshot
// Theme is forced via localStorage so the FOUC script picks it up.
//
// Prereq: vite preview running on 4173 (`npm run preview`).
// Usage:  node scripts/lighthouse-audit.mjs [version]

import * as ChromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { navigation, snapshot, generateReport, desktopConfig } from 'lighthouse';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = 'http://localhost:4173/';
const OUTDIR = 'docs/lighthouse';
const VERSION = process.argv[2] ?? 'v1.4';

const variants = [
  { name: 'audit-light',         mode: 'startscreen', theme: 'light' },
  { name: 'audit-dark',          mode: 'startscreen', theme: 'dark'  },
  { name: 'editor-audit-light',  mode: 'editor',      theme: 'light' },
  { name: 'editor-audit-dark',   mode: 'editor',      theme: 'dark'  },
];

async function setTheme(page, theme) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((theme) => {
    localStorage.setItem(
      'bt-visualizer-preferences',
      JSON.stringify({ state: { theme }, version: 2 }),
    );
  }, theme);
}

async function clickNewTree(page) {
  await page.waitForSelector('button', { timeout: 10000 });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'New Tree',
    );
    if (!btn) throw new Error('"New Tree" button not found');
    btn.click();
  });
  await page.waitForSelector('.react-flow', { timeout: 10000 });
}

function scoreLine(lhr) {
  const s = (k) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
  return `Perf ${s('performance')} / A11y ${s('accessibility')} / BP ${s('best-practices')} / SEO ${s('seo')}`;
}

async function main() {
  mkdirSync(OUTDIR, { recursive: true });

  const chrome = await ChromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });

  try {
    const browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${chrome.port}`,
      defaultViewport: null,
    });

    for (const v of variants) {
      const page = await browser.newPage();
      try {
        await setTheme(page, v.theme);

        let result;
        if (v.mode === 'startscreen') {
          // Reload so the FOUC script picks up the theme on first paint.
          await page.reload({ waitUntil: 'load' });
          result = await navigation(page, URL, {
            config: desktopConfig,
            flags: { disableStorageReset: true, logLevel: 'error' },
          });
        } else {
          // Editor: navigate past start screen, then snapshot.
          // Mobile form factor matches the v1.3 baseline.
          await page.reload({ waitUntil: 'load' });
          await clickNewTree(page);
          result = await snapshot(page, {
            flags: { logLevel: 'error' },
          });
        }

        const lhr = result.lhr;
        const stem = `${VERSION}-${v.name}`;
        writeFileSync(join(OUTDIR, `${stem}.report.json`), JSON.stringify(lhr, null, 2));
        writeFileSync(join(OUTDIR, `${stem}.report.html`), generateReport(lhr, 'html'));
        console.log(`[ok] ${v.name}: ${scoreLine(lhr)}`);
      } catch (err) {
        console.error(`[fail] ${v.name}:`, err.message);
        throw err;
      } finally {
        await page.close();
      }
    }

    await browser.disconnect();
  } finally {
    await chrome.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
