/**
 * 수량 표시 컴포넌트.
 * 숫자는 현재 폰트·색상을 상속하고, '개' 글자는 80% 크기 + 60% 불투명도로
 * KRWText의 '원'과 동일한 시각적 처리를 합니다.
 */
export default function QtyText({ n }: { n: number }) {
  return (
    <>
      {n.toLocaleString("ko-KR")}
      <span className="text-[0.8em] font-normal opacity-60 ml-0.5">개</span>
    </>
  );
}
