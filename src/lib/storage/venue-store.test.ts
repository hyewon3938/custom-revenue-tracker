import path from "path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { files } from "./test-utils/memory-fs";

vi.mock("fs/promises", async () =>
  (await import("./test-utils/memory-fs")).createFsMock(),
);

import type { VenueInfo } from "@/lib/types";
import {
  loadVenues,
  addVenue,
  renameVenue,
  deleteVenue,
  generateId,
} from "./venue-store";

const VENUE_PATH = path.join(process.cwd(), "data", "venues.json");

beforeEach(() => {
  files.clear();
});

describe("loadVenues", () => {
  it("파일이 없으면 기본 입점처로 파일을 만든다", async () => {
    const registry = await loadVenues();
    expect(registry.venues).toEqual([
      { id: "gosan", name: "고산의낮", createdAt: "2024-11-01T00:00:00.000Z" },
    ]);
    expect(files.get(VENUE_PATH)).toBe(JSON.stringify(registry, null, 2));
  });

  it("저장된 레지스트리를 그대로 돌려준다", async () => {
    const registry = { venues: [], lastModifiedAt: "2025-01-01T00:00:00.000Z" };
    files.set(VENUE_PATH, JSON.stringify(registry));
    expect(await loadVenues()).toEqual(registry);
  });
});

describe("addVenue", () => {
  it("이름에서 slug ID 를 만들고 저장한다", async () => {
    const venue = await addVenue("Book Cafe 서점!");
    expect(venue.id).toBe("book-cafe-서점");
    expect(venue.name).toBe("Book Cafe 서점!");
    expect((await loadVenues()).venues.map((v) => v.id)).toEqual([
      "gosan",
      "book-cafe-서점",
    ]);
  });

  it("ID 가 겹치면 2 부터 숫자를 붙인다", async () => {
    expect((await addVenue("Gosan")).id).toBe("gosan-2");
    expect((await addVenue("gosan")).id).toBe("gosan-3");
  });

  it("쓸 수 있는 문자가 없으면 venue 를 쓴다", async () => {
    expect((await addVenue("!!!")).id).toBe("venue");
    expect((await addVenue("???")).id).toBe("venue-2");
  });
});

describe("renameVenue / deleteVenue", () => {
  it("이름을 바꾸고 ID 는 유지한다", async () => {
    const renamed = await renameVenue("gosan", "새 이름");
    expect(renamed).toMatchObject({ id: "gosan", name: "새 이름" });
    expect((await loadVenues()).venues[0].name).toBe("새 이름");
  });

  it("삭제하면 목록에서 빠진다", async () => {
    await deleteVenue("gosan");
    expect((await loadVenues()).venues).toEqual([]);
  });

  it("없는 ID 는 에러", async () => {
    await expect(renameVenue("none", "x")).rejects.toThrow(
      "입점처 'none'를 찾을 수 없습니다.",
    );
    await expect(deleteVenue("none")).rejects.toThrow(
      "입점처 'none'를 찾을 수 없습니다.",
    );
  });
});

describe("generateId", () => {
  const venues = (...ids: string[]): VenueInfo[] =>
    ids.map((id) => ({ id, name: id, createdAt: "2025-01-01T00:00:00.000Z" }));

  it("영문은 소문자로, 한글·숫자는 그대로 둔다", () => {
    expect(generateId("BookCafe", [])).toBe("bookcafe");
    expect(generateId("책방2호점", [])).toBe("책방2호점");
  });

  it("그 밖의 문자는 하이픈으로 바꾸고 연속·양끝 하이픈을 정리한다", () => {
    expect(generateId("  Book   Cafe & 서점!! ", [])).toBe("book-cafe-서점");
    expect(generateId("a_b.c", [])).toBe("a-b-c");
  });

  it("쓸 수 있는 문자가 없으면 venue", () => {
    expect(generateId("", [])).toBe("venue");
    expect(generateId("!!!", [])).toBe("venue");
    expect(generateId("ㄱㄴㄷ", [])).toBe("venue");
  });

  it("겹치면 비어 있는 가장 작은 번호(2부터)를 붙인다", () => {
    expect(generateId("gosan", venues("gosan"))).toBe("gosan-2");
    expect(generateId("gosan", venues("gosan", "gosan-2"))).toBe("gosan-3");
    expect(generateId("gosan", venues("gosan", "gosan-3"))).toBe("gosan-2");
    expect(generateId("gosan", venues("gosan-2"))).toBe("gosan");
  });
});
