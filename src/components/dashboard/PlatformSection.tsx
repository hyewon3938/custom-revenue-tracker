"use client";

import { NaverData, CoupangData, OfflineData } from "@/lib/types";
import EditableField from "./EditableField";

const krw = (n: number) =>
  n.toLocaleString("ko-KR", { style: "currency", currency: "KRW" });

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

function EditRow({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (v: number) => Promise<void>;
}) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">
        {label}{" "}
        <span className="text-xs text-blue-400">(수기)</span>
      </span>
      <EditableField value={value} onSave={onSave} />
    </div>
  );
}

function NetProfitRow({ value }: { value: number }) {
  return (
    <div className="flex justify-between items-center pt-2">
      <span className="text-sm font-semibold text-gray-700">순이익</span>
      <span
        className={`text-sm font-bold ${value >= 0 ? "text-blue-600" : "text-red-500"}`}
      >
        {krw(value)}
      </span>
    </div>
  );
}

// ─── 네이버 카드 ────────────────────────────────────────────────────────────

function NaverCard({
  data,
  onUpdate,
}: {
  data: NaverData;
  onUpdate: (patch: object) => Promise<void>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">네이버 스마트스토어</h4>
        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          N
        </span>
      </div>

      <Row label="매출" value={krw(data.revenue)} />
      <Row label="정산금" value={krw(data.fees.settlementAmount)} />
      <Row label="수수료" value={krw(data.fees.commissionFee)} />
      <Row label="물류비 (배송비)" value={krw(data.fees.logisticsFee)} />
      <EditRow
        label="광고비"
        value={data.fees.adFee}
        onSave={(v) => onUpdate({ naver: { fees: { adFee: v } } })}
      />

      <div className="mt-3 pt-3 border-t border-gray-100">
        <Row label="이익" value={krw(data.profit.profit)} />
        <Row label="부자재비" value={krw(data.profit.materialCost)} />
        <NetProfitRow value={data.profit.netProfit} />
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1.5">판매량</p>
        <p className="text-sm text-gray-700">
          전체 {data.totalQuantity}개 · 끈갈피 {data.handmadeQuantity}개
        </p>
        {(data.shippingStats.regularCount + data.shippingStats.freeCount) > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            일반배송 {data.shippingStats.regularCount}건 ·{" "}
            무료배송 {data.shippingStats.freeCount}건
          </p>
        )}
      </div>
    </div>
  );
}

// ─── 쿠팡 카드 ─────────────────────────────────────────────────────────────

function CoupangCard({ data }: { data: CoupangData }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">쿠팡</h4>
        <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
          C
        </span>
      </div>

      <Row label="매출" value={krw(data.revenue)} />
      <Row label="판매수수료" value={krw(data.fees.commissionFee)} />
      <Row label="풀필먼트 물류비" value={krw(data.fees.logisticsFee)} />
      <Row label="광고비" value={krw(data.fees.adFee)} />

      <div className="mt-3 pt-3 border-t border-gray-100">
        <Row label="이익" value={krw(data.profit.profit)} />
        <Row label="부자재비" value={krw(data.profit.materialCost)} />
        <NetProfitRow value={data.profit.netProfit} />
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1.5">판매량</p>
        <p className="text-sm text-gray-700">
          전체 {data.totalQuantity}개 · 끈갈피 {data.handmadeQuantity}개
        </p>
      </div>
    </div>
  );
}

// ─── 오프라인 카드 ──────────────────────────────────────────────────────────

function OfflineCard({
  data,
  onUpdate,
}: {
  data: OfflineData;
  onUpdate: (patch: object) => Promise<void>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">{data.venueName}</h4>
        <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
          OFF
        </span>
      </div>

      <EditRow
        label="매출"
        value={data.revenue}
        onSave={(v) => onUpdate({ offline: { revenue: v } })}
      />
      <EditRow
        label="입점 수수료"
        value={data.fees.commissionFee}
        onSave={(v) => onUpdate({ offline: { fees: { commissionFee: v } } })}
      />
      <EditRow
        label="광고비"
        value={data.fees.adFee}
        onSave={(v) => onUpdate({ offline: { fees: { adFee: v } } })}
      />

      <div className="mt-3 pt-3 border-t border-gray-100">
        <Row label="이익" value={krw(data.profit.profit)} />
        <Row label="부자재비" value={krw(data.profit.materialCost)} />
        <NetProfitRow value={data.profit.netProfit} />
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1.5">판매량</p>
        <p className="text-sm text-gray-700">
          전체 {data.totalQuantity}개 · 끈갈피 {data.handmadeQuantity}개
        </p>
      </div>
    </div>
  );
}

// ─── 메인 섹션 ──────────────────────────────────────────────────────────────

interface Props {
  naver: NaverData;
  coupang: CoupangData;
  offline: OfflineData;
  onUpdate: (patch: object) => Promise<void>;
}

export default function PlatformSection({
  naver,
  coupang,
  offline,
  onUpdate,
}: Props) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        플랫폼별 매출 · 비용
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NaverCard data={naver} onUpdate={onUpdate} />
        <CoupangCard data={coupang} />
        <OfflineCard data={offline} onUpdate={onUpdate} />
      </div>
    </section>
  );
}
