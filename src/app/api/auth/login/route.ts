import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation";
import { authenticateUser, createSession, toSafeUser } from "@/lib/store";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid login details.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const user = await authenticateUser(parsed.data);

  if (!user) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const session = await createSession(user.id);
  await setSessionCookie(session.token);

  return NextResponse.json({ user: toSafeUser(user) });
}