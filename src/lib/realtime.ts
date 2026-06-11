type TaskUpdateListener = () => void;

const taskListeners = new Map<string, Set<TaskUpdateListener>>();

export function subscribeToTaskUpdates(userId: string, listener: TaskUpdateListener) {
  const listeners = taskListeners.get(userId) ?? new Set<TaskUpdateListener>();
  listeners.add(listener);
  taskListeners.set(userId, listeners);

  return () => {
    const currentListeners = taskListeners.get(userId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      taskListeners.delete(userId);
    }
  };
}

export function publishTaskUpdate(userId: string) {
  const listeners = taskListeners.get(userId);

  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener();
  }
}