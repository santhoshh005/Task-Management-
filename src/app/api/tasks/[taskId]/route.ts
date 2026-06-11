import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { removeTask, toPublicTask, updateTask } from "@/lib/store";
import { taskUpdateSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = taskUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task update.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const updatedTask = await updateTask(user.id, taskId, parsed.data);

  if (!updatedTask) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ task: toPublicTask(updatedTask) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await context.params;
  const removed = await removeTask(user.id, taskId);

  if (!removed) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}