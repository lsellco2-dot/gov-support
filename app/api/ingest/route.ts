import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/ingest/cron-auth";
import { purgeExpiredAnnouncements, runIngest } from "@/lib/ingest/run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
  }
  try {
    const source = req.nextUrl.searchParams.get("source"); // ?source=bizinfo
    const results = await runIngest(source ? source.split(",") : undefined);
    const cleanup = await purgeExpiredAnnouncements();
    const ok =
      !cleanup.error &&
      results.every((result) => !result.error && result.failed === 0);
    return NextResponse.json(
      { ok, results, cleanup },
      { status: ok ? 200 : 500 },
    );
  } catch (error) {
    console.error("ingest 실행 실패:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { ok: false, error: "수집 작업을 실행하지 못했습니다." },
      { status: 500 }
    );
  }
}

// Vercel Cron은 GET으로 호출됨 (CRON_SECRET을 Bearer로 자동 첨부)
export const GET = handle;
export const POST = handle;
