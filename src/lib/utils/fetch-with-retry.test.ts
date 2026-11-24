import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchJsonWithRetry } from "./fetch-with-retry";

const REQUEST = { url: "https://example.test/api", init: { method: "GET" } };

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200 });
}

function errorResponse(status: number, text: string): Response {
  return new Response(text, { status });
}

function timeoutError(): Error {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

describe("fetchJsonWithRetry", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("첫 시도에 성공하면 JSON을 반환하고 재시도하지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    const buildRequest = vi.fn(() => REQUEST);

    const result = await fetchJsonWithRetry<{ ok: number }>({
      label: "테스트",
      buildRequest,
    });

    expect(result).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(buildRequest).toHaveBeenCalledTimes(1);
  });

  test("요청에 init을 그대로 넘기고 타임아웃 signal을 붙인다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await fetchJsonWithRetry({
      label: "테스트",
      buildRequest: () => ({
        url: REQUEST.url,
        init: { method: "POST", headers: { Authorization: "x" }, body: "{}" },
      }),
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(REQUEST.url);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ Authorization: "x" });
    expect(init?.body).toBe("{}");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("실패 후 1초, 2초 간격으로 재시도해 성공한다", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(errorResponse(500, "boom"))
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    const buildRequest = vi.fn(() => REQUEST);

    const promise = fetchJsonWithRetry({ label: "테스트", buildRequest });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toEqual({ ok: 1 });
    // 요청은 시도마다 새로 만든다
    expect(buildRequest).toHaveBeenCalledTimes(3);
  });

  test("3회 모두 실패하면 마지막 에러를 그대로 던진다", async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(500, "first"))
      .mockResolvedValueOnce(errorResponse(502, "second"))
      .mockResolvedValueOnce(errorResponse(503, "third"));

    const promise = fetchJsonWithRetry({
      label: "테스트",
      buildRequest: () => REQUEST,
    });
    const assertion = expect(promise).rejects.toThrow(
      "테스트 API 에러 (503): third",
    );

    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("마지막 시도가 타임아웃이면 안내 메시지로 바꿔 던진다", async () => {
    fetchMock.mockRejectedValue(timeoutError());

    const promise = fetchJsonWithRetry({
      label: "테스트",
      buildRequest: () => REQUEST,
    });
    const assertion = expect(promise).rejects.toThrow(
      "테스트 API 응답 없음 (30000ms 초과, 3회 시도)",
    );

    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("buildRequest가 던진 에러도 재시도 대상이다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    const buildRequest = vi
      .fn<() => typeof REQUEST>()
      .mockImplementationOnce(() => {
        throw new Error("token");
      })
      .mockReturnValue(REQUEST);

    const promise = fetchJsonWithRetry({ label: "테스트", buildRequest });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toEqual({ ok: 1 });
    expect(buildRequest).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("ok가 아닌 응답이면 본문을 읽기 전에 onErrorStatus를 호출한다", async () => {
    const calls: string[] = [];
    const response = errorResponse(401, "unauthorized");
    const originalText = response.text.bind(response);
    response.text = () => {
      calls.push("text");
      return originalText();
    };
    fetchMock.mockResolvedValueOnce(response);

    const promise = fetchJsonWithRetry({
      label: "테스트",
      buildRequest: () => REQUEST,
      onErrorStatus: (status) => calls.push(`status:${status}`),
      maxRetries: 1,
    });

    await expect(promise).rejects.toThrow(
      "테스트 API 에러 (401): unauthorized",
    );
    expect(calls).toEqual(["status:401", "text"]);
  });

  test("maxRetries, backoffMs, timeoutMs 옵션이 횟수·대기·메시지에 반영된다", async () => {
    fetchMock.mockRejectedValue(timeoutError());

    const promise = fetchJsonWithRetry({
      label: "테스트",
      buildRequest: () => REQUEST,
      maxRetries: 2,
      backoffMs: 50,
      timeoutMs: 10,
    });
    const assertion = expect(promise).rejects.toThrow(
      "테스트 API 응답 없음 (10ms 초과, 2회 시도)",
    );

    await vi.advanceTimersByTimeAsync(49);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
