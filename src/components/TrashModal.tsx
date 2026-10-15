"use client";

import {
  REPEAT_LABELS,
  TRASH_RETENTION_DAYS,
  type Task,
} from "../lib/types";
import { dateKeyOf, formatDateHeading, timeOf, toEpochMs } from "../lib/time";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  tasks: Task[];
  /** 現在のローカル日時 "YYYY-MM-DDTHH:mm" */
  now: string;
  onRestore: (id: string) => void;
  onClose: () => void;
}

/** ゴミ箱：削除から30日間は復元でき、期限が過ぎると自動で完全削除される */
export default function TrashModal({ tasks, now, onRestore, onClose }: Props) {
  const nowMs = toEpochMs(now);
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ゴミ箱"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold">ゴミ箱</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <p className="px-5 pt-3 text-xs text-zinc-500 dark:text-zinc-400">
          削除から{TRASH_RETENTION_DAYS}
          日間は復元できます。期限を過ぎると自動で完全に削除されます。
        </p>

        <ul className="flex-1 overflow-y-auto px-5 py-3">
          {tasks.length === 0 && (
            <li className="py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
              ゴミ箱は空です
            </li>
          )}
          {tasks.map((t) => {
            // now は分単位のため、削除直後は経過がわずかに負になる → 0日に丸める
            const elapsedDays = Math.max(
              0,
              Math.floor((nowMs - (t.deletedAt ?? 0)) / DAY_MS)
            );
            const remaining = Math.max(0, TRASH_RETENTION_DAYS - elapsedDays);
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 border-b border-zinc-100 py-3 last:border-b-0 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {t.title.trim() || "無題のタスク"}
                    {t.repeat !== "none" && (
                      <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                        {REPEAT_LABELS[t.repeat]}
                      </span>
                    )}
                  </p>
                  <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatDateHeading(dateKeyOf(t.startAt))} {timeOf(t.startAt)}
                    –{timeOf(t.endAt)}
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    残り{remaining}日で完全削除
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(t.id)}
                  className="shrink-0 rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50"
                >
                  復元
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
