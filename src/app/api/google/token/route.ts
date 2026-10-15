import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 保存済みのリフレッシュトークンで Google のアクセストークンを発行する。
// クライアントシークレットはサーバー側（環境変数）だけで扱う。

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!supabaseUrl || !anonKey || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: "server_not_configured" },
      { status: 500 }
    );
  }

  const jwt = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    ""
  );
  if (!jwt) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 呼び出したユーザー本人として Supabase に接続（RLSで本人の行だけ読める）
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: row } = await supabase
    .from("google_tokens")
    .select("refresh_token")
    .maybeSingle();
  if (!row) {
    // 連携未設定（再ログインでカレンダー許可が必要）
    return NextResponse.json({ error: "not_connected" }, { status: 404 });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const body = (await tokenRes.json().catch(() => ({}))) as {
      error?: string;
    };
    if (body.error === "invalid_grant") {
      // 失効・取り消し済み → 行を消して再ログインを促す
      await supabase.from("google_tokens").delete().neq("refresh_token", "");
      return NextResponse.json({ error: "not_connected" }, { status: 410 });
    }
    return NextResponse.json({ error: "google_error" }, { status: 502 });
  }

  const token = (await tokenRes.json()) as {
    access_token: string;
    expires_in?: number;
  };
  return NextResponse.json({
    access_token: token.access_token,
    expires_in: token.expires_in ?? 3600,
  });
}
