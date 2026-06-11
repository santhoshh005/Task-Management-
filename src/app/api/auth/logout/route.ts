import { NextResponse } from "next/server";
import { clearSessionCookie, sessionCookieName } from "@/lib/session";
import { deleteSession } from "@/lib/store";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const tokenMatch = cookieHeader.match(new RegExp(`${sessionCookieName}=([^;]+)`));
  const token = tokenMatch?.[1];

  if (token) {
    await deleteSession(token);
  }

  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}