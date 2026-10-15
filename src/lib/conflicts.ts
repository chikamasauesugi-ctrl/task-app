import type { Task } from "./types";
import { toEpochMs } from "./time";

const MIN_MS = 60 * 1000;

interface Interval {
  start: number;
  end: number;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** タスク本体の時間帯 */
function taskInterval(t: {
  startAt: string;
  endAt: string;
}): Interval {
  return { start: toEpochMs(t.startAt), end: toEpochMs(t.endAt) };
}

/** タスク開始前の移動時間帯（移動なしなら null） */
function travelInterval(t: {
  startAt: string;
  travelMinutes: number;
}): Interval | null {
  if (t.travelMinutes <= 0) return null;
  const start = toEpochMs(t.startAt);
  return { start: start - t.travelMinutes * MIN_MS, end: start };
}

export interface TravelConflict {
  /** 衝突相手のタスク */
  task: Task;
  /** "their-travel"：相手の移動中に予定を入れようとした / "my-travel"：自分の移動が相手の時間と重なる */
  kind: "their-travel" | "my-travel";
}

/**
 * 移動中の時間帯には予定を入れられない、のチェック。
 * candidate（登録・編集しようとしている値）が、その日の他タスクの移動時間帯と
 * 重なる場合（または candidate 自身の移動が他タスクと重なる場合）に衝突を返す。
 */
export function findTravelConflict(
  dayTasks: Task[],
  candidate: { startAt: string; endAt: string; travelMinutes: number },
  excludeId?: string
): TravelConflict | null {
  const candTask = taskInterval(candidate);
  const candTravel = travelInterval(candidate);

  for (const other of dayTasks) {
    if (excludeId && other.id === excludeId) continue;
    const otherTask = taskInterval(other);
    const otherTravel = travelInterval(other);

    // 相手の移動中に予定を入れようとしている
    if (otherTravel && overlaps(candTask, otherTravel)) {
      return { task: other, kind: "their-travel" };
    }
    // 自分の移動時間が相手の予定・移動と重なっている
    if (candTravel && (overlaps(candTravel, otherTask) ||
      (otherTravel !== null && overlaps(candTravel, otherTravel)))) {
      return { task: other, kind: "my-travel" };
    }
  }
  return null;
}
