import { describe, test, expect, vi, afterEach } from "vitest";
import { requestJson } from "./request";

const FALLBACK = "요청 실패";

interface FakeResponse {
  ok: boolean;
  json: () => Promise<unknown>;
}

function mockFetch(response: FakeResponse) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestJson", () => {
  // ─── 성공 응답 ────────────────────────────────────────────────────────────

  test("성공 응답의 본문을 파싱해 반환한다", async () => {
    mockFetch({ ok: true, json: async () => ({ value: 1 }) });

    const result = await requestJson<{ value: number }>(
      "/api/test",
      undefined,
      FALLBACK,
    );

    expect(result).toEqual({ value: 1 });
  });

  test("url과 init을 그대로 fetch에 넘긴다", async () => {
    const fetchMock = mockFetch({ ok: true, json: async () => ({}) });
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2025, month: 1 }),
    };

    await requestJson("/api/test", init, FALLBACK);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/test", init);
  });

  // ─── 실패 응답 ────────────────────────────────────────────────────────────

  test("실패 응답이면 본문의 error 필드를 메시지로 던진다", async () => {
    mockFetch({ ok: false, json: async () => ({ error: "서버 오류" }) });

    await expect(requestJson("/api/test", undefined, FALLBACK)).rejects.toThrow(
      "서버 오류",
    );
  });

  test("실패 응답에 error 필드가 없으면 fallback 메시지로 던진다", async () => {
    mockFetch({ ok: false, json: async () => ({}) });

    await expect(requestJson("/api/test", undefined, FALLBACK)).rejects.toThrow(
      FALLBACK,
    );
  });

  test("error 필드가 빈 문자열이면 fallback으로 바꾸지 않는다", async () => {
    mockFetch({ ok: false, json: async () => ({ error: "" }) });

    const error: unknown = await requestJson(
      "/api/test",
      undefined,
      FALLBACK,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("");
  });

  // ─── 가공 없이 전파되는 오류 ──────────────────────────────────────────────

  test("실패 응답의 본문 파싱 오류는 그대로 전파한다", async () => {
    const parseError = new SyntaxError("Unexpected token <");
    mockFetch({
      ok: false,
      json: async () => {
        throw parseError;
      },
    });

    await expect(requestJson("/api/test", undefined, FALLBACK)).rejects.toBe(
      parseError,
    );
  });

  test("성공 응답의 본문 파싱 오류는 그대로 전파한다", async () => {
    const parseError = new SyntaxError("Unexpected end of JSON input");
    mockFetch({
      ok: true,
      json: async () => {
        throw parseError;
      },
    });

    await expect(requestJson("/api/test", undefined, FALLBACK)).rejects.toBe(
      parseError,
    );
  });

  test("fetch가 던진 오류(타임아웃 등)는 name을 유지한 채 전파한다", async () => {
    const timeoutError = new Error("signal timed out");
    timeoutError.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));

    const error: unknown = await requestJson(
      "/api/test",
      undefined,
      FALLBACK,
    ).catch((e: unknown) => e);

    expect(error).toBe(timeoutError);
    expect((error as Error).name).toBe("TimeoutError");
  });
});
