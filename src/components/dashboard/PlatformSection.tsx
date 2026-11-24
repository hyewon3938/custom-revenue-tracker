"use client";

import { useState } from "react";
import {
  NaverData,
  CoupangData,
  OfflineData,
  ProductMatrixRow,
} from "@/lib/types";
import VenueModal from "./VenueModal";
import NaverCard from "./platform/NaverCard";
import CoupangCard from "./platform/CoupangCard";
import OfflineCard from "./platform/OfflineCard";
import { getGridCols } from "./platform/grid-cols";

/** 항상 표시되는 온라인 카드 수 (네이버 + 쿠팡) */
const ONLINE_CARD_COUNT = 2;

interface Props {
  year: number;
  month: number;
  naver: NaverData;
  coupang: CoupangData;
  offline: OfflineData[];
  productMatrix: ProductMatrixRow[];
  onUpdate: (patch: object) => Promise<void>;
}

export default function PlatformSection({
  year,
  month,
  naver,
  coupang,
  offline,
  productMatrix,
  onUpdate,
}: Props) {
  const [venueModalOpen, setVenueModalOpen] = useState(false);

  // 카드 수에 따른 그리드 레이아웃
  const gridCols = getGridCols(ONLINE_CARD_COUNT + offline.length);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          플랫폼별 매출 · 비용
        </h3>
        <button
          onClick={() => setVenueModalOpen(true)}
          className="text-sm text-brand-500 hover:text-brand-600 font-medium transition-colors"
        >
          플랫폼 관리
        </button>
      </div>
      <div className={`grid ${gridCols} gap-4`}>
        <NaverCard data={naver} />
        <CoupangCard
          data={coupang}
          year={year}
          month={month}
          productMatrix={productMatrix}
          onUpdate={onUpdate}
        />
        {offline.map((venue) => (
          <OfflineCard
            key={venue.venueId}
            data={venue}
            productMatrix={productMatrix}
            onUpdate={async (patch: object) => {
              await onUpdate({
                ...(patch as Record<string, unknown>),
                offlineVenueId: venue.venueId,
              });
            }}
          />
        ))}
      </div>
      <VenueModal
        isOpen={venueModalOpen}
        onClose={() => setVenueModalOpen(false)}
        activeVenues={offline}
        year={year}
        month={month}
        onUpdate={onUpdate}
      />
    </section>
  );
}
