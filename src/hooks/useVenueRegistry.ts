import { useState, useEffect, useCallback } from "react";
import type { VenueInfo } from "@/lib/types";

const VENUES_ENDPOINT = "/api/venues";
const JSON_HEADERS = { "Content-Type": "application/json" };

interface VenueRegistry {
  venues: VenueInfo[];
  lastModifiedAt: string;
}

/**
 * 입점처 레지스트리 조회·변경 요청.
 * 변경 요청은 목록을 다시 불러오지 않으므로 호출하는 쪽에서 refresh 순서를 정한다.
 */
export function useVenueRegistry(isOpen: boolean) {
  const [registry, setRegistry] = useState<VenueRegistry | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(VENUES_ENDPOINT);
    if (res.ok) setRegistry(await res.json());
  }, []);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  /** 추가 성공 여부(res.ok)를 돌려준다 */
  const createVenue = async (name: string): Promise<boolean> => {
    const res = await fetch(VENUES_ENDPOINT, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name }),
    });
    return res.ok;
  };

  const renameVenue = async (id: string, name: string): Promise<void> => {
    await fetch(VENUES_ENDPOINT, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ id, name }),
    });
  };

  const deleteVenue = async (id: string): Promise<void> => {
    await fetch(VENUES_ENDPOINT, {
      method: "DELETE",
      headers: JSON_HEADERS,
      body: JSON.stringify({ id }),
    });
  };

  return { registry, refresh, createVenue, renameVenue, deleteVenue };
}
