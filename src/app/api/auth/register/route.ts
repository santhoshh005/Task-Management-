import { NextResponse } from "next/server";
import { authSchema } from "@/lib/validation";
import { createSession, createUser, toSafeUser } from "@/lib/store";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = authSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration details.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const user = await createUser(parsed.data);
    const session = await createSession(user.id);
    await setSessionCookie(session.token);

    return NextResponse.json({ user: toSafeUser(user) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_TAKEN") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}