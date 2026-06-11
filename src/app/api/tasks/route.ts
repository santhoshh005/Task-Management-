import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createTask, listTasks, toPublicTask } from "@/lib/store";
import { taskSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await listTasks(user.id);
  return NextResponse.json({ tasks: tasks.map(toPublicTask) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = taskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task details.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const task = await createTask({ userId: user.id, ...parsed.data });
  return NextResponse.json({ task: toPublicTask(task) }, { status: 201 });
}