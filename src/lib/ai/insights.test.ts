import { describe, test, expect, vi, afterEach } from "vitest";
import {
  MonthlyOverview,
  MonthlyReport,
  PlatformFees,
  ProductRankEntry,
  SalesInsight,
} from "@/lib/types";
import { AI_MODEL, GROQ_API_KEY } from "@/lib/config";
import { buildPrompt, generateSalesInsights } from "./insights";

// ─── 픽스처 (임의의 둥근 숫자) ─────────────────────────────────────────

type Report = Omit<MonthlyReport, "insights">;

const fees = (overrides: Partial<PlatformFees> = {}): PlatformFees => ({
  commissionFee: 0,
  logisticsFee: 0,
  inboundShippingFee: 0,
  adFee: 0,
  settlementAmount: 0,
  ...overrides,
});

const rank = (
  rankNo: number,
  productName: string,
  naver: number,
  coupang: number,
  offline: number,
): ProductRankEntry => ({
  rank: rankNo,
  productName,
  category: "handmade",
  total: naver + coupang + offline,
  naver,
  coupang,
  offline,
});

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    period: { year: 2025, month: 3 },
    dataRange: { start: "2025-03-01", end: "2025-03-31" },
    naver: {
      revenue: 500000,
      shippingCollected: 30000,
      payerCount: 20,
      totalQuantity: 50,
      handmadeQuantity: 40,
      otherQuantity: 10,
      fees: fees({
        commissionFee: 20000,
        logisticsFee: 10000,
        settlementAmount: 470000,
      }),
      shippingStats: { regularCount: 15, freeCount: 5, sellerCost: 10000 },
      profit: { profit: 470000, materialCost: 75000, netProfit: 395000 },
      products: [],
    },
    coupang: {
      revenue: 300000,
      totalQuantity: 30,
      handmadeQuantity: 30,
      otherQuantity: 0,
      fees: fees({
        commissionFee: 30000,
        logisticsFee: 40000,
        inboundShippingFee: 5000,
        adFee: 50000,
      }),
      profit: { profit: 175000, materialCost: 45000, netProfit: 130000 },
      products: [],
    },
    offline: [
      {
        venueId: "venue-a",
        venueName: "가상서점",
        revenue: 100000,
        totalQuantity: 10,
        handmadeQuantity: 10,
        otherQuantity: 0,
        fees: fees({ commissionFee: 30000, logisticsFee: 4000, adFee: 1000 }),
        profit: { profit: 65000, materialCost: 20000, netProfit: 45000 },
        products: [],
      },
      {
        venueId: "venue-b",
        venueName: "가상책방",
        revenue: 0,
        totalQuantity: 0,
        handmadeQuantity: 0,
        otherQuantity: 0,
        fees: fees(),
        profit: { profit: 0, materialCost: 0, netProfit: 0 },
        products: [],
      },
    ],
    sponsorship: {
      items: [
        {
          productName: "달빛 끈갈피",
          category: "handmade",
          quantity: 3,
          unitPrice: 10000,
        },
        { productName: "숲 끈갈피", category: "handmade", quantity: 2 },
      ],
      marketingCost: 30000,
      totalQuantity: 5,
      handmadeQuantity: 5,
    },
    summary: {
      totalRevenue: 900000,
      totalCommissionFee: 80000,
      totalLogisticsFee: 54000,
      totalInboundShippingFee: 5000,
      totalAdFee: 51000,
      totalProfit: 710000,
      totalMaterialCost: 140000,
      marketingCost: 30000,
      totalNetProfit: 540000,
      totalQuantity: 90,
      handmadeQuantity: 80,
      otherQuantity: 10,
    },
    naverRanking: [],
    coupangRanking: [],
    offlineRanking: [],
    overallRanking: [
      rank(1, "달빛 끈갈피", 20, 15, 5),
      rank(2, "숲 끈갈피", 10, 10, 5),
      rank(3, "바다 끈갈피", 10, 5, 0),
    ],
    sponsorExcludedRanking: [
      rank(1, "달빛 끈갈피", 17, 15, 5),
      rank(2, "숲 끈갈피", 8, 10, 5),
    ],
    productMatrix: [
      {
        productName: "달빛 끈갈피",
        category: "handmade",
        naver: 20,
        coupang: 15,
        offline: 5,
        total: 40,
      },
      {
        productName: "숲 끈갈피",
        category: "handmade",
        naver: 10,
        coupang: 10,
        offline: 5,
        total: 25,
      },
      {
        productName: "바다 끈갈피",
        category: "handmade",
        naver: 10,
        coupang: 5,
        offline: 0,
        total: 15,
      },
      {
        productName: "엽서 세트",
        category: "other",
        naver: 10,
        coupang: 0,
        offline: 0,
        total: 10,
      },
      {
        productName: "미판매 끈갈피",
        category: "handmade",
        naver: 0,
        coupang: 0,
        offline: 0,
        total: 0,
      },
    ],
    warnings: [],
    collectedAt: "2025-04-01T00:00:00.000Z",
    lastModifiedAt: "2025-04-01T00:00:00.000Z",
    ...overrides,
  };
}

