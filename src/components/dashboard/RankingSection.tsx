import { ProductRankEntry } from "@/lib/types";
import Card from "@/components/ui/Card";

function RankBadge({ rank }: { rank: number }) {
  // 1위: 금메달, 2위: 은메달, 3위: 동메달(연한), 그 외: 연회색
  const colors = [
    "bg-yellow-400 text-yellow-900",
    "bg-gray-300 text-gray-600",
    "bg-amber-200 text-amber-800",
  ];
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${
        colors[rank - 1] ?? "bg-gray-100 text-gray-400"
      }`}
    >
      {rank}
    </span>
  );
}

function RankTable({
  title,
  entries,
  showColumns,
}: {
  title: string;
  entries: ProductRankEntry[];
  showColumns?: boolean;
}) {
  return (
    <Card>
      <h4 className="font-semibold text-gray-800 mb-3">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">데이터 없음</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-warm-100">
              <th className="text-left py-1.5 font-normal text-xs text-gray-400 pr-2">
                상품
              </th>
              {showColumns ? (
                <>
                  <th className="text-right py-1.5 font-normal text-xs text-gray-400 px-1">N</th>
                  <th className="text-right py-1.5 font-normal text-xs text-gray-400 px-1">C</th>
                  <th className="text-right py-1.5 font-normal text-xs text-gray-400 px-1">OFF</th>
                  <th className="text-right py-1.5 font-normal text-xs text-gray-400 pl-1">합계</th>
                </>
              ) : (
                <th className="text-right py-1.5 font-normal text-xs text-gray-400">판매량</th>
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.productName} className="border-b border-warm-100 last:border-0">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-1.5">
                    <RankBadge rank={entry.rank} />
                    <span
                      className="text-gray-800 truncate max-w-[150px]"
                      title={entry.productName}
                    >
                      {entry.productName}
                    </span>
                    {entry.category === "handmade" && (
                      <span className="text-xs text-brand-400 shrink-0">끈갈피</span>
                    )}
                  </div>
                </td>
                {showColumns ? (
                  <>
                    <td className="text-right py-2 px-1 text-gray-500 text-xs">
                      {entry.naver > 0 ? entry.naver : "-"}
                    </td>
                    <td className="text-right py-2 px-1 text-gray-500 text-xs">
                      {entry.coupang > 0 ? entry.coupang : "-"}
                    </td>
                    <td className="text-right py-2 px-1 text-gray-500 text-xs">
                      {entry.offline > 0 ? entry.offline : "-"}
                    </td>
                    <td className="text-right py-2 pl-1 font-semibold">{entry.total}</td>
                  </>
                ) : (
                  <td className="text-right py-2 font-semibold">{entry.total}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

interface Props {
  overallRanking: ProductRankEntry[];
  naverRanking: ProductRankEntry[];
  coupangRanking: ProductRankEntry[];
  offlineRanking: ProductRankEntry[];
  sponsorExcludedRanking?: ProductRankEntry[];
}

export default function RankingSection({
  overallRanking,
  naverRanking,
  coupangRanking,
  offlineRanking,
  sponsorExcludedRanking,
}: Props) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">상품 랭킹</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 전체 + 협찬 제외 (좌측 컬럼) */}
        <div className="space-y-4">
          <RankTable title="전체 TOP 5" entries={overallRanking} showColumns />
          {sponsorExcludedRanking && sponsorExcludedRanking.length > 0 && (
            <RankTable title="협찬 제외 TOP 5" entries={sponsorExcludedRanking} showColumns />
          )}
        </div>
        {/* 플랫폼별 (우측 컬럼) */}
        <div className="space-y-4">
          <RankTable title="네이버 TOP 3" entries={naverRanking} />
          <RankTable title="쿠팡 TOP 3" entries={coupangRanking} />
          {offlineRanking.length > 0 && (
            <RankTable title="오프라인 TOP 3" entries={offlineRanking} />
          )}
        </div>
      </div>
    </section>
  );
}
