import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredAnnouncements, runIngest } from "@/lib/ingest/run";

export const maxDuration = 300; // Vercel Pro 기준. Hobby면 소스별 분할 호출 권장
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const source = req.nextUrl.searchParams.get("source"); // ?source=bizinfo
  const results = await runIngest(source ? source.split(",") : undefined);
  const cleanup = await purgeExpiredAnnouncements();
  return NextResponse.json({ ok: !cleanup.error, results, cleanup });
}

// Vercel Cron은 GET으로 호출됨 (CRON_SECRET을 Bearer로 자동 첨부)
export const GET = handle;
export const POST = handle;
