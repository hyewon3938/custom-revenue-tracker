import { PlatformProfit } from "@/lib/types";
import Row from "@/components/ui/Row";
import KRWText from "@/components/ui/KRWText";
import NetProfitRow from "./NetProfitRow";

interface Props {
  profit: PlatformProfit;
  /** 감싸는 div 의 여백·구분선 클래스 (카드마다 다르다) */
  className: string;
}

/** 이익 · 부자재비 · 순이익 블록 (세 카드 공통) */
export default function ProfitBlock({ profit, className }: Props) {
  return (
    <div className={className}>
      <Row label="이익" value={<KRWText n={profit.profit} />} />
      <Row label="부자재비" value={<KRWText n={profit.materialCost} />} />
      <NetProfitRow value={profit.netProfit} />
    </div>
  );
}
