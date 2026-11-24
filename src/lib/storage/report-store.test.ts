import path from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NAVER_SHIPPING_FEE,
  NAVER_SHIPPING_COST,
  COUPANG_SHIPPING_MARKUP,
  ONLINE_MATERIAL_RATE,
  OFFLINE_MATERIAL_RATE,
} from "@/lib/config";
import type { MonthlyReport } from "@/lib/types";
import { files } from "./test-utils/memory-fs";
import {
  makeReport,
  makeNaver,
  makeVenue,
  makeFees,
  makeProduct,
  omit,
} from "./test-utils/fixtures";

vi.mock("fs/promises", async () =>
  (await import("./test-utils/memory-fs")).createFsMock(),
);

import {
  loadReport,
  saveReport,
  updateReport,
  listReports,
  loadRecentHistory,
  listVersions,
  restoreVersion,
} from "./report-store";

const DATA_DIR = path.join(process.cwd(), "data", "reports");
const reportPath = (name: string) => path.join(DATA_DIR, name);

function putRaw(name: string, value: unknown): void {
  files.set(reportPath(name), JSON.stringify(value));
}

function readStored(name: string): MonthlyReport {
  return JSON.parse(files.get(reportPath(name)) ?? "null") as MonthlyReport;
}

/** Date.now 를 호출마다 1씩 증가시켜 백업 타임스탬프 충돌을 막는다 */
function mockIncrementingNow(start: number): void {
  let now = start;
  vi.spyOn(Date, "now").mockImplementation(() => now++);
}

