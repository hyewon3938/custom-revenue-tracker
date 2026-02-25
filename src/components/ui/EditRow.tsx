"use client";

import EditableField from "@/components/dashboard/EditableField";

interface EditRowProps {
  label: string;
  value: number;
  onSave: (v: number) => Promise<void>;
}

export default function EditRow({ label, value, onSave }: EditRowProps) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-sm text-gray-500">
        {label} <span className="text-xs text-brand-400">(수기)</span>
      </span>
      <EditableField value={value} onSave={onSave} />
    </div>
  );
}
