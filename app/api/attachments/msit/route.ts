import { NextRequest, NextResponse } from "next/server";
import {
  buildMsitDetailUrl,
  buildMsitSessionDownloadUrl,
  extractMsitSessionId,
  pageContainsMsitAttachment,
  parseMsitAttachmentParams,
} from "@/lib/ingest/msit-attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const USER_AGENT = "gov-support-msit-download/1.0";

export async function GET(request: NextRequest) {
  const params = parseMsitAttachmentParams(request.nextUrl.searchParams);
  if (!params) {
    return NextResponse.json({ error: "invalid attachment parameters" }, { status: 400 });
  }

  try {
    const detailUrl = buildMsitDetailUrl(params.nttSeqNo);
    const response = await fetch(detailUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "source page unavailable" }, { status: 502 });
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "source page too large" }, { status: 502 });
    }
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "source page too large" }, { status: 502 });
    }
    if (!pageContainsMsitAttachment(html, params.atchFileNo, params.fileOrd)) {
      return NextResponse.json({ error: "attachment not found" }, { status: 404 });
    }

    const sessionId = extractMsitSessionId(
      response.headers.get("set-cookie"),
      html
    );
    if (!sessionId) {
      return NextResponse.json({ error: "download session unavailable" }, { status: 502 });
    }

    const redirect = NextResponse.redirect(
      buildMsitSessionDownloadUrl(sessionId, params.atchFileNo, params.fileOrd),
      302
    );
    redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
    redirect.headers.set("Referrer-Policy", "no-referrer");
    return redirect;
  } catch (error) {
    console.error(
      "MSIT attachment redirect failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return NextResponse.json({ error: "download unavailable" }, { status: 502 });
  }
}
