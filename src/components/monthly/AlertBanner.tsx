"use client";

interface Props {
  /** error: 오류 안내, restore: 닫기 버튼이 있는 버전 복구 안내 */
  variant: "error" | "restore";
  message: string;
  /** restore 배너의 닫기 버튼을 눌렀을 때 */
  onDismiss?: () => void;
}

export default function AlertBanner({ variant, message, onDismiss }: Props) {
  if (variant === "error") {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {message}
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center justify-between">
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="text-blue-400 hover:text-blue-600 ml-4 shrink-0"
      >
        &times;
      </button>
    </div>
  );
}
