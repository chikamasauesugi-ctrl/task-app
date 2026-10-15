export type TaskStatus = "not_started" | "in_progress" | "on_hold" | "done";

export const STATUS_ORDER: TaskStatus[] = [
  "not_started",
  "in_progress",
  "on_hold",
  "done",
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "未着手",
  in_progress: "進行中",
  on_hold: "保留",
  done: "完了",
};

export type RepeatFreq = "none" | "daily" | "weekly" | "monthly";

export const REPEAT_ORDER: RepeatFreq[] = ["none", "daily", "weekly", "monthly"];

export const REPEAT_LABELS: Record<RepeatFreq, string> = {
  none: "なし",
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
};

export type LocationType = "none" | "place" | "online";

export const LOCATION_ORDER: LocationType[] = ["none", "place", "online"];

export const LOCATION_LABELS: Record<LocationType, string> = {
  none: "指定なし",
  place: "場所",
  online: "オンライン",
};

export interface Task {
  id: string;
  title: string;
  /** ローカル日時 "YYYY-MM-DDTHH:mm"（必須）。繰り返しタスクでは初回の日時 */
  startAt: string;
  /** ローカル日時 "YYYY-MM-DDTHH:mm"（必須） */
  endAt: string;
  memo: string;
  status: TaskStatus;
  /** 実施形式：指定なし・場所（対面）・オンライン */
  locationType: LocationType;
  /** 実施形式が「場所」のときの住所 */
  address: string;
  /** この予定へ向かう移動時間（分）。0なら移動なし。経路APIによる自動計算は今後対応 */
  travelMinutes: number;
  createdAt: number;
  /** 繰り返し。"none" 以外は繰り返しの親タスク（各回は仮想的に展開する） */
  repeat: RepeatFreq;
  /** 繰り返しの終了日 "YYYY-MM-DD"（この日を含まない）。「以降すべて」編集で使う */
  repeatUntil?: string;
  /** 個別編集・個別削除で除外した日付 "YYYY-MM-DD" のリスト */
  excludedDates?: string[];
  /** 日付ごとのステータス上書き（繰り返しタスク用） */
  occurrenceStatus?: Record<string, TaskStatus>;
  /** ゴミ箱に入れた日時（epoch ms）。null/undefined なら通常表示 */
  deletedAt?: number | null;
  /** このタスクから作成した Google カレンダー予定のID（自動書き込み用） */
  googleEventId?: string | null;
  /** 実行時のみ：仮想展開された回の日付 "YYYY-MM-DD"（保存しない） */
  occurrenceDate?: string;
  /** 実行時のみ：Googleカレンダー由来の予定（読み取り専用、保存しない） */
  source?: "google";
  /** Google予定を Google カレンダーで開くリンク */
  htmlLink?: string;
}

/** フォームから受け取るタスクの入力値 */
export type TaskInput = Pick<
  Task,
  | "title"
  | "startAt"
  | "endAt"
  | "memo"
  | "status"
  | "repeat"
  | "locationType"
  | "address"
  | "travelMinutes"
>;

/** ゴミ箱の保持日数 */
export const TRASH_RETENTION_DAYS = 30;

/** 繰り返し編集・削除の適用範囲 */
export type EditScope = "this" | "following" | "all";

export const SCOPE_LABELS: Record<EditScope, string> = {
  this: "この予定のみ",
  following: "この予定以降すべて",
  all: "すべての予定",
};
