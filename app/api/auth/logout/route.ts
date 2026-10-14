import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { rejectCrossOrigin } from "@/lib/api";

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  await clearSession();
  return NextResponse.json({ ok: true });
}
