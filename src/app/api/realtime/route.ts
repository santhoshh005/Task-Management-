import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { subscribeToTaskUpdates } from "@/lib/realtime";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const sendUpdate = () => {
        controller.enqueue(encoder.encode(`event: tasks\ndata: ${JSON.stringify({ updatedAt: new Date().toISOString() })}\n\n`));
      };

      const unsubscribe = subscribeToTaskUpdates(user.id, sendUpdate);
      const heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        }
      }, 25000);

      const cleanup = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
      sendUpdate();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}