#!/usr/bin/env node
// Usage: node html-export.js <input.html|url> [output-dir] [--wait <ms>]
// Exports a local HTML file or URL to PNG (full-page, 2x DPR) and PDF (A4).

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function exportHTML(input, outputDir, waitMs) {
  const isUrl = /^https?:\/\//.test(input);
  const url = isUrl ? input : `file://${path.resolve(input)}`;

  const baseName = isUrl
    ? `export-${Date.now()}`
    : path.basename(input, path.extname(input));

  const dir = outputDir || (isUrl ? process.cwd() : path.dirname(path.resolve(input)));

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  if (waitMs > 0) await page.waitForTimeout(waitMs);

  // Full-page screenshot at 2x DPR
  const pngPath = path.join(dir, `${baseName}.png`);
  await page.screenshot({ path: pngPath, fullPage: true });

  // Detect landscape: wider content than A4 portrait (794px at 96dpi)
  const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const landscape = bodyWidth > 840;

  const pdfPath = path.join(dir, `${baseName}.pdf`);
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    landscape,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();

  console.log(`PNG: ${pngPath}`);
  console.log(`PDF: ${pdfPath}`);
}

// Argument parsing
const args = process.argv.slice(2);
if (!args.length || args[0] === '--help') {
  console.error('Usage: node html-export.js <input.html|url> [output-dir] [--wait <ms>]');
  process.exit(1);
}

const input = args[0];
let outputDir = null;
let waitMs = 0;

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--wait' && args[i + 1]) {
    waitMs = parseInt(args[++i], 10);
  } else if (!args[i].startsWith('--')) {
    outputDir = args[i];
  }
}

exportHTML(input, outputDir, waitMs).catch(err => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
