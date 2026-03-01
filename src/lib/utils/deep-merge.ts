import type { DeepPartial } from "@/lib/types";

/** 중첩 객체를 재귀적으로 병합. 배열은 교체 방식. */
export function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const val = source[key as keyof typeof source];
    if (val === undefined) continue;

    const targetVal = (target as Record<string, unknown>)[key];
    if (
      typeof val === "object" &&
      val !== null &&
      !Array.isArray(val) &&
      typeof targetVal === "object" &&
      targetVal !== null
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetVal as object,
        val as DeepPartial<object>
      );
    } else {
      (result as Record<string, unknown>)[key] = val;
    }
  }
  return result;
}
