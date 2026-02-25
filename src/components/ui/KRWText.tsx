/**
 * 원화 금액 표시 컴포넌트.
 * 숫자는 현재 폰트·색상을 그대로 상속하고, '원' 글자는 80% 크기 + 60% 불투명도로
 * 살짝 작고 연하게 표시됩니다. (파란색 배경 / 흰색 배경 모두 대응)
 */
export default function KRWText({ n }: { n: number }) {
  return (
    <>
      {n.toLocaleString("ko-KR")}
      <span className="text-[0.8em] font-normal opacity-60 ml-0.5">원</span>
    </>
  );
}
