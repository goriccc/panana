import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const rawPaths = Array.isArray(payload?.paths) ? payload.paths : [];
    const paths = rawPaths.map((p) => String(p || "")).filter(Boolean);
    const unique = Array.from(new Set(paths));

    unique.forEach((p) => revalidatePath(p));

    return NextResponse.json({ ok: true, revalidated: unique });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
