import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
