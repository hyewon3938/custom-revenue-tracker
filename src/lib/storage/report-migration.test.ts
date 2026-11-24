import { describe, it, expect } from "vitest";
import { migrateReport, ensureInboundShippingFee } from "./report-migration";
import {
  makeReport,
  makeNaver,
  makeVenue,
  makeFees,
  omit,
} from "./test-utils/fixtures";

/** 저장 파일을 읽은 직후와 같은 평범한 객체로 변환 */
function asRaw(value: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

describe("migrateReport", () => {
  it("입력 객체를 직접 변경하고 같은 참조를 돌려준다", () => {
    const raw = asRaw(omit(makeReport(2025, 1), "warnings"));
    const result = migrateReport(raw);
    expect(result).toBe(raw);
    expect(raw.warnings).toEqual([]);
  });

  it("최신 형식 레포트는 내용이 바뀌지 않는다", () => {
    const report = makeReport(2025, 1);
    expect(migrateReport(asRaw(report))).toEqual(report);
  });

  it("구버전 offline 단일 객체: venueId 가 없으면 gosan 을 넣고 배열로 감싼다", () => {
    const single = omit(makeVenue(), "venueId");
    const raw = asRaw({ ...makeReport(2025, 1), offline: single });
    const result = migrateReport(raw);
    expect(result.offline).toEqual([{ ...single, venueId: "gosan" }]);
  });

  it("구버전 offline 단일 객체: venueId 가 빈 문자열이어도 gosan 으로 채운다", () => {
    const raw = asRaw({
      ...makeReport(2025, 1),
      offline: makeVenue({ venueId: "" }),
    });
    expect(migrateReport(raw).offline[0].venueId).toBe("gosan");
  });

  it("구버전 offline 단일 객체: 기존 venueId 는 유지한다", () => {
    const raw = asRaw({
      ...makeReport(2025, 1),
      offline: makeVenue({ venueId: "other-shop" }),
    });
    expect(migrateReport(raw).offline.map((v) => v.venueId)).toEqual([
      "other-shop",
    ]);
  });

  it("offline 이 이미 배열이면 venueId 누락을 채우지 않는다", () => {
    const raw = asRaw({
      ...makeReport(2025, 1),
      offline: [omit(makeVenue(), "venueId")],
    });
    expect(migrateReport(raw).offline[0].venueId).toBeUndefined();
  });

  it("offline 이 없으면 그대로 둔다", () => {
    const raw = asRaw(omit(makeReport(2025, 1), "offline"));
    expect(migrateReport(raw).offline).toBeUndefined();
  });

  it("naver 의 payerCount·shippingCollected 누락은 0, 있는 값은 유지", () => {
    const missing = migrateReport(
      asRaw({
        ...makeReport(2025, 1),
        naver: omit(makeNaver(), "shippingCollected", "payerCount"),
      }),
    );
    expect(missing.naver.shippingCollected).toBe(0);
    expect(missing.naver.payerCount).toBe(0);

    const partial = migrateReport(
      asRaw({
        ...makeReport(2025, 1),
        naver: omit(makeNaver({ shippingCollected: 9_000 }), "payerCount"),
      }),
    );
    expect(partial.naver.shippingCollected).toBe(9_000);
    expect(partial.naver.payerCount).toBe(0);
  });

  it("inboundShippingFee 누락은 네이버·쿠팡·모든 입점처에 0, 있는 값은 유지", () => {
    const oldFees = omit(
      makeFees({ commissionFee: 1_000 }),
      "inboundShippingFee",
    );
    const base = makeReport(2025, 1);
    const result = migrateReport(
      asRaw({
        ...base,
        naver: { ...base.naver, fees: oldFees },
        coupang: { ...base.coupang, fees: oldFees },
        offline: [
          { ...makeVenue(), fees: oldFees },
          makeVenue({
            venueId: "b",
            fees: makeFees({ inboundShippingFee: 700 }),
          }),
        ],
      }),
    );
    expect(result.naver.fees).toEqual({ ...oldFees, inboundShippingFee: 0 });
    expect(result.coupang.fees.inboundShippingFee).toBe(0);
    expect(result.offline[0].fees.inboundShippingFee).toBe(0);
    expect(result.offline[1].fees.inboundShippingFee).toBe(700);
  });

  it("구버전 offline 단일 객체도 감싼 뒤 inboundShippingFee 를 채운다", () => {
    const single = {
      ...omit(makeVenue(), "venueId"),
      fees: omit(makeFees(), "inboundShippingFee"),
    };
    const result = migrateReport(
      asRaw({ ...makeReport(2025, 1), offline: single }),
    );
    expect(result.offline[0].venueId).toBe("gosan");
    expect(result.offline[0].fees.inboundShippingFee).toBe(0);
  });

  it("warnings 누락은 빈 배열, 있는 값은 유지", () => {
    const warnings = [{ level: "warn" as const, message: "확인 필요" }];
    expect(
      migrateReport(asRaw(makeReport(2025, 1, { warnings }))).warnings,
    ).toEqual(warnings);
    expect(
      migrateReport(asRaw(omit(makeReport(2025, 1), "warnings"))).warnings,
    ).toEqual([]);
  });

  it("누락 케이스가 한꺼번에 있어도 모두 처리한다", () => {
    const base = makeReport(2025, 1);
    const result = migrateReport(
      asRaw({
        period: base.period,
        naver: {
          ...omit(makeNaver(), "shippingCollected", "payerCount"),
          fees: omit(makeFees(), "inboundShippingFee"),
        },
        coupang: base.coupang,
        offline: omit(makeVenue(), "venueId"),
      }),
    );
    expect(result.naver.shippingCollected).toBe(0);
    expect(result.naver.payerCount).toBe(0);
    expect(result.naver.fees.inboundShippingFee).toBe(0);
    expect(result.offline).toHaveLength(1);
    expect(result.offline[0].venueId).toBe("gosan");
    expect(result.warnings).toEqual([]);
  });
});

describe("ensureInboundShippingFee", () => {
  it("fees 가 있고 값이 없을 때만 0 을 넣는다", () => {
    const missing = { fees: { commissionFee: 100 } as Record<string, unknown> };
    ensureInboundShippingFee(missing);
    expect(missing.fees).toEqual({ commissionFee: 100, inboundShippingFee: 0 });

    const present = { fees: { inboundShippingFee: 500 } };
    ensureInboundShippingFee(present);
    expect(present.fees.inboundShippingFee).toBe(500);
  });

  it("객체가 아니거나 fees 가 없으면 아무것도 하지 않는다", () => {
    const noFees = { revenue: 1_000 };
    ensureInboundShippingFee(noFees);
    expect(noFees).toEqual({ revenue: 1_000 });
    expect(() => ensureInboundShippingFee(undefined)).not.toThrow();
    expect(() => ensureInboundShippingFee(null)).not.toThrow();
    expect(() => ensureInboundShippingFee("text")).not.toThrow();
  });
});
