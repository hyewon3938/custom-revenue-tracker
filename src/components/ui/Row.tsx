import type { ReactNode } from "react";

interface RowProps {
  label: string;
  value: ReactNode;
  border?: boolean;
  valueClassName?: string;
}

export default function Row({
  label,
  value,
  border = true,
  valueClassName = "text-sm font-semibold text-gray-800",
}: RowProps) {
  return (
    <div
      className={`flex justify-between items-center py-1.5 ${
        border ? "border-b border-warm-100 last:border-0" : ""
      }`}
    >
      <span className="text-sm text-gray-500">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}
