import { ProductMatrixRow, SponsoredItem } from "@/lib/types";

interface Props {
  matrix: ProductMatrixRow[];
  sponsoredItems?: SponsoredItem[];
}

export default function MatrixSection({ matrix, sponsoredItems = [] }: Props) {
  const sponsoredMap = new Map(sponsoredItems.map((i) => [i.productName, i.quantity]));
  const hasSponsorship = sponsoredItems.length > 0;

  // 판매량이 있거나 협찬 수량이 있는 행만 표시
  const visibleRows = matrix.filter(
    (row) => row.total > 0 || (sponsoredMap.get(row.productName) ?? 0) > 0
  );

  if (visibleRows.length === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        상품 × 플랫폼 매트릭스
      </h3>
      <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-100 border-b border-warm-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                상품명
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">
                네이버
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">
                쿠팡
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">
                오프라인
              </th>
              {hasSponsorship && (
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#2663EB" }}>
                  협찬
                </th>
              )}
              <th className="text-right px-4 py-3 font-medium text-gray-500">
                합계
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, idx) => {
              const sponsored = sponsoredMap.get(row.productName) ?? 0;
              return (
                <tr
                  key={row.productName}
                  className={`border-b border-warm-100 last:border-0 ${idx % 2 === 1 ? "bg-warm-100/40" : "bg-white"}`}
                >
                  <td className="px-4 py-2.5">
                    <span className="text-gray-800">{row.productName}</span>
                    {row.category === "handmade" && (
                      <span className="ml-2 text-xs text-brand-400">끈갈피</span>
                    )}
                  </td>
                  <td className="text-right px-4 py-2.5 text-gray-600">
                    {row.naver > 0 ? row.naver : <span className="text-gray-200">—</span>}
                  </td>
                  <td className="text-right px-4 py-2.5 text-gray-600">
                    {row.coupang > 0 ? row.coupang : <span className="text-gray-200">—</span>}
                  </td>
                  <td className="text-right px-4 py-2.5 text-gray-600">
                    {row.offline > 0 ? row.offline : <span className="text-gray-200">—</span>}
                  </td>
                  {hasSponsorship && (
                    <td className="text-right px-4 py-2.5" style={{ color: "#2663EB" }}>
                      {sponsored > 0 ? sponsored : <span className="text-gray-200">—</span>}
                    </td>
                  )}
                  <td className="text-right px-4 py-2.5 font-semibold text-gray-900">
                    {row.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
