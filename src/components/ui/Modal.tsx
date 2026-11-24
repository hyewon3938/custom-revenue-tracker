import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  subtitle: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 모달 공통 껍데기 (오버레이 + 카드 + 헤더 + 닫기 버튼).
 * 배경 클릭과 닫기 버튼으로만 닫힌다. 열림 여부는 호출하는 쪽에서 판단한다.
 */
export default function Modal({
  title,
  subtitle,
  onClose,
  children,
}: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl border border-warm-200 shadow-lg w-full max-w-md mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
