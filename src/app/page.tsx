import { TaskManagementApp } from "@/components/task-management-app";
import { getCurrentUser } from "@/lib/session";
import { getAppSnapshot } from "@/lib/store";

export default async function Home() {
  const user = await getCurrentUser();
  const snapshot = await getAppSnapshot(user?.id ?? null);

  return (
    <TaskManagementApp
      initialUser={snapshot.user}
      initialTasks={snapshot.tasks.map(({ id, title, description, status, priority, dueDate, createdAt, updatedAt }) => ({
        id,
        title,
        description,
        status,
        priority,
        dueDate,
        createdAt,
        updatedAt,
      }))}
    />
  );
}
