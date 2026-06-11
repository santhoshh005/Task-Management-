import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { hashPassword, verifyPassword } from "@/lib/password";
import { publishTaskUpdate } from "@/lib/realtime";
import type {
  PublicTask,
  SafeUser,
  SessionRecord,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  UserRecord,
} from "@/lib/types";

// Use a writable directory in serverless environments (Vercel uses a read-only
// project filesystem). Prefer `process.env.DATA_DIR` if provided, otherwise
// use `/tmp/.data` on Vercel and the project `.data` directory in other cases.
const DEFAULT_DATA_DIR = path.join(process.cwd(), ".data");
const TMP_DATA_DIR = path.join("/tmp", ".data");
const dataDir = process.env.DATA_DIR || (process.env.VERCEL === "1" ? TMP_DATA_DIR : DEFAULT_DATA_DIR);
const usersFile = path.join(dataDir, "users.json");
const sessionsFile = path.join(dataDir, "sessions.json");
const tasksFile = path.join(dataDir, "tasks.json");

type DatabaseState = {
  users: UserRecord[];
  sessions: SessionRecord[];
  tasks: TaskRecord[];
};

const emptyState: DatabaseState = {
  users: [],
  sessions: [],
  tasks: [],
};

let writeQueue: Promise<unknown> = Promise.resolve();

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDataDir();
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function readState() {
  await ensureDataDir();

  const [users, sessions, tasks] = await Promise.all([
    readJsonFile<UserRecord[]>(usersFile, emptyState.users),
    readJsonFile<SessionRecord[]>(sessionsFile, emptyState.sessions),
    readJsonFile<TaskRecord[]>(tasksFile, emptyState.tasks),
  ]);

  return { users, sessions, tasks } satisfies DatabaseState;
}

async function writeState(state: DatabaseState) {
  await ensureDataDir();
  await Promise.all([
    writeJsonFile(usersFile, state.users),
    writeJsonFile(sessionsFile, state.sessions),
    writeJsonFile(tasksFile, state.tasks),
  ]);
}

async function mutateState<T>(mutation: (state: DatabaseState) => Promise<T> | T) {
  const run = writeQueue.then(async () => {
    const state = await readState();
    const result = await mutation(state);
    await writeState(state);
    return result;
  });

  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

export function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function toPublicTask(task: TaskRecord): PublicTask {
  const { userId: _userId, ...publicTask } = task;
  return publicTask;
}

export async function createUser(input: { name: string; email: string; password: string }) {
  return mutateState(async (state) => {
    const email = input.email.toLowerCase();

    if (state.users.some((user) => user.email.toLowerCase() === email)) {
      throw new Error("EMAIL_TAKEN");
    }

    const user: UserRecord = {
      id: randomUUID(),
      name: input.name,
      email,
      role: "user",
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };

    state.users.push(user);
    return user;
  });
}

export async function authenticateUser(input: { email: string; password: string }) {
  const state = await readState();
  const user = state.users.find((entry) => entry.email.toLowerCase() === input.email.toLowerCase());

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    return null;
  }

  return user;
}

export async function findUserById(userId: string) {
  const state = await readState();
  return state.users.find((user) => user.id === userId) ?? null;
}

export async function createSession(userId: string) {
  return mutateState((state) => {
    const session: SessionRecord = {
      token: randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    };

    state.sessions.push(session);
    return session;
  });
}

export async function getSession(token: string) {
  const state = await readState();
  const session = state.sessions.find((entry) => entry.token === token);

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await deleteSession(token);
    return null;
  }

  const user = state.users.find((entry) => entry.id === session.userId);

  if (!user) {
    await deleteSession(token);
    return null;
  }

  return { session, user };
}

export async function deleteSession(token: string) {
  return mutateState((state) => {
    state.sessions = state.sessions.filter((entry) => entry.token !== token);
  });
}

export async function listTasks(userId: string) {
  const state = await readState();
  return state.tasks
    .filter((task) => task.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createTask(input: {
  userId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
}) {
  return mutateState((state) => {
    const now = new Date().toISOString();
    const task: TaskRecord = {
      id: randomUUID(),
      userId: input.userId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
    };

    state.tasks.push(task);
    publishTaskUpdate(input.userId);
    return task;
  });
}

export async function updateTask(
  userId: string,
  taskId: string,
  updates: Partial<Pick<TaskRecord, "title" | "description" | "status" | "priority" | "dueDate">>,
) {
  return mutateState((state) => {
    const task = state.tasks.find((entry) => entry.id === taskId && entry.userId === userId);

    if (!task) {
      return null;
    }

    if (typeof updates.title === "string") {
      task.title = updates.title;
    }

    if (typeof updates.description === "string") {
      task.description = updates.description;
    }

    if (updates.status) {
      task.status = updates.status;
    }

    if (updates.priority) {
      task.priority = updates.priority;
    }

    if (updates.dueDate !== undefined) {
      task.dueDate = updates.dueDate;
    }

    task.updatedAt = new Date().toISOString();
    publishTaskUpdate(userId);
    return task;
  });
}

export async function removeTask(userId: string, taskId: string) {
  return mutateState((state) => {
    const initialLength = state.tasks.length;
    state.tasks = state.tasks.filter((entry) => !(entry.id === taskId && entry.userId === userId));
    if (state.tasks.length < initialLength) {
      publishTaskUpdate(userId);
    }
    return state.tasks.length < initialLength;
  });
}

export async function getAppSnapshot(userId: string | null) {
  if (!userId) {
    return { user: null, tasks: [] as TaskRecord[] };
  }

  const [user, tasks] = await Promise.all([findUserById(userId), listTasks(userId)]);
  return { user, tasks };
}