/** 직전 달: 협찬 있음, TOP5 구성이 당월과 다름 */
function makePrevReport(): Report {
  const base = makeReport();
  return makeReport({
    period: { year: 2025, month: 2 },
    dataRange: { start: "2025-02-01", end: "2025-02-28" },
    naver: { ...base.naver, revenue: 400000 },
    coupang: {
      ...base.coupang,
      revenue: 0,
      fees: fees({ commissionFee: 0, logisticsFee: 0, adFee: 0 }),
    },
    sponsorship: {
      items: [
        { productName: "숲 끈갈피", category: "handmade", quantity: 4 },
        { productName: "별 끈갈피", category: "handmade", quantity: 1 },
      ],
      marketingCost: 20000,
      totalQuantity: 5,
      handmadeQuantity: 5,
    },
    summary: {
      ...base.summary,
      totalRevenue: 600000,
      totalNetProfit: 300000,
      totalQuantity: 60,
      handmadeQuantity: 50,
    },
    overallRanking: [
      rank(1, "숲 끈갈피", 10, 0, 5),
      rank(2, "별 끈갈피", 8, 0, 2),
      rank(3, "달빛 끈갈피", 5, 0, 0),
    ],
    productMatrix: [
      {
        productName: "숲 끈갈피",
        category: "handmade",
        naver: 10,
        coupang: 0,
        offline: 5,
        total: 15,
      },
    ],
  });
}

/** 전전전달: 매출·판매량 0 */
function makeOldReport(): Report {
  const base = makeReport();
  return makeReport({
    period: { year: 2024, month: 12 },
    dataRange: { start: "2024-12-01", end: "2024-12-31" },
    sponsorship: {
      items: [],
      marketingCost: 0,
      totalQuantity: 0,
      handmadeQuantity: 0,
    },
    summary: {
      ...base.summary,
      totalRevenue: 0,
      totalNetProfit: 0,
      totalQuantity: 0,
      handmadeQuantity: 0,
    },
  });
}

const overviewMonth = (
  month: number,
  overrides: Partial<MonthlyOverview> = {},
): MonthlyOverview => ({
  period: { year: 2025, month },
  label: `2025.${String(month).padStart(2, "0")}`,
  totalRevenue: 0,
  totalNetProfit: 0,
  totalQuantity: 0,
  handmadeQuantity: 0,
  otherQuantity: 0,
  marginRate: 0,
  naverRevenue: 0,
  coupangRevenue: 0,
  offlineRevenue: 0,
  naverAdFee: 0,
  coupangAdFee: 0,
  sponsorshipCost: 0,
  ...overrides,
});

const OVERVIEW: MonthlyOverview[] = [
  overviewMonth(1),
  overviewMonth(2, {
    totalRevenue: 600000,
    totalNetProfit: 300000,
    totalQuantity: 60,
    handmadeQuantity: 50,
    otherQuantity: 10,
    marginRate: 50,
    naverRevenue: 400000,
    offlineRevenue: 200000,
    sponsorshipCost: 20000,
  }),
  overviewMonth(3, {
    totalRevenue: 900000,
    totalNetProfit: 540000,
    totalQuantity: 90,
    handmadeQuantity: 80,
    otherQuantity: 10,
    marginRate: 60,
    naverRevenue: 500000,
    coupangRevenue: 300000,
    offlineRevenue: 100000,
    naverAdFee: 10000,
    coupangAdFee: 50000,
    sponsorshipCost: 30000,
  }),
];

const NO_SPONSORSHIP: Report["sponsorship"] = {
  items: [],
  marketingCost: 0,
  totalQuantity: 0,
  handmadeQuantity: 0,
};

// ─── buildPrompt ───────────────────────────────────────────────────────