beforeEach(() => {
  files.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── loadReport + 마이그레이션 ──────────────────────────────────────────────

describe("loadReport", () => {
  it("파일이 없으면 null", async () => {
    expect(await loadReport(2025, 1)).toBeNull();
  });

  it("ENOENT 가 아닌 에러는 그대로 던진다", async () => {
    files.set(reportPath("2025-01.json"), "{ 깨진 JSON");
    await expect(loadReport(2025, 1)).rejects.toThrow(SyntaxError);
  });

  it("월을 두 자리로 채운 파일명을 읽는다", async () => {
    putRaw("2025-03.json", makeReport(2025, 3));
    expect((await loadReport(2025, 3))?.period).toEqual({
      year: 2025,
      month: 3,
    });
  });

  it("구버전 offline 단일 객체를 배열로 감싸고 venueId 기본값을 넣는다", async () => {
    const single = omit(makeVenue(), "venueId");
    putRaw("2025-01.json", { ...makeReport(2025, 1), offline: single });

    const report = await loadReport(2025, 1);
    expect(report?.offline).toHaveLength(1);
    expect(report?.offline[0].venueId).toBe("gosan");
    expect(report?.offline[0].venueName).toBe("고산의낮");
  });

  it("구버전 offline 단일 객체의 기존 venueId 는 유지한다", async () => {
    putRaw("2025-01.json", {
      ...makeReport(2025, 1),
      offline: makeVenue({ venueId: "other-shop" }),
    });
    const report = await loadReport(2025, 1);
    expect(report?.offline.map((v) => v.venueId)).toEqual(["other-shop"]);
  });

  it("offline 배열의 venueId 누락은 채우지 않는다", async () => {
    const noId = omit(makeVenue(), "venueId");
    putRaw("2025-01.json", { ...makeReport(2025, 1), offline: [noId] });
    const report = await loadReport(2025, 1);
    expect(report?.offline[0].venueId).toBeUndefined();
  });

  it("naver 의 shippingCollected·payerCount 누락 시 0 을 넣고 기존 값은 유지한다", async () => {
    const oldNaver = omit(makeNaver(), "shippingCollected", "payerCount");
    putRaw("2025-01.json", { ...makeReport(2025, 1), naver: oldNaver });
    putRaw("2025-02.json", makeReport(2025, 2));

    const migrated = await loadReport(2025, 1);
    expect(migrated?.naver.shippingCollected).toBe(0);
    expect(migrated?.naver.payerCount).toBe(0);

    const untouched = await loadReport(2025, 2);
    expect(untouched?.naver.shippingCollected).toBe(6_000);
    expect(untouched?.naver.payerCount).toBe(5);
  });

  it("fees.inboundShippingFee 누락 시 네이버·쿠팡·오프라인 모두 0 을 넣는다", async () => {
    const oldFees = omit(
      makeFees({ commissionFee: 1_000 }),
      "inboundShippingFee",
    );
    const base = makeReport(2025, 1);
    putRaw("2025-01.json", {
      ...base,
      naver: { ...base.naver, fees: oldFees },
      coupang: { ...base.coupang, fees: oldFees },
      offline: [
        { ...makeVenue(), fees: oldFees },
        makeVenue({ venueId: "b", fees: makeFees({ inboundShippingFee: 700 }) }),
      ],
    });

    const report = await loadReport(2025, 1);
    expect(report?.naver.fees.inboundShippingFee).toBe(0);
    expect(report?.coupang.fees.inboundShippingFee).toBe(0);
    expect(report?.offline[0].fees.inboundShippingFee).toBe(0);
    expect(report?.offline[0].fees.commissionFee).toBe(1_000);
    expect(report?.offline[1].fees.inboundShippingFee).toBe(700);
  });

  it("warnings 누락 시 빈 배열, 있으면 유지", async () => {
    const noWarnings = omit(makeReport(2025, 1), "warnings");
    putRaw("2025-01.json", noWarnings);
    putRaw(
      "2025-02.json",
      makeReport(2025, 2, {
        warnings: [{ level: "warn", message: "확인 필요" }],
      }),
    );

    expect((await loadReport(2025, 1))?.warnings).toEqual([]);
    expect((await loadReport(2025, 2))?.warnings).toEqual([
      { level: "warn", message: "확인 필요" },
    ]);
  });

  it("naver·offline 이 없는 레포트도 예외 없이 통과한다", async () => {
    putRaw("2025-01.json", { period: { year: 2025, month: 1 } });
    const report = await loadReport(2025, 1);
    expect(report?.warnings).toEqual([]);
    expect(report?.naver).toBeUndefined();
  });
});

// ─── saveReport + 버전 ─────────────────────────────────────────────────────

describe("saveReport / listVersions", () => {
  it("들여쓰기 2칸 JSON 으로 저장하고, 첫 저장에는 백업을 만들지 않는다", async () => {
    const report = makeReport(2025, 1);
    await saveReport(report);

    expect(files.get(reportPath("2025-01.json"))).toBe(
      JSON.stringify(report, null, 2),
    );
    expect(await listVersions(2025, 1)).toEqual([]);
  });

  it("덮어쓸 때 이전 내용을 타임스탬프 백업으로 남긴다", async () => {
    mockIncrementingNow(1_000);
    const first = makeReport(2025, 1, { collectedAt: "first" });
    await saveReport(first);
    await saveReport(makeReport(2025, 1, { collectedAt: "second" }));

    const versions = await listVersions(2025, 1);
    expect(versions).toHaveLength(1);
    expect(versions[0].timestamp).toBe(1_000);
    expect(versions[0].date).toBe(new Date(1_000).toISOString());
    expect(versions[0].size).toBe(JSON.stringify(first, null, 2).length);
    expect(readStored("2025-01.v1000.json").collectedAt).toBe("first");
    expect(readStored("2025-01.json").collectedAt).toBe("second");
  });

  it("백업은 최신 5개만 남기고 최신순으로 나열한다", async () => {
    mockIncrementingNow(1_000);
    for (let i = 0; i < 8; i++) {
      await saveReport(makeReport(2025, 1, { collectedAt: `save-${i}` }));
    }
    const versions = await listVersions(2025, 1);
    expect(versions.map((v) => v.timestamp)).toEqual([
      1_006, 1_005, 1_004, 1_003, 1_002,
    ]);
  });

  it("다른 월의 백업과 형식이 다른 파일은 목록에서 제외한다", async () => {
    putRaw("2025-01.v100.json", {});
    putRaw("2025-02.v200.json", {});
    putRaw("2025-01.vabc.json", {});
    putRaw("2025-01.json", {});
    expect((await listVersions(2025, 1)).map((v) => v.timestamp)).toEqual([
      100,
    ]);
  });

  it("같은 월 동시 저장은 직렬화되어 마지막 호출 내용이 남는다", async () => {
    mockIncrementingNow(1_000);
    await Promise.all(
      [0, 1, 2].map((i) =>
        saveReport(makeReport(2025, 1, { collectedAt: `save-${i}` })),
      ),
    );
    expect(readStored("2025-01.json").collectedAt).toBe("save-2");
    const versions = await listVersions(2025, 1);
    expect(
      versions.map(
        (v) => readStored(`2025-01.v${v.timestamp}.json`).collectedAt,
      ),
    ).toEqual(["save-1", "save-0"]);
  });
});

describe("restoreVersion", () => {
  it("없는 버전이면 에러", async () => {
    putRaw("2025-01.json", makeReport(2025, 1));
    await expect(restoreVersion(2025, 1, 123)).rejects.toThrow(
      "해당 버전을 찾을 수 없습니다: 123",
    );
  });

  it("현재 데이터를 백업한 뒤 버전을 복구하고 마이그레이션·수정시각을 적용한다", async () => {
    mockIncrementingNow(5_000);
    const oldVersion = omit(
      makeReport(2025, 1, { collectedAt: "old" }),
      "warnings",
    );
    putRaw("2025-01.v100.json", oldVersion);
    putRaw("2025-01.json", makeReport(2025, 1, { collectedAt: "current" }));

    const restored = await restoreVersion(2025, 1, 100);

    expect(restored.collectedAt).toBe("old");
    expect(restored.warnings).toEqual([]);
    expect(restored.lastModifiedAt).not.toBe("2025-02-01T00:00:00.000Z");
    expect(files.get(reportPath("2025-01.json"))).toBe(
      JSON.stringify(restored, null, 2),
    );
    expect(readStored("2025-01.v5000.json").collectedAt).toBe("current");
    expect((await listVersions(2025, 1)).map((v) => v.timestamp)).toEqual([
      5_000, 100,
    ]);
  });
});

// ─── listReports / loadRecentHistory ───────────────────────────────────────

describe("listReports", () => {
  it("레포트 파일만 최신순으로 나열한다", async () => {
    putRaw("2024-12.json", {});
    putRaw("2025-02.json", {});
    putRaw("2025-10.json", {});
    putRaw("2025-02.v100.json", {});
    files.set(reportPath("notes.txt"), "x");

    expect(await listReports()).toEqual([
      { year: 2025, month: 10 },
      { year: 2025, month: 2 },
      { year: 2024, month: 12 },
    ]);
  });

  it("파일이 없으면 빈 배열", async () => {
    expect(await listReports()).toEqual([]);
  });
});

describe("loadRecentHistory", () => {
  it("전달부터 거꾸로 N개월을 읽고 없는 달은 null", async () => {
    putRaw("2024-12.json", makeReport(2024, 12));
    putRaw("2024-10.json", makeReport(2024, 10));

    const history = await loadRecentHistory(2025, 1, 3);
    expect(history.map((r) => r?.period ?? null)).toEqual([
      { year: 2024, month: 12 },
      null,
      { year: 2024, month: 10 },
    ]);
  });
});

// ─── updateReport ──────────────────────────────────────────────────────────

describe("updateReport", () => {
  beforeEach(() => {
    putRaw("2025-01.json", makeReport(2025, 1));
  });

  it("레포트가 없으면 에러", async () => {
    await expect(updateReport(2030, 5, {})).rejects.toThrow(
      "2030년 5월 레포트가 없습니다. 먼저 수집을 실행해주세요.",
    );
  });

  it("빈 업데이트에도 재분류·이익·파생 필드를 재계산해 저장한다", async () => {
    const updated = await updateReport(2025, 1, {});

    // 네이버: 고객 배송비 합계 / 배송비 = 유료 건수, 나머지는 무료배송
    const regular = Math.round(6_000 / NAVER_SHIPPING_FEE);
    const free = Math.max(0, 5 - regular);
    const sellerCost =
      free * NAVER_SHIPPING_COST +
      regular * (NAVER_SHIPPING_COST - NAVER_SHIPPING_FEE);
    expect(updated.naver.shippingStats).toEqual({
      regularCount: regular,
      freeCount: free,
      sellerCost,
    });
    expect(updated.naver.fees.logisticsFee).toBe(sellerCost);
    expect(updated.naver.fees.adFee).toBe(0);
    expect(updated.naver.handmadeQuantity).toBe(4);
    const naverProfit = 100_000 - 5_000 - sellerCost;
    const naverMaterial = Math.round((100_000 - 6_000) * ONLINE_MATERIAL_RATE);
    expect(updated.naver.profit).toEqual({
      profit: naverProfit,
      materialCost: naverMaterial,
      netProfit: naverProfit - naverMaterial,
    });

    // 쿠팡: 독서링은 other 로 재분류, 부자재 기준은 재분류 후 총수량 사용
    expect(updated.coupang.totalQuantity).toBe(5);
    expect(updated.coupang.handmadeQuantity).toBe(3);
    expect(updated.coupang.otherQuantity).toBe(2);
    expect(updated.coupang.fees.adFee).toBe(2_000);
    const coupangProfit = 50_000 - 4_000 - 3_000 - 2_000;
    const coupangMaterial = Math.round(
      (50_000 - 5 * COUPANG_SHIPPING_MARKUP) * ONLINE_MATERIAL_RATE,
    );
    expect(updated.coupang.profit).toEqual({
      profit: coupangProfit,
      materialCost: coupangMaterial,
      netProfit: coupangProfit - coupangMaterial,
    });

    // 오프라인(gosan): 매출 + 수수료가 부자재 기준
    const offlineMaterial = Math.round(
      (20_000 + 2_000) * OFFLINE_MATERIAL_RATE,
    );
    expect(updated.offline[0].profit).toEqual({
      profit: 18_000,
      materialCost: offlineMaterial,
      netProfit: 18_000 - offlineMaterial,
    });
    expect(updated.offline[0].handmadeQuantity).toBe(2);

    expect(updated.summary.totalRevenue).toBe(170_000);
    expect(updated.summary.totalQuantity).toBe(11);
    expect(updated.lastModifiedAt).not.toBe("2025-02-01T00:00:00.000Z");
    expect(updated.insightsGeneratedAt).toBeUndefined();
    expect(readStored("2025-01.json")).toEqual(
      JSON.parse(JSON.stringify(updated)),
    );
  });

  it("네이버 부분 업데이트를 병합한다", async () => {
    const updated = await updateReport(2025, 1, {
      naver: { revenue: 200_000, fees: { commissionFee: 8_000 } },
    });
    expect(updated.naver.revenue).toBe(200_000);
    expect(updated.naver.fees.commissionFee).toBe(8_000);
    expect(updated.naver.fees.settlementAmount).toBe(90_000);
    expect(updated.summary.totalRevenue).toBe(270_000);
  });

  it("입점처 추가는 0 으로 채운 항목을 붙이고 중복 ID 는 무시한다", async () => {
    const updated = await updateReport(2025, 1, {
      addOfflineVenue: { id: "new-shop", name: "새 가게" },
    });
    expect(updated.offline.map((v) => v.venueId)).toEqual([
      "gosan",
      "new-shop",
    ]);
    expect(updated.offline[1]).toEqual({
      venueId: "new-shop",
      venueName: "새 가게",
      revenue: 0,
      totalQuantity: 0,
      handmadeQuantity: 0,
      otherQuantity: 0,
      fees: makeFees(),
      profit: { profit: 0, materialCost: 0, netProfit: 0 },
      products: [],
    });

    const again = await updateReport(2025, 1, {
      addOfflineVenue: { id: "gosan", name: "다른 이름" },
    });
    expect(again.offline.map((v) => v.venueName)).toEqual([
      "고산의낮",
      "새 가게",
    ]);
  });

  it("입점처 제거와 특정 입점처 수정", async () => {
    await updateReport(2025, 1, {
      addOfflineVenue: { id: "new-shop", name: "새 가게" },
    });
    const edited = await updateReport(2025, 1, {
      offlineVenueId: "new-shop",
      offline: {
        revenue: 10_000,
        products: [
          makeProduct("꽃갈피", 3, "offline"),
          makeProduct("엽서", 1, "offline", "handmade"),
        ],
      },
    });
    const shop = edited.offline[1];
    expect(shop.revenue).toBe(10_000);
    expect(shop.totalQuantity).toBe(4);
    expect(shop.handmadeQuantity).toBe(3);
    expect(shop.otherQuantity).toBe(1);
    // gosan 이 아닌 입점처는 매출이 부자재 기준
    expect(shop.profit.materialCost).toBe(
      Math.round(10_000 * OFFLINE_MATERIAL_RATE),
    );
    expect(edited.offline[0].revenue).toBe(20_000);

    const removed = await updateReport(2025, 1, {
      removeOfflineVenueId: "gosan",
    });
    expect(removed.offline.map((v) => v.venueId)).toEqual(["new-shop"]);
  });

  it("offlineVenueId 없이 offline 만 주면 무시한다", async () => {
    const updated = await updateReport(2025, 1, { offline: { revenue: 1 } });
    expect(updated.offline[0].revenue).toBe(20_000);
  });

  it("협찬 items 변경 시 수량·비용을 자동 계산하고 summary 에 반영한다", async () => {
    const updated = await updateReport(2025, 1, {
      sponsorship: {
        items: [
          {
            productName: "달빛 끈갈피",
            category: "handmade",
            quantity: 2,
            unitPrice: 7_000,
          },
          {
            productName: "실버 독서링",
            category: "other",
            quantity: 1,
            unitPrice: 5_000,
          },
        ],
      },
    });
    expect(updated.sponsorship.totalQuantity).toBe(3);
    expect(updated.sponsorship.handmadeQuantity).toBe(2);
    expect(updated.sponsorship.marketingCost).toBeGreaterThan(0);
    expect(updated.summary.marketingCost).toBe(
      updated.sponsorship.marketingCost,
    );

    const manual = await updateReport(2025, 1, {
      sponsorship: { marketingCost: 12_345 },
    });
    expect(manual.sponsorship.marketingCost).toBe(12_345);
    expect(manual.sponsorship.totalQuantity).toBe(3);
  });

  it("insights 를 주면 교체하고 생성 시각을 수정 시각과 같게 기록한다", async () => {
    const insights: MonthlyReport["insights"] = [
      { title: "제목", description: "설명", type: "neutral" },
    ];
    const updated = await updateReport(2025, 1, { insights });
    expect(updated.insights).toEqual(insights);
    expect(updated.insightsGeneratedAt).toBe(updated.lastModifiedAt);

    const next = await updateReport(2025, 1, {});
    expect(next.insights).toEqual(insights);
    expect(next.insightsGeneratedAt).toBe(updated.insightsGeneratedAt);
  });

  it("수정 전 내용을 백업으로 남긴다", async () => {
    await updateReport(2025, 1, { naver: { revenue: 1_000 } });
    const versions = await listVersions(2025, 1);
    expect(versions).toHaveLength(1);
    expect(
      readStored(`2025-01.v${versions[0].timestamp}.json`).naver.revenue,
    ).toBe(100_000);
  });
});
