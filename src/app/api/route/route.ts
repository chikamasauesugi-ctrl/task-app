import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Google Routes API で2地点間の移動時間を計算する。
// APIキーはサーバー側（環境変数 GOOGLE_MAPS_API_KEY）だけで扱う。

const MODE_MAP: Record<string, string> = {
  driving: "DRIVE",
  walking: "WALK",
  bicycling: "BICYCLE",
  transit: "TRANSIT",
};

interface RouteRequest {
  origin?: string;
  destination?: string;
  mode?: string;
  /** 到着希望のローカル日時 "YYYY-MM-DDTHH:mm"（電車・バスで使用） */
  arrivalAt?: string;
  /** クライアントのタイムゾーンオフセット（例 "+09:00"） */
  tzOffset?: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  // 未設定・プレースホルダーのまま（ASCII以外を含む）は未構成として扱う
  if (!apiKey || !/^[\x21-\x7e]+$/.test(apiKey)) {
    return NextResponse.json(
      { error: "server_not_configured" },
      { status: 500 }
    );
  }

  // Supabase 利用時はログイン済みユーザーのみ（APIキーの濫用防止）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && anonKey) {
    const jwt = (req.headers.get("authorization") ?? "").replace(
      /^Bearer\s+/i,
      ""
    );
    if (!jwt) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase.auth.getUser(jwt);
    if (error || !data.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = (await req.json().catch(() => ({}))) as RouteRequest;
  const origin = body.origin?.trim();
  const destination = body.destination?.trim();
  const travelMode = MODE_MAP[body.mode ?? ""];
  if (!origin || !destination || !travelMode) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const routeBody: Record<string, unknown> = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode,
    languageCode: "ja",
  };
  if (travelMode === "DRIVE") {
    // 交通状況を考慮（departureTime 省略時は現在時刻）
    routeBody.routingPreference = "TRAFFIC_AWARE";
  }
  if (travelMode === "TRANSIT" && body.arrivalAt && body.tzOffset) {
    const arrival = new Date(`${body.arrivalAt}:00${body.tzOffset}`);
    // 過去の到着時刻は指定できないため、未来のときだけ渡す
    if (arrival.getTime() > Date.now() + 60_000) {
      routeBody.arrivalTime = arrival.toISOString();
    }
  }

  const res = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify(routeBody),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Routes API エラー:", res.status, detail.slice(0, 500));
    return NextResponse.json(
      { error: res.status === 403 ? "api_key_rejected" : "google_error" },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    routes?: { duration?: string; distanceMeters?: number }[];
  };
  const route = data.routes?.[0];
  if (!route?.duration) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const seconds = Number(route.duration.replace(/s$/, ""));
  return NextResponse.json({
    minutes: Math.max(1, Math.ceil(seconds / 60)),
    distanceMeters: route.distanceMeters ?? null,
  });
}
