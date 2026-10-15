"use client";

import type { Task, TaskStatus } from "../lib/types";
import { dateKeyOf, displayRange, layoutDayTasks } from "../lib/time";
import TaskBlock from "./TaskBlock";

const HOUR_PX = 64;

interface Props {
  tasks: Task[];
  dateKey: string;
  /** 現在のローカル日時 "YYYY-MM-DDTHH:mm" */
  now: string;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}

export default function Timeline({
  tasks,
  dateKey,
  now,
  onEdit,
  onStatusChange,
}: Props) {
  const positioned = layoutDayTasks(tasks, dateKey);
  const { startMin, endMin } = displayRange(positioned);
  const height = ((endMin - startMin) / 60) * HOUR_PX;
  const toPx = (min: number) => ((min - startMin) / 60) * HOUR_PX;

  const hours: number[] = [];
  for (let m = startMin; m <= endMin; m += 60) hours.push(m);

  const nowMin =
    dateKeyOf(now) === dateKey
      ? Number(now.slice(11, 13)) * 60 + Number(now.slice(14, 16))
      : null;
  const showNowLine = nowMin !== null && nowMin >= startMin && nowMin <= endMin;

  return (
    <div className="relative" style={{ height }}>
      {/* 時間目盛り */}
      {hours.map((m) => (
        <div
          key={m}
          className="absolute left-0 right-0 flex items-start"
          style={{ top: toPx(m) }}
        >
          <span className="-mt-2 w-12 shrink-0 pr-2 text-right text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
            {`${String(m / 60).padStart(2, "0")}:00`}
          </span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}

      {/* タスク配置エリア */}
      <div className="absolute bottom-0 left-12 right-1 top-0">
        {positioned.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              この日のタスクはありません。右下の「＋」から登録できます。
            </p>
          </div>
        )}
        {/* 移動時間帯（この間は予定を登録できない） */}
        {positioned
          .filter((p) => (p.task.travelMinutes || 0) > 0)
          .map(({ task, startMin: s, col, cols }) => {
            const top = toPx(s - task.travelMinutes);
            const height = toPx(s) - top;
            return (
              <div
                key={`travel-${task.id}`}
                aria-label={`移動時間 ${task.travelMinutes}分`}
                style={{
                  top,
                  height,
                  left: `calc(${(col / cols) * 100}% + 2px)`,
                  width: `calc(${100 / cols}% - 6px)`,
                }}
                className="absolute flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-400 bg-zinc-100/70 text-[11px] text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400"
              >
                {height >= 18 && <span>🚶 移動 {task.travelMinutes}分</span>}
              </div>
            );
          })}
        {positioned.map(({ task, startMin: s, endMin: e, col, cols }) => (
          <TaskBlock
            key={task.id}
            task={task}
            now={now}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            style={{
              top: toPx(s),
              height: Math.max(toPx(e) - toPx(s), 28),
              left: `calc(${(col / cols) * 100}% + 2px)`,
              width: `calc(${100 / cols}% - 6px)`,
            }}
          />
        ))}
      </div>

      {/* 現在時刻ライン */}
      {showNowLine && (
        <div
          className="pointer-events-none absolute left-12 right-0 z-10"
          style={{ top: toPx(nowMin!) }}
        >
          <div className="relative h-0.5 bg-red-500">
            <span className="absolute -left-1.5 -top-[3px] h-2 w-2 rounded-full bg-red-500" />
          </div>
        </div>
      )}
    </div>
  );
}
