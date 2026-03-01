import UnitText from "./UnitText";

/** 수량 표시 컴포넌트 */
export default function QtyText({ n }: { n: number }) {
  return <UnitText n={n} unit="개" />;
}
