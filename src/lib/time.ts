import type { Task } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "YYYY-MM-DD"（ローカル） */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date → "YYYY-MM-DDTHH:mm"（ローカル） */
export function toLocalDateTime(d: Date): string {
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return toDateKey(new Date(y, m - 1, d + n));
}

export function formatDateHeading(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const w = ["日", "月", "火", "水", "木", "金", "土"][
    new Date(y, m - 1, d).getDay()
  ];
  return `${y}年${m}月${d}日（${w}）`;
}

/** "YYYY-MM-DDTHH:mm" → epoch ms（ローカル） */
export function toEpochMs(dateTime: string): number {
  const [y, m, d] = dateTime.slice(0, 10).split("-").map(Number);
  const [h, mi] = dateTime.slice(11, 16).split(":").map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
}

export function dateKeyOf(dateTime: string): string {
  return dateTime.slice(0, 10);
}

export function timeOf(dateTime: string): string {
  return dateTime.slice(11, 16);
}

/** 指定日の中での分（0〜1440）。日付が違う場合は日の境界へ丸める */
function minutesOn(dateKey: string, dateTime: string): number {
  const dk = dateKeyOf(dateTime);
  if (dk < dateKey) return 0;
  if (dk > dateKey) return 1440;
  const [h, m] = timeOf(dateTime).split(":").map(Number);
  return h * 60 + m;
}

export interface PositionedTask {
  task: Task;
  startMin: number;
  endMin: number;
  /** 重なりクラスタ内での列番号と総列数 */
  col: number;
  cols: number;
}

/** 指定日のタスクを重なり考慮で列割り当てする */
export function layoutDayTasks(tasks: Task[], dateKey: string): PositionedTask[] {
  const items = tasks
    .map((task) => {
      const startMin = minutesOn(dateKey, task.startAt);
      const endMin = Math.max(minutesOn(dateKey, task.endAt), startMin + 20);
      return { task, startMin, endMin };
    })
    .sort(
      (a, b) =>
        a.startMin - b.startMin ||
        a.endMin - b.endMin ||
        a.task.createdAt - b.task.createdAt
    );

  const result: PositionedTask[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    const placed = cluster.map((it) => {
      let col = colEnds.findIndex((end) => end <= it.startMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(it.endMin);
      } else {
        colEnds[col] = it.endMin;
      }
      return { ...it, col };
    });
    for (const p of placed) result.push({ ...p, cols: colEnds.length });
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of items) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return result;
}

/** 表示する時間帯（分）。予定に合わせて自動調整、最低 8:00〜20:00 */
export function displayRange(positioned: PositionedTask[]): {
  startMin: number;
  endMin: number;
} {
  let startMin = 8 * 60;
  let endMin = 20 * 60;
  for (const p of positioned) {
    // 移動時間帯も表示範囲に含める（旧データは travelMinutes 未設定のことがある）
    startMin = Math.min(startMin, p.startMin - (p.task.travelMinutes || 0) - 60);
    endMin = Math.max(endMin, p.endMin + 60);
  }
  startMin = Math.max(0, Math.floor(startMin / 60) * 60);
  endMin = Math.min(1440, Math.ceil(endMin / 60) * 60);
  return { startMin, endMin };
}

/** 終了時刻を過ぎた未完了タスクか */
export function isOverdue(task: Task, now: string): boolean {
  return task.status !== "done" && task.endAt < now;
}
