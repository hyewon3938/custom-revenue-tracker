import { describe, it, expect } from "vitest";
import { withLock } from "./report-lock";

/** 바깥에서 끝낼 수 있는 Promise */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** 대기 중인 마이크로태스크를 모두 흘려보낸다 */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("withLock", () => {
  it("작업의 반환값을 그대로 돌려준다", async () => {
    await expect(withLock("lock-return", async () => 42)).resolves.toBe(42);
  });

  it("같은 키의 동시 호출은 호출 순서대로 하나씩 실행한다", async () => {
    const log: string[] = [];
    const gateA = deferred();
    const gateB = deferred();

    const a = withLock("lock-serial", async () => {
      log.push("a:start");
      await gateA.promise;
      log.push("a:end");
      return "a";
    });
    const b = withLock("lock-serial", async () => {
      log.push("b:start");
      await gateB.promise;
      log.push("b:end");
      return "b";
    });
    const c = withLock("lock-serial", async () => {
      log.push("c:start");
      return "c";
    });

    await flush();
    expect(log).toEqual(["a:start"]);

    gateA.resolve();
    await flush();
    expect(log).toEqual(["a:start", "a:end", "b:start"]);

    gateB.resolve();
    await expect(Promise.all([a, b, c])).resolves.toEqual(["a", "b", "c"]);
    expect(log).toEqual(["a:start", "a:end", "b:start", "b:end", "c:start"]);
  });

  it("앞 작업이 실패해도 다음 작업은 실행되고, 실패는 해당 호출자에게만 전달된다", async () => {
    const log: string[] = [];
    const gate = deferred();

    const failing = withLock("lock-fail", async () => {
      log.push("fail:start");
      await gate.promise;
      throw new Error("쓰기 실패");
    });
    const following = withLock("lock-fail", async () => {
      log.push("next:start");
      return "ok";
    });

    await flush();
    expect(log).toEqual(["fail:start"]);

    gate.resolve();
    await expect(failing).rejects.toThrow("쓰기 실패");
    await expect(following).resolves.toBe("ok");
    expect(log).toEqual(["fail:start", "next:start"]);

    // 실패 뒤에 새로 들어온 호출도 정상 실행
    await expect(withLock("lock-fail", async () => "later")).resolves.toBe(
      "later",
    );
  });

  it("키가 다르면 서로 기다리지 않는다", async () => {
    const log: string[] = [];
    const gate = deferred();

    const blocked = withLock("lock-key-1", async () => {
      log.push("1:start");
      await gate.promise;
      log.push("1:end");
    });
    await withLock("lock-key-2", async () => {
      log.push("2:done");
    });

    expect(log).toEqual(["1:start", "2:done"]);
    gate.resolve();
    await blocked;
    expect(log).toEqual(["1:start", "2:done", "1:end"]);
  });
});
