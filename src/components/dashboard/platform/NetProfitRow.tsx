import KRWText from "@/components/ui/KRWText";

export default function NetProfitRow({ value }: { value: number }) {
  return (
    <div className="flex justify-between items-center pt-2">
      <span className="text-sm font-semibold text-gray-700">순이익</span>
      <span
        className={`text-sm font-bold ${
          value >= 0 ? "text-brand-500" : "text-red-500"
        }`}
      >
        <KRWText n={value} />
      </span>
    </div>
  );
}
