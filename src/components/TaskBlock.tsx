"use client";

import { STATUS_LABELS, STATUS_ORDER, type Task, type TaskStatus } from "../lib/types";
import { isOverdue, timeOf } from "../lib/time";
import { BADGE_STYLES, BLOCK_STYLES } from "./statusStyles";

interface Props {
  task: Task;
  /** 現在のローカル日時 "YYYY-MM-DDTHH:mm" */
  now: string;
  style: React.CSSProperties;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}

export default function TaskBlock({
  task,
  now,
  style,
  onEdit,
  onStatusChange,
}: Props) {
  const isGoogle = task.source === "google";
  const overdue = !isGoogle && isOverdue(task, now);
  const title = task.title.trim() || "無題のタスク";
  const nextStatus =
    STATUS_ORDER[(STATUS_ORDER.indexOf(task.status) + 1) % STATUS_ORDER.length];

  return (
    <div
      style={style}
      className={`absolute overflow-hidden rounded-lg border-l-4 shadow-sm ${
        isGoogle
          ? "border-purple-500 bg-purple-50 text-purple-900 dark:bg-purple-950/70 dark:text-purple-100"
          : BLOCK_STYLES[task.status]
      } ${overdue ? "ring-2 ring-red-500" : ""}`}
    >
      <button
        type="button"
        onClick={() => onEdit(task)}
        className="flex h-full w-full flex-col items-start gap-0.5 px-2 py-1 text-left"
        aria-label={`「${title}」を編集`}
      >
        <span className="flex w-full items-center gap-1.5 pr-12">
          <span className="text-[11px] font-semibold tabular-nums opacity-70">
            {timeOf(task.startAt)}–{timeOf(task.endAt)}
          </span>
          {task.repeat !== "none" && (
            <span aria-label="繰り返し" title="繰り返し予定" className="text-[11px] opacity-70">
              🔁
            </span>
          )}
          {overdue && (
            <span className="rounded bg-red-600 px-1 text-[10px] font-bold text-white">
              超過
            </span>
          )}
        </span>
        <span
          className={`w-full truncate text-sm font-semibold ${
            task.status === "done" ? "line-through opacity-60" : ""
          }`}
        >
          {title}
        </span>
        {task.locationType !== "none" && (
          <span className="w-full truncate text-xs opacity-70">
            {task.locationType === "online"
              ? "💻 オンライン"
              : `📍 ${task.address || "場所未入力"}`}
          </span>
        )}
        {task.memo && (
          <span className="w-full truncate text-xs opacity-60">{task.memo}</span>
        )}
      </button>
      {isGoogle ? (
        <span className="absolute right-1 top-1 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-purple-500">
          Google
        </span>
      ) : (
        /* ステータスバッジ：タップで次のステータスへ切替 */
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(task, nextStatus);
          }}
          title={`タップで「${STATUS_LABELS[nextStatus]}」へ`}
          aria-label={`ステータス: ${STATUS_LABELS[task.status]}。タップで「${STATUS_LABELS[nextStatus]}」へ変更`}
          className={`absolute right-1 top-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${BADGE_STYLES[task.status]}`}
        >
          {STATUS_LABELS[task.status]}
        </button>
      )}
    </div>
  );
}
