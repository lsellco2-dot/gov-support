import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/ingest/cron-auth";
import {
  runYouthCenterIngest,
  youthCenterIngestErrorCode,
} from "@/lib/ingest/youthcenter/run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  const startedAt = Date.now();
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      failureResponse("UNAUTHORIZED", Date.now() - startedAt),
      { status: 401 },
    );
  }

  try {
    const report = await runYouthCenterIngest();
    console.info("[youthcenter] ingest completed", {
      fetched: report.fetched,
      inserted: report.inserted,
      updated: report.updated,
      closedSynced: report.closedSynced,
      pagesFetched: report.pagesFetched,
      apiCallCount: report.apiCallCount,
      dbWriteCount: report.dbWriteCount,
      fetchDurationMs: report.fetchDurationMs,
      transformDurationMs: report.transformDurationMs,
      upsertDurationMs: report.upsertDurationMs,
      durationMs: report.durationMs,
    });
    return NextResponse.json(publicResponse(report));
  } catch (error) {
    const errorCode = youthCenterIngestErrorCode(error);
    const durationMs = Date.now() - startedAt;
    console.error("[youthcenter] ingest failed", { errorCode, durationMs });
    return NextResponse.json(
      failureResponse(errorCode, durationMs),
      { status: errorCode === "MISSING_API_KEY" ? 500 : 502 },
    );
  }
}

function publicResponse(report: Awaited<ReturnType<typeof runYouthCenterIngest>>) {
  return {
    source: report.source,
    success: report.success,
    fetched: report.fetched,
    inserted: report.inserted,
    updated: report.updated,
    closedSynced: report.closedSynced,
    durationMs: report.durationMs,
    errorCode: report.errorCode,
  };
}

function failureResponse(errorCode: string, durationMs: number) {
  return {
    source: "youthcenter",
    success: false,
    fetched: 0,
    inserted: 0,
    updated: 0,
    closedSynced: 0,
    durationMs,
    errorCode,
  };
}

export const GET = handle;
export const POST = handle;
