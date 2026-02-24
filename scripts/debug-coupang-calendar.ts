/**
 * 쿠팡 판매분석 달력 구조 디버그
 * 실행: npx tsx scripts/debug-coupang-calendar.ts
 */
import { chromium } from "playwright";
import { loginCoupang } from "../src/lib/scrapers/coupang-auth";
import { COUPANG_URLS } from "../src/lib/scrapers/coupang-auth";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  try {
    await loginCoupang(page);
    console.log("✅ 로그인 완료\n");

    await page.goto(COUPANG_URLS.salesAnalysis);
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);
    console.log("판매분석 페이지 로드 완료\n");

    // 팝업 닫기
    for (const sel of [
      'button[data-wuic-props="name:btn size:m"]:has-text("닫기")',
      'button[data-wuic-props="name:btn size:l"]:has-text("닫기")',
    ]) {
      try {
        await page.click(sel, { timeout: 1_500 });
        await page.waitForTimeout(300);
        console.log(`팝업 닫기: ${sel}`);
      } catch {}
    }

    // ── 트리거 클릭 전: context-trigger-filter 목록 확인 ──
    const triggers = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("div.context-trigger-filter"))
        .map((el, i) => ({
          index: i,
          text: el.textContent?.trim().slice(0, 80) ?? "",
          hasCalendarIcon: !!el.querySelector('i[title="calendar"]'),
          class: el.className,
          html: el.outerHTML.slice(0, 300),
        }));
    });
    console.log(`context-trigger-filter 요소 ${triggers.length}개:`);
    triggers.forEach((t) => {
      console.log(
        `  [${t.index}] text="${t.text}" hasCalIcon=${t.hasCalendarIcon} class="${t.class}"`
      );
    });

    // ── "최근 7일" 텍스트를 포함한 트리거 클릭 ──
    console.log('\n"최근 7일" 포함 트리거 클릭...');
    const triggerHandle = await page.$(
      'div.context-trigger-filter:has-text("최근 7일")'
    );
    if (!triggerHandle) {
      console.log('❌ div.context-trigger-filter:has-text("최근 7일") 없음');
    } else {
      const txt = await triggerHandle.textContent();
      console.log(`  → 선택된 요소 text="${txt?.trim()}"`);
      await triggerHandle.click();
      console.log("  → 클릭 완료");
    }

    await page.waitForTimeout(2_000);

    // ── 클릭 후 DOM 변화: 새로 나타난 날짜 관련 요소 ──
    const afterClick = await page.evaluate(() => {
      // 1) dp__ prefix 요소
      const dpEls = Array.from(document.querySelectorAll("[class*='dp__']"));

      // 2) id에 날짜가 있는 요소
      const dateIdEls = Array.from(document.querySelectorAll("[id]")).filter(
        (el) => /20\d\d-\d\d-\d\d|20\d\d\.\d\d|day|date/i.test(el.id)
      );

      // 3) data-date 속성
      const dataDateEls = Array.from(
        document.querySelectorAll("[data-date],[data-day]")
      );

      // 4) 팝업/드로워 컨테이너
      const popups = Array.from(
        document.querySelectorAll(
          "[class*='popup'],[class*='modal'],[class*='drawer'],[class*='datepicker'],[class*='picker'],[class*='calendar']"
        )
      ).filter((el) => (el as HTMLElement).offsetParent !== null); // 실제로 보이는 것만

      return {
        dpCount: dpEls.length,
        dpSample: dpEls.slice(0, 3).map((el) => ({
          tag: el.tagName,
          class: el.className.slice(0, 100),
          id: el.id,
          text: el.textContent?.trim().slice(0, 40),
        })),
        dateIdCount: dateIdEls.length,
        dateIdSample: dateIdEls.slice(0, 5).map((el) => ({
          id: el.id,
          tag: el.tagName,
          class: el.className.slice(0, 80),
        })),
        dataDateCount: dataDateEls.length,
        dataDateSample: dataDateEls.slice(0, 5).map((el) => ({
          attr: (el as HTMLElement).dataset.date ?? (el as HTMLElement).dataset.day,
          tag: el.tagName,
          class: el.className.slice(0, 80),
        })),
        visiblePopupCount: popups.length,
        visiblePopups: popups.slice(0, 3).map((el) => ({
          tag: el.tagName,
          class: el.className.slice(0, 100),
          text: el.textContent?.trim().slice(0, 100),
        })),
      };
    });

    console.log("\n클릭 후 DOM 상태:");
    console.log(`  dp__ 요소: ${afterClick.dpCount}개`);
    afterClick.dpSample.forEach((d) => console.log(`    <${d.tag} id="${d.id}" class="${d.class}"> ${d.text}`));
    console.log(`  날짜 id 요소: ${afterClick.dateIdCount}개`);
    afterClick.dateIdSample.forEach((d) => console.log(`    #${d.id} <${d.tag}>`));
    console.log(`  data-date 요소: ${afterClick.dataDateCount}개`);
    afterClick.dataDateSample.forEach((d) => console.log(`    data=${d.attr} <${d.tag}>`));
    console.log(`  보이는 팝업/캘린더: ${afterClick.visiblePopupCount}개`);
    afterClick.visiblePopups.forEach((p) =>
      console.log(`    <${p.tag}> class="${p.class}" text="${p.text}"`)
    );

    // ── 모든 보이는 요소 중 날짜처럼 생긴 텍스트 탐색 ──
    const dateLike = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          const t = el.textContent?.trim() ?? "";
          return /^(1|2)\d$/.test(t) && el.children.length === 0;
        })
        .slice(0, 20)
        .map((el) => ({
          text: el.textContent?.trim(),
          tag: el.tagName,
          id: el.id,
          class: el.className.slice(0, 80),
          parent: el.parentElement?.className.slice(0, 80),
        }));
    });
    if (dateLike.length > 0) {
      console.log("\n날짜처럼 보이는 숫자 텍스트 요소:");
      dateLike.forEach((d) =>
        console.log(
          `  "${d.text}" <${d.tag} id="${d.id}" class="${d.class}"> parent="${d.parent}"`
        )
      );
    }

    console.log("\n10초 후 브라우저 종료...");
    await page.waitForTimeout(10_000);
  } catch (e) {
    console.error("❌ 에러:", e);
    await page.waitForTimeout(10_000);
  } finally {
    await browser.close();
  }
})();