describe("buildPrompt", () => {
  test("히스토리 없이 당월 데이터만으로 프롬프트를 만든다", () => {
    expect(buildPrompt(makeReport())).toMatchSnapshot();
  });

  test("히스토리와 전체 개요가 있으면 추이·전달 비교·개요 섹션을 붙인다", () => {
    const history = [makePrevReport(), null, makeOldReport()];
    expect(buildPrompt(makeReport(), history, OVERVIEW)).toMatchSnapshot();
  });

  test("직전 달이 없고 더 이전 달만 있으면 추이 표만 붙인다", () => {
    const history = [null, makePrevReport()];
    expect(buildPrompt(makeReport(), history)).toMatchSnapshot();
  });

  test("히스토리가 모두 비어 있으면 추이 섹션을 생략한다", () => {
    expect(buildPrompt(makeReport(), [null, null])).toBe(
      buildPrompt(makeReport()),
    );
  });

  test("개요가 3개월 미만이면 개요 섹션을 생략한다", () => {
    expect(buildPrompt(makeReport(), undefined, OVERVIEW.slice(1))).toBe(
      buildPrompt(makeReport()),
    );
  });

  test("협찬·랭킹·판매량·오프라인이 비어 있는 레포트도 처리한다", () => {
    const base = makeReport();
    const empty = makeReport({
      offline: [],
      sponsorship: NO_SPONSORSHIP,
      summary: {
        ...base.summary,
        totalRevenue: 0,
        totalNetProfit: 0,
        totalQuantity: 0,
        handmadeQuantity: 0,
        otherQuantity: 0,
      },
      coupang: { ...base.coupang, fees: fees() },
      overallRanking: [],
      sponsorExcludedRanking: [],
      productMatrix: [],
    });
    expect(buildPrompt(empty)).toMatchSnapshot();
  });
});

// ─── generateSalesInsights (fetch 대역) ────────────────────────────────

interface CapturedBody {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  max_tokens: number;
}

const insight = (
  type: SalesInsight["type"],
  title: string,
  description = `${title} 설명`,
): SalesInsight => ({ title, description, type, category: "revenue" });

const FULL_INSIGHTS: SalesInsight[] = [
  insight("action", "액션 하나"),
  insight("action", "액션 둘"),
  insight("positive", "긍정 하나"),
  insight("negative", "부정 하나"),
  insight("positive", "긍정 둘"),
  insight("neutral", "중립 하나"),
];

const okResponse = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
  });

/** 응답 본문을 순서대로 돌려주는 fetch 대역을 설치하고 호출 기록을 반환 */
function stubGroq(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const res of responses) fetchMock.mockResolvedValueOnce(res);
  vi.stubGlobal("fetch", fetchMock);

  const bodyOf = (callIndex: number): CapturedBody =>
    JSON.parse(String(fetchMock.mock.calls[callIndex][1]?.body)) as CapturedBody;

  return { fetchMock, bodyOf };
}

