import { ProductMatrixRow } from "@/lib/types";

interface Props {
  matrix: ProductMatrixRow[];
}

export default function MatrixSection({ matrix }: Props) {
  const visibleRows = matrix.filter((row) => row.total > 0);
  if (visibleRows.length === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        상품 × 플랫폼 매트릭스
      </h3>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
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
              <th className="text-right px-4 py-3 font-medium text-gray-500">
                합계
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, idx) => (
              <tr
                key={row.productName}
                className={`border-b border-gray-50 last:border-0 ${idx % 2 === 1 ? "bg-gray-50/40" : "bg-white"}`}
              >
                <td className="px-4 py-2.5">
                  <span className="text-gray-800">{row.productName}</span>
                  {row.category === "handmade" && (
                    <span className="ml-2 text-xs text-blue-400">끈갈피</span>
                  )}
                </td>
                <td className="text-right px-4 py-2.5 text-gray-600">
                  {row.naver > 0 ? (
                    row.naver
                  ) : (
                    <span className="text-gray-200">—</span>
                  )}
                </td>
                <td className="text-right px-4 py-2.5 text-gray-600">
                  {row.coupang > 0 ? (
                    row.coupang
                  ) : (
                    <span className="text-gray-200">—</span>
                  )}
                </td>
                <td className="text-right px-4 py-2.5 text-gray-600">
                  {row.offline > 0 ? (
                    row.offline
                  ) : (
                    <span className="text-gray-200">—</span>
                  )}
                </td>
                <td className="text-right px-4 py-2.5 font-semibold text-gray-900">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
