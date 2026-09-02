import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Never prerendered/cached: this must hit the database on every request.
export const dynamic = "force-dynamic";
// pg (via @prisma/adapter-pg) uses Node's net module — not edge-compatible.
export const runtime = "nodejs";

export async function GET() {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: Date.now() - start });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        db: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
