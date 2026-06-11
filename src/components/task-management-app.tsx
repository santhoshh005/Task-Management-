"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PublicTask, SafeUser, TaskPriority, TaskStatus } from "@/lib/types";

type DashboardProps = {
  initialUser: SafeUser | null;
  initialTasks: PublicTask[];
};

type TaskFormState = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
};

const emptyForm: TaskFormState = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
};

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
};

const priorityLabels: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const statusClasses: Record<TaskStatus, string> = {
  todo: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  "in-progress": "border-amber-400/30 bg-amber-400/10 text-amber-100",
  done: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
};

function formatDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusActions(status: TaskStatus): Array<{ label: string; nextStatus: TaskStatus }> {
  if (status === "todo") {
    return [
      { label: "Start progress", nextStatus: "in-progress" },
      { label: "Mark complete", nextStatus: "done" },
    ];
  }

  if (status === "in-progress") {
    return [
      { label: "Move to TO DO", nextStatus: "todo" },
      { label: "Mark complete", nextStatus: "done" },
    ];
  }

  return [
    { label: "Move to TO DO", nextStatus: "todo" },
    { label: "Start progress", nextStatus: "in-progress" },
  ];
}

export function TaskManagementApp({ initialUser, initialTasks }: DashboardProps) {
  const [user, setUser] = useState(initialUser);
  const [tasks, setTasks] = useState(initialTasks);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const summary = useMemo(
    () => ({
      total: tasks.length,
      todo: tasks.filter((task) => task.status === "todo").length,
      inProgress: tasks.filter((task) => task.status === "in-progress").length,
      done: tasks.filter((task) => task.status === "done").length,
    }),
    [tasks],
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    const eventSource = new EventSource("/api/realtime");

    const refreshTasks = async () => {
      try {
        const refreshedTasks = await fetchJson<{ tasks: PublicTask[] }>("/api/tasks");
        setTasks(refreshedTasks.tasks);
      } catch {
        setTaskError("Unable to refresh tasks.");
      }
    };

    eventSource.addEventListener("tasks", () => {
      void refreshTasks();
    });

    void refreshTasks();

    return () => {
      eventSource.close();
    };
  }, [user?.id]);

  async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
    const response = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "include",
    });

    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed.");
    }

    return payload;
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };

    const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const result = await fetchJson<{ user: SafeUser }>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setUser(result.user);
      const refreshedTasks = await fetchJson<{ tasks: PublicTask[] }>("/api/tasks");
      setTasks(refreshedTasks.tasks);
      router.refresh();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to complete authentication.");
    }
  }

  async function handleLogout() {
    setTaskError(null);

    try {
      await fetchJson("/api/auth/logout", { method: "POST" });
      setUser(null);
      setTasks([]);
      clearTaskForm();
      router.refresh();
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Unable to log out.");
    }
  }

  function beginTaskEdit(task: PublicTask) {
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
    });
    setEditingTaskId(task.id);
  }

  function clearTaskForm() {
    setForm(emptyForm);
    setEditingTaskId(null);
  }

  async function handleSubmitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskError(null);

    try {
      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
      };

      if (editingTaskId) {
        const result = await fetchJson<{ task: PublicTask }>(`/api/tasks/${editingTaskId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        setTasks((current) => current.map((entry) => (entry.id === result.task.id ? result.task : entry)));
      } else {
        const result = await fetchJson<{ task: PublicTask }>("/api/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setTasks((current) => [result.task, ...current]);
      }

      clearTaskForm();
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Unable to save task.");
    }
  }

  async function updateTaskStatus(task: PublicTask, nextStatus: TaskStatus) {
    startTransition(async () => {
      setTaskError(null);

      try {
        const result = await fetchJson<{ task: PublicTask }>(`/api/tasks/${task.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });

        setTasks((current) => current.map((entry) => (entry.id === result.task.id ? result.task : entry)));
      } catch (error) {
        setTaskError(error instanceof Error ? error.message : "Unable to update task.");
      }
    });
  }

  function editTask(task: PublicTask) {
    beginTaskEdit(task);
  }

  async function handleDeleteTask(taskId: string) {
    setTaskError(null);

    try {
      await fetchJson(`/api/tasks/${taskId}`, { method: "DELETE" });
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "Unable to delete task.");
    }
  }

  if (!user) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-sky-950/30 backdrop-blur-xl sm:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-100">
              <span className="h-2 w-2 rounded-full bg-sky-300" />
              Secure task management for teams and individuals
            </div>

            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Manage tasks, track status, and keep delivery on schedule.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                This workspace combines secure authentication, task CRUD, and responsive views so
                you can organize work from any device.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Access control", value: "Cookie sessions" },
                { label: "Task operations", value: "Create, update, delete" },
                { label: "Responsive UI", value: "Desktop and mobile" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-sm text-slate-400">{item.label}</p>
                  <p className="mt-2 text-lg font-medium text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-sky-950/40 backdrop-blur-xl sm:p-8">
            <div className="mb-6 flex rounded-2xl border border-white/10 bg-white/5 p-1">
              {(["login", "register"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAuthMode(mode)}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    authMode === mode
                      ? "bg-cyan-400 text-slate-950"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {mode === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form className="space-y-4" onSubmit={handleAuthSubmit}>
              {authMode === "register" && (
                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Name</span>
                  <input
                    name="name"
                    defaultValue="Ava Stone"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-white/10"
                    placeholder="Your name"
                  />
                </label>
              )}

              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Email</span>
                <input
                  name="email"
                  type="email"
                  defaultValue="demo@taskworkspace.dev"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-white/10"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Password</span>
                <input
                  name="password"
                  type="password"
                  defaultValue="Password123"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-white/10"
                  placeholder="At least 8 characters"
                />
              </label>

              {authError && (
                <p className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={pending}
              >
                {authMode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-sky-950/30 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Welcome back, {user.name}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Keep work visible, organized, and on track.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Use the board below to create tasks, update status, and keep priorities and due dates
                clear across desktop and mobile layouts.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total", value: summary.total },
                { label: "To do", value: summary.todo },
                { label: "In progress", value: summary.inProgress },
                { label: "Done", value: summary.done },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{user.email}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Role: {user.role}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/10 px-3 py-1 text-slate-200 transition hover:border-cyan-300/60 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="flex flex-col gap-6">
          <form
            onSubmit={handleSubmitTask}
            className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-sky-950/30 backdrop-blur-xl sm:p-8"
          >
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">
                {editingTaskId ? "Edit task" : "Create a task"}
              </h2>
              <p className="text-sm leading-6 text-slate-400">
                Capture the title, status, priority, and due date in a single form.
              </p>
            </div>

            {editingTaskId && (
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
                You are editing an existing task. Save changes or cancel to return to a new task.
              </div>
            )}

            <div className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 focus:bg-white/10"
                  placeholder="Ship the mobile dashboard"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={5}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-white/10"
                  placeholder="Add context, handoff details, or acceptance criteria."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, status: event.target.value as TaskStatus }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 focus:bg-white/10"
                  >
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key} className="bg-slate-950">
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Priority</span>
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 focus:bg-white/10"
                  >
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <option key={key} value={key} className="bg-slate-950">
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Due date</span>
                <input
                  value={form.dueDate}
                  onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                  type="date"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 focus:bg-white/10"
                />
              </label>

              {taskError && (
                <p className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {taskError}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={pending || !form.title.trim()}
              >
                {editingTaskId ? "Save changes" : "Add task"}
              </button>

              {editingTaskId && (
                <button
                  type="button"
                  onClick={clearTaskForm}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
                >
                  Cancel editing
                </button>
              )}
            </div>
          </form>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-sky-950/30 backdrop-blur-xl sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Task overview</h2>
                  <p className="text-sm leading-6 text-slate-400">Tasks are grouped by status for quick review.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                  {tasks.length} tasks
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {(["todo", "in-progress", "done"] as TaskStatus[]).map((status) => (
                  <div key={status} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">
                        {statusLabels[status]}
                      </h3>
                      <span className="rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-300">
                        {tasks.filter((task) => task.status === status).length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {tasks.filter((task) => task.status === status).length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-6 text-sm text-slate-400">
                          No tasks here yet.
                        </div>
                      ) : (
                        tasks
                          .filter((task) => task.status === status)
                          .map((task) => (
                            <article key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1 space-y-2">
                                  <h4 className="break-words text-base font-semibold text-white">{task.title}</h4>
                                  <p className="break-words text-sm leading-6 text-slate-300">
                                    {task.description || "No description provided."}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="self-start rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-rose-400/50 hover:text-rose-100"
                                >
                                  Delete
                                </button>
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                                <span className={`rounded-full border px-3 py-1 ${statusClasses[task.status]}`}>
                                  {statusLabels[task.status]}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                                  {priorityLabels[task.priority]} priority
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                                  Due {formatDate(task.dueDate)}
                                </span>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => editTask(task)}
                                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
                                >
                                  Edit task
                                </button>
                                {getStatusActions(task.status).map((action) => (
                                  <button
                                    key={action.label}
                                    type="button"
                                    onClick={() => updateTaskStatus(task, action.nextStatus)}
                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-300/60 hover:text-white"
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </article>
                          ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}