/** 고산의낮 계산 방식 안내 툴팁 (hover 시 표시) */
export default function GosanTooltip() {
  return (
    <div className="relative group">
      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold cursor-default select-none">
        i
      </span>
      <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 z-10 rounded-lg bg-gray-800 text-white text-xs p-3 shadow-lg pointer-events-none">
        <p className="font-semibold mb-1.5">고산의낮 계산 방식</p>
        <ul className="space-y-1 text-gray-200 list-disc list-inside">
          <li>매출은 할인가(입점수수료 차감 후)의 실수령액</li>
          <li>부자재비 = (매출 + 입점수수료) × 15%로 정가 기준 계산</li>
          <li>입점수수료는 별도로 차감되지 않으므로 0으로 입력</li>
        </ul>
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-800" />
      </div>
    </div>
  );
}
