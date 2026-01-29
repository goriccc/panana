import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const payload: unknown = await req.json().catch(() => ({}));
    const rawPaths: unknown[] =
      typeof payload === "object" && payload !== null && Array.isArray((payload as any).paths) ? ((payload as any).paths as unknown[]) : [];
    const paths = rawPaths.map((p: unknown) => String(p || "")).filter(Boolean);
    const unique = Array.from(new Set(paths));

    unique.forEach((p: string) => revalidatePath(p));

    return NextResponse.json({ ok: true, revalidated: unique });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
