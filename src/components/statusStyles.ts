import type { TaskStatus } from "../lib/types";

/** タスクブロックの配色（左の帯＋背景） */
export const BLOCK_STYLES: Record<TaskStatus, string> = {
  not_started:
    "border-zinc-400 bg-zinc-50 text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-100",
  in_progress:
    "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/70 dark:text-blue-100",
  on_hold:
    "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/70 dark:text-amber-100",
  done: "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-100",
};

/** ステータスバッジの配色 */
export const BADGE_STYLES: Record<TaskStatus, string> = {
  not_started:
    "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  in_progress:
    "bg-blue-600 text-white dark:bg-blue-500",
  on_hold:
    "bg-amber-500 text-white dark:bg-amber-500",
  done: "bg-emerald-600 text-white dark:bg-emerald-500",
};
