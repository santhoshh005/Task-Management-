export type UserRole = "user" | "admin";

export type TaskStatus = "todo" | "in-progress" | "done";

export type TaskPriority = "low" | "medium" | "high";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface UserRecord extends SafeUser {
  passwordHash: string;
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: string;
}

export interface TaskRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PublicTask = Omit<TaskRecord, "userId">;