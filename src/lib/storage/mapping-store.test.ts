import path from "path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ProductMappingConfig } from "@/lib/types";
import { files } from "./test-utils/memory-fs";
import { makeProduct } from "./test-utils/fixtures";

vi.mock("fs/promises", async () =>
  (await import("./test-utils/memory-fs")).createFsMock(),
);

import { loadProductMapping, syncNewProductsToMapping } from "./mapping-store";

const MAPPING_PATH = path.join(process.cwd(), "data", "product-mapping.json");

function stored(): ProductMappingConfig {
  return JSON.parse(files.get(MAPPING_PATH) ?? "null") as ProductMappingConfig;
}

beforeEach(() => {
  files.clear();
});

describe("loadProductMapping", () => {
  it("파일이 없으면 null", async () => {
    expect(await loadProductMapping()).toBeNull();
  });

  it("ENOENT 가 아닌 에러는 그대로 던진다", async () => {
    files.set(MAPPING_PATH, "{ 깨진 JSON");
    await expect(loadProductMapping()).rejects.toThrow(SyntaxError);
  });

  it("저장된 설정을 그대로 돌려준다", async () => {
    const config: ProductMappingConfig = {
      mappings: [{ canonical: "달빛", naver: "달빛 끈갈피" }],
      generatedAt: "2025-01-01T00:00:00.000Z",
      confirmedByUser: true,
    };
    files.set(MAPPING_PATH, JSON.stringify(config));
    expect(await loadProductMapping()).toEqual(config);
  });
});

describe("syncNewProductsToMapping", () => {
  it("신규 상품이 없으면 0 을 반환하고 파일을 쓰지 않는다", async () => {
    expect(await syncNewProductsToMapping([], [])).toBe(0);
    expect(files.has(MAPPING_PATH)).toBe(false);

    const config: ProductMappingConfig = {
      mappings: [
        { canonical: "달빛", naver: "달빛 끈갈피", coupang: "달빛 북마크" },
      ],
      generatedAt: "2025-01-01T00:00:00.000Z",
      confirmedByUser: true,
    };
    const raw = JSON.stringify(config);
    files.set(MAPPING_PATH, raw);
    const added = await syncNewProductsToMapping(
      [makeProduct("달빛 끈갈피", 1, "naver")],
      [makeProduct("달빛 북마크", 1, "coupang")],
    );
    expect(added).toBe(0);
    expect(files.get(MAPPING_PATH)).toBe(raw);
  });

  it("매핑 파일이 없을 때 신규 상품을 유사도로 묶어 새 파일을 만든다", async () => {
    const added = await syncNewProductsToMapping(
      [
        makeProduct("[리커밋] 달빛 은하 끈갈피", 1, "naver"),
        makeProduct("[리커밋] 달빛 은하 끈갈피", 2, "naver"),
        makeProduct("노을 끈갈피", 1, "naver"),
      ],
      [
        makeProduct("달빛 은하 북마크", 1, "coupang"),
        makeProduct("바다 북마크", 1, "coupang"),
      ],
    );

    expect(added).toBe(3);
    const config = stored();
    expect(config.confirmedByUser).toBe(false);
    expect(typeof config.generatedAt).toBe("string");
    expect(config.mappings).toEqual([
      { canonical: "노을 끈갈피", naver: "노을 끈갈피" },
      {
        canonical: "달빛 은하 북마크",
        naver: "[리커밋] 달빛 은하 끈갈피",
        coupang: "달빛 은하 북마크",
      },
      { canonical: "바다 북마크", coupang: "바다 북마크" },
    ]);
    expect(files.get(MAPPING_PATH)).toBe(JSON.stringify(config, null, 2));
  });

  it("기존 매핑은 유지하고 generatedAt 을 보존하며 확인 상태를 해제한다", async () => {
    const config: ProductMappingConfig = {
      mappings: [
        { canonical: "하늘", naver: "하늘 끈갈피", coupang: "하늘 북마크" },
      ],
      generatedAt: "2025-01-01T00:00:00.000Z",
      confirmedByUser: true,
    };
    files.set(MAPPING_PATH, JSON.stringify(config));

    const added = await syncNewProductsToMapping(
      [
        makeProduct("하늘 끈갈피", 1, "naver"),
        makeProduct("가을 끈갈피", 1, "naver"),
      ],
      [makeProduct("하늘 북마크", 1, "coupang")],
    );

    expect(added).toBe(1);
    expect(stored()).toEqual({
      mappings: [
        { canonical: "가을 끈갈피", naver: "가을 끈갈피" },
        { canonical: "하늘", naver: "하늘 끈갈피", coupang: "하늘 북마크" },
      ],
      generatedAt: "2025-01-01T00:00:00.000Z",
      confirmedByUser: false,
    });
  });
});
