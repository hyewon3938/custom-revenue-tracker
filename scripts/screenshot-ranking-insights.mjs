import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:3000/monthly', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// 상품 랭킹 스크린샷: 랭킹(1339) ~ 매트릭스 끝(~2500)
// 스크롤해서 랭킹 섹션이 상단에 오도록
await page.evaluate(() => window.scrollTo(0, 1280));
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/07_monthly_ranking.png', fullPage: false });
console.log('saved: 07_monthly_ranking.png');

// AI 인사이트 스크린샷: 2537 ~ 끝
await page.evaluate(() => window.scrollTo(0, 2480));
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/08_monthly_insights.png', fullPage: false });
console.log('saved: 08_monthly_insights.png');

await browser.close();
console.log('done');
