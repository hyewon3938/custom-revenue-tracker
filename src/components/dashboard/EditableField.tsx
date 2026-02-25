"use client";

import { useState, useRef } from "react";

const formatKRW = (n: number) =>
  n.toLocaleString("ko-KR") + " 원";

interface Props {
  value: number;
  onSave: (newValue: number) => Promise<void>;
  className?: string;
}

/**
 * 클릭하면 숫자 입력 필드로 전환.
 * Enter / blur → onSave 호출 → 저장 완료 후 원래 표시로 복귀.
 * Escape → 취소.
 */
export default function EditableField({ value, onSave, className = "" }: Props) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setInputVal(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = async () => {
    const num = parseInt(inputVal.replace(/[^\d-]/g, "")) || 0;
    setEditing(false);
    if (num === value) return;
    setSaving(true);
    try {
      await onSave(num);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`w-32 border-b-2 border-brand-400 outline-none bg-brand-50 px-1 py-0.5 text-right font-semibold text-sm ${className}`}
        disabled={saving}
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      title="클릭하여 편집"
      className={`hover:bg-brand-50 hover:text-brand-600 rounded px-1 py-0.5 transition-colors cursor-text text-right font-semibold text-sm ${saving ? "opacity-40" : ""} ${className}`}
    >
      {formatKRW(value)}
    </button>
  );
}
