import { NextResponse } from "next/server";
import { fetchChallengeRanking } from "@/lib/challenge/ranking";

export const runtime = "nodejs";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: challengeId } = await params;
    if (!isUuid(challengeId)) return NextResponse.json({ ok: false, error: "Invalid challenge id" }, { status: 400 });

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)));
    const pananaId = url.searchParams.get("pananaId") || undefined;

    const { ranking, myRank } = await fetchChallengeRanking(challengeId, {
      limit,
      pananaId: pananaId || undefined,
    });

    return NextResponse.json({
      ok: true,
      ranking,
      myRank,
      days: 30,
    });
  } catch (e: any) {
    const msg = e?.message || "Unknown error";
    console.error("[challenges/ranking]", msg, e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
