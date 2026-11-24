"use client";

import { useState, useEffect, useRef } from "react";
import type { VenueInfo, OfflineData } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import { useVenueRegistry } from "@/hooks/useVenueRegistry";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeVenues: OfflineData[];
  year: number;
  month: number;
  onUpdate: (patch: object) => Promise<void>;
}

// ─── 토글 스위치 ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-300 ${
        checked ? "bg-brand-500" : "bg-gray-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

// ─── 입점처 행 ───────────────────────────────────────────────────────────

function VenueRow({
  venue,
  isActive,
  isToggling,
  onToggle,
  onRename,
  onDelete,
}: {
  venue: VenueInfo;
  isActive: boolean;
  isToggling: boolean;
  onToggle: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(venue.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== venue.name) {
      onRename(trimmed);
    } else {
      setEditName(venue.name);
    }
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-3 py-2.5 px-1 group">
      <Toggle checked={isActive} disabled={isToggling} onChange={onToggle} />

      {isEditing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setEditName(venue.name);
              setIsEditing(false);
            }
          }}
          className="flex-1 text-sm border border-brand-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-300"
        />
      ) : (
        <span
          className="flex-1 text-sm text-gray-800 cursor-pointer hover:text-brand-600"
          onClick={() => {
            setEditName(venue.name);
            setIsEditing(true);
          }}
        >
          {venue.name}
        </span>
      )}

      <button
        onClick={onDelete}
        className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1"
        title="삭제"
      >
        삭제
      </button>
    </div>
  );
}

// ─── 모달 본체 ───────────────────────────────────────────────────────────

export default function VenueModal({
  isOpen,
  onClose,
  activeVenues,
  year,
  month,
  onUpdate,
}: Props) {
  const { registry, refresh, createVenue, renameVenue, deleteVenue } =
    useVenueRegistry(isOpen);
  const [newName, setNewName] = useState("");
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const newInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !registry) return null;

  const activeIds = new Set(activeVenues.map((v) => v.venueId));

  const handleToggle = async (venue: VenueInfo) => {
    setTogglingIds((prev) => new Set(prev).add(venue.id));
    try {
      if (activeIds.has(venue.id)) {
        await onUpdate({ removeOfflineVenueId: venue.id });
      } else {
        await onUpdate({ addOfflineVenue: { id: venue.id, name: venue.name } });
      }
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(venue.id);
        return next;
      });
    }
  };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const isCreated = await createVenue(trimmed);
    if (isCreated) {
      setNewName("");
      await refresh();
      newInputRef.current?.focus();
    }
  };

  const handleRename = async (id: string, newVenueName: string) => {
    await renameVenue(id, newVenueName);
    await refresh();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`'${name}' 입점처를 삭제하시겠습니까?`)) return;
    // 활성 상태면 먼저 비활성화
    if (activeIds.has(id)) {
      await onUpdate({ removeOfflineVenueId: id });
    }
    await deleteVenue(id);
    await refresh();
  };

  return (
    <Modal
      title="오프라인 입점처 관리"
      subtitle={
        <>
          {year}년 {month}월 기준
        </>
      }
      onClose={onClose}
    >
      {/* 입점처 리스트 */}
      <div className="px-5 max-h-64 overflow-y-auto">
        {registry.venues.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            등록된 입점처가 없습니다.
          </p>
        ) : (
          <div className="divide-y divide-warm-100">
            {registry.venues.map((venue) => (
              <VenueRow
                key={venue.id}
                venue={venue}
                isActive={activeIds.has(venue.id)}
                isToggling={togglingIds.has(venue.id)}
                onToggle={() => handleToggle(venue)}
                onRename={(name) => handleRename(venue.id, name)}
                onDelete={() => handleDelete(venue.id, venue.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 입점처 추가 */}
      <div className="px-5 pb-5 pt-3 border-t border-warm-100 mt-2">
        <div className="flex gap-2">
          <input
            ref={newInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="새 입점처 이름"
            className="flex-1 text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            추가
          </button>
        </div>
      </div>
    </Modal>
  );
}
