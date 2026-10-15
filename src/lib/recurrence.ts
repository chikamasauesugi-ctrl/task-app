import type { Task } from "./types";
import { dateKeyOf, timeOf } from "./time";

/** 繰り返しタスク task が dateKey の日に発生するか */
export function occursOn(task: Task, dateKey: string): boolean {
  if (task.repeat === "none") return false;
  const startDate = dateKeyOf(task.startAt);
  if (dateKey < startDate) return false;
  if (task.repeatUntil && dateKey >= task.repeatUntil) return false;
  if (task.excludedDates?.includes(dateKey)) return false;

  const [y, m, d] = dateKey.split("-").map(Number);
  const [sy, sm, sd] = startDate.split("-").map(Number);
  switch (task.repeat) {
    case "daily":
      return true;
    case "weekly":
      return new Date(y, m - 1, d).getDay() === new Date(sy, sm - 1, sd).getDay();
    case "monthly":
      // 月末例外の扱いは未確定のため、同じ「日」のみ発生（存在しない日はスキップ）
      return d === sd;
    default:
      return false;
  }
}

/** 繰り返しタスクの dateKey の回を仮想タスクとして展開する */
export function makeOccurrence(task: Task, dateKey: string): Task {
  return {
    ...task,
    startAt: `${dateKey}T${timeOf(task.startAt)}`,
    endAt: `${dateKey}T${timeOf(task.endAt)}`,
    status: task.occurrenceStatus?.[dateKey] ?? task.status,
    occurrenceDate: dateKey,
  };
}
