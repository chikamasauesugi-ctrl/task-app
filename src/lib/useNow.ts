"use client";

import { useSyncExternalStore } from "react";
import { toLocalDateTime } from "./time";

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}

/**
 * 現在のローカル日時 "YYYY-MM-DDTHH:mm"（30秒ごとに更新）。
 * SSR中は null を返す。
 */
export function useNow(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => toLocalDateTime(new Date()),
    () => null
  );
}
