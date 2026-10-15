-- タスク管理アプリ スキーマ（Supabase SQL Editor で実行する）
-- 日時はフロントエンドと同じローカル表記のまま text で保持する（個人利用MVP）

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  start_at text not null,          -- "YYYY-MM-DDTHH:mm"
  end_at text not null,            -- "YYYY-MM-DDTHH:mm"
  memo text not null default '',
  status text not null default 'not_started',
  location_type text not null default 'none',
  address text not null default '',
  travel_minutes integer not null default 0,
  repeat text not null default 'none',
  repeat_until text,               -- "YYYY-MM-DD"（この日を含まない）
  excluded_dates jsonb,            -- ["YYYY-MM-DD", ...]
  occurrence_status jsonb,         -- {"YYYY-MM-DD": "done", ...}
  deleted_at bigint,               -- ゴミ箱入りの epoch ms。null なら通常表示
  google_event_id text,            -- 自動書き込みした Google 予定のID
  created_at bigint not null
);

-- 既存テーブルに後から追加する場合用（再実行しても安全）
alter table public.tasks add column if not exists google_event_id text;

-- Google カレンダー常時連携用のリフレッシュトークン保管（本人のみ読み書き可）
create table if not exists public.google_tokens (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at bigint not null
);

alter table public.google_tokens enable row level security;

drop policy if exists "own token select" on public.google_tokens;
create policy "own token select" on public.google_tokens
  for select using (user_id = auth.uid());

drop policy if exists "own token insert" on public.google_tokens;
create policy "own token insert" on public.google_tokens
  for insert with check (user_id = auth.uid());

drop policy if exists "own token update" on public.google_tokens;
create policy "own token update" on public.google_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own token delete" on public.google_tokens;
create policy "own token delete" on public.google_tokens
  for delete using (user_id = auth.uid());

create index if not exists tasks_user_id_idx on public.tasks (user_id);

-- Row Level Security：本人の行だけ読み書きできる
alter table public.tasks enable row level security;

drop policy if exists "own tasks select" on public.tasks;
create policy "own tasks select" on public.tasks
  for select using (user_id = auth.uid());

drop policy if exists "own tasks insert" on public.tasks;
create policy "own tasks insert" on public.tasks
  for insert with check (user_id = auth.uid());

drop policy if exists "own tasks update" on public.tasks;
create policy "own tasks update" on public.tasks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own tasks delete" on public.tasks;
create policy "own tasks delete" on public.tasks
  for delete using (user_id = auth.uid());