describe("generateSalesInsights", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("타입 분포가 충족되면 한 번만 호출하고 그대로 반환한다", async () => {
    const { fetchMock, bodyOf } = stubGroq(
      okResponse(JSON.stringify(FULL_INSIGHTS)),
    );

    const result = await generateSalesInsights(makeReport());

    expect(result).toEqual(FULL_INSIGHTS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    // 키 값이 실패 메시지에 찍히지 않도록 일치 여부만 비교
    expect(headers.Authorization === `Bearer ${GROQ_API_KEY}`).toBe(true);

    const body = bodyOf(0);
    expect(body.model).toBe(AI_MODEL);
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(4096);
    expect(body.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(body.messages[1].content).toBe(
      `다음 판매 데이터를 분석하여 핵심 인사이트 7~12개를 JSON 배열로 제공해주세요.\n\n${buildPrompt(makeReport())}`,
    );
  });

  test("시스템 프롬프트 문자열을 고정한다", async () => {
    const { bodyOf } = stubGroq(okResponse(JSON.stringify(FULL_INSIGHTS)));

    await generateSalesInsights(makeReport());

    expect(bodyOf(0).messages[0].content).toMatchSnapshot();
  });

  test("히스토리와 개요를 데이터 메시지에 반영한다", async () => {
    const { bodyOf } = stubGroq(okResponse(JSON.stringify(FULL_INSIGHTS)));
    const history = [makePrevReport(), null, makeOldReport()];

    await generateSalesInsights(makeReport(), history, OVERVIEW);

    expect(bodyOf(0).messages[1].content).toBe(
      `다음 판매 데이터를 분석하여 핵심 인사이트 7~12개를 JSON 배열로 제공해주세요.\n\n${buildPrompt(makeReport(), history, OVERVIEW)}`,
    );
  });

  test("코드블록·앞뒤 잡음이 섞인 응답에서 배열을 뽑고 한자를 치환한다", async () => {
    const noisy = [
      insight("action", "廣告 재개", "前月 대비 **增加**한 채널에 集中"),
      ...FULL_INSIGHTS.slice(1),
    ];
    stubGroq(
      okResponse(
        `분석 결과입니다.\n\`\`\`json\n${JSON.stringify(noisy, null, 2)}\n\`\`\`\n참고하세요.`,
      ),
    );

    const result = await generateSalesInsights(makeReport());

    expect(result[0]).toEqual(
      insight("action", "광고 재개", "전월 대비 **증가**한 채널에 집중"),
    );
    expect(result.slice(1)).toEqual(FULL_INSIGHTS.slice(1));
  });

  test("타입이 부족하면 보충 호출을 하고 중복 제거 없이 이어 붙인다", async () => {
    const first = [
      insight("action", "액션 하나"),
      insight("positive", "긍정 하나"),
      insight("neutral", "중립 하나"),
    ];
    const supplement = [
      insight("action", "액션 하나"), // 1차와 같은 제목 — 그대로 유지된다
      insight("negative", "부정 하나"),
    ];
    const { fetchMock, bodyOf } = stubGroq(
      okResponse(JSON.stringify(first)),
      okResponse(JSON.stringify(supplement)),
    );

    const result = await generateSalesInsights(makeReport());

    expect(result).toEqual([...first, ...supplement]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = bodyOf(0);
    const secondBody = bodyOf(1);
    expect(secondBody.messages.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(secondBody.messages[0]).toEqual(firstBody.messages[0]);
    expect(secondBody.messages[1]).toEqual(firstBody.messages[1]);
    expect(secondBody.messages[2].content).toBe(JSON.stringify(first));
    expect(secondBody.messages[3].content).toMatchSnapshot();
  });

  test("action만 부족하면 보충 프롬프트에 action 요청만 담는다", async () => {
    const first = [
      insight("positive", "긍정 하나"),
      insight("negative", "부정 하나"),
      insight("positive", "긍정 둘"),
    ];
    const { bodyOf } = stubGroq(
      okResponse(JSON.stringify(first)),
      okResponse("[]"),
    );

    const result = await generateSalesInsights(makeReport());

    expect(result).toEqual(first);
    expect(bodyOf(1).messages[3].content).toMatchSnapshot();
  });

  test("보충 응답 파싱에 실패하면 1차 결과를 그대로 반환한다", async () => {
    const first = [insight("neutral", "중립 하나")];
    const { fetchMock } = stubGroq(
      okResponse(JSON.stringify(first)),
      okResponse("죄송합니다. 추가할 내용이 없습니다."),
    );

    const result = await generateSalesInsights(makeReport());

    expect(result).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("1차 응답에 JSON 배열이 없으면 파싱 실패 에러를 던진다", async () => {
    stubGroq(okResponse("배열이 없는 응답"));

    await expect(generateSalesInsights(makeReport())).rejects.toThrow(
      "인사이트 JSON 파싱 실패",
    );
  });

  test("1차 응답의 JSON이 깨져 있으면 파싱 실패 에러를 던진다", async () => {
    stubGroq(okResponse('[{"title": "닫히지 않은 객체"]'));

    await expect(generateSalesInsights(makeReport())).rejects.toThrow(
      "인사이트 JSON 파싱 실패",
    );
  });

  test("HTTP 오류면 응답의 에러 메시지를 담아 던진다", async () => {
    stubGroq(
      new Response(JSON.stringify({ error: { message: "rate limit" } }), {
        status: 429,
      }),
    );

    await expect(generateSalesInsights(makeReport())).rejects.toThrow(
      "Groq API 오류: rate limit",
    );
  });

  test("HTTP 오류 본문이 JSON이 아니면 상태 코드를 담아 던진다", async () => {
    stubGroq(new Response("Bad Gateway", { status: 502 }));

    await expect(generateSalesInsights(makeReport())).rejects.toThrow(
      "Groq API 오류: HTTP 502",
    );
  });

  test("응답에 텍스트가 없으면 에러를 던진다", async () => {
    stubGroq(new Response(JSON.stringify({ choices: [] }), { status: 200 }));

    await expect(generateSalesInsights(makeReport())).rejects.toThrow(
      "Groq API에서 텍스트 응답을 받지 못했습니다.",
    );
  });
});
