import { useState } from "react";

/** 복구 안내 배너가 저절로 사라지기까지의 시간 (ms) */
export const RESTORE_BANNER_DURATION_MS = 8000;

/**
 * 버전 복구 안내 배너의 문구와 자동 숨김을 관리합니다.
 * 문구가 null이면 배너를 보이지 않습니다.
 */
export function useRestoreBanner() {
  const [restoreBanner, setRestoreBanner] = useState<string | null>(null);

  const showRestoreBanner = (message: string) => {
    setRestoreBanner(message);
    setTimeout(() => setRestoreBanner(null), RESTORE_BANNER_DURATION_MS);
  };

  const dismissRestoreBanner = () => setRestoreBanner(null);

  return { restoreBanner, showRestoreBanner, dismissRestoreBanner };
}
