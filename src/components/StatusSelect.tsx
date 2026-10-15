"use client";

import { STATUS_LABELS, STATUS_ORDER, type TaskStatus } from "../lib/types";
import { BADGE_STYLES } from "./statusStyles";

interface Props {
  value: TaskStatus;
  onChange: (s: TaskStatus) => void;
}

/** 4段階ステータスのセグメント選択 */
export default function StatusSelect({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="ステータス" className="flex flex-wrap gap-2">
      {STATUS_ORDER.map((s) => {
        const selected = s === value;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(s)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              selected
                ? BADGE_STYLES[s]
                : "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
