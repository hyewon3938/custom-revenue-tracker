import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:3000/monthly', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const pageHeight = await page.evaluate(() => document.body.scrollHeight);
console.log('page scroll height:', pageHeight);

// 각 섹션의 y 위치 찾기
const positions = await page.evaluate(() => {
  const results = {};
  document.querySelectorAll('h2, h3, [class*="ranking"], [class*="insight"]').forEach(el => {
    if (el.textContent.trim()) {
      results[el.textContent.trim().substring(0, 30)] = el.getBoundingClientRect().top + window.scrollY;
    }
  });
  return results;
});
console.log('sections:', JSON.stringify(positions, null, 2));

await browser.close();
