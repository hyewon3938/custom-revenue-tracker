import UnitText from "./UnitText";

/** 원화 금액 표시 컴포넌트 */
export default function KRWText({ n }: { n: number }) {
  return <UnitText n={n} unit="원" />;
}
