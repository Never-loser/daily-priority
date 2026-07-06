import { defineStore } from "pinia";
import * as db from "@/lib/db";
import { alertTimerFinished } from "@/lib/timer-alert";
import type { Task, TaskRow, NewTaskInput, EditTaskInput, SortMode } from "@/types/task";

function rowToTask(row: TaskRow): Task {
  return { ...row, is_completed: row.is_completed === 1 };
}

let tickHandle: ReturnType<typeof setInterval> | null = null;

export const useTasksStore = defineStore("tasks", {
  state: () => ({
    tasks: [] as Task[],
    sortMode: "manual" as SortMode,
    loading: true,
    error: null as string | null,
    /** Updated once a second; every running-timer countdown is derived from this. */
    now: Date.now(),
  }),

  getters: {
    activeTasks(state): Task[] {
      return state.tasks.filter((t) => !t.is_completed);
    },
    doneTasks(state): Task[] {
      return state.tasks
        .filter((t) => t.is_completed)
        .sort((a, b) => b.updated_at - a.updated_at);
    },
    /** What the task list actually renders, respecting the current sort mode. */
    visibleActiveTasks(state): Task[] {
      const list = state.tasks.filter((t) => !t.is_completed);
      if (state.sortMode === "priority") {
        return [...list].sort((a, b) => b.priority - a.priority || a.sort_order - b.sort_order);
      }
      return [...list].sort((a, b) => a.sort_order - b.sort_order);
    },
    summary(state) {
      const activeList = state.tasks.filter((t) => !t.is_completed);
      const highPriority = activeList.filter((t) => t.priority >= 4).length;
      const activeTimers = activeList.filter((t) => t.timer_status === "running").length;
      return {
        total: activeList.length,
        highPriority,
        activeTimers,
      };
    },
  },

  actions: {
    /** Compute the live remaining seconds for a task, ticking locally for running timers. */
    remainingSecondsFor(task: Task): number {
      if (task.timer_status === "running" && task.timer_end_at != null) {
        return Math.max(0, Math.round((task.timer_end_at - this.now) / 1000));
      }
      return task.timer_remaining_seconds;
    },

    async init() {
      this.loading = true;
      this.error = null;
      try {
        const rows = await db.listTasks();
        this.tasks = rows.map(rowToTask);
        await this.reconcileExpiredTimers();
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e);
      } finally {
        this.loading = false;
      }
      this.startTicker();
    },

    startTicker() {
      if (tickHandle) return;
      tickHandle = setInterval(() => {
        this.now = Date.now();
        this.reconcileExpiredTimers();
      }, 1000);
    },

    stopTicker() {
      if (tickHandle) {
        clearInterval(tickHandle);
        tickHandle = null;
      }
    },

    /** Flip any running timer whose end time has passed into "finished", once. */
    async reconcileExpiredTimers() {
      const expired = this.tasks.filter(
        (t) => t.timer_status === "running" && t.timer_end_at != null && t.timer_end_at <= this.now,
      );
      for (const task of expired) {
        const updated = await db.markTimerFinished(task.id);
        this.patchLocal(updated);
        // صدا + نوتیف native — هم وقتی پنجره نمایان است هم وقتی مخفی
        alertTimerFinished(task.title).catch(() => {});
      }
    },

    patchLocal(row: TaskRow) {
      const task = rowToTask(row);
      const idx = this.tasks.findIndex((t) => t.id === task.id);
      // Mutate the existing reactive object in place (rather than replacing
      // it) so any other array holding the same reference — e.g. the local
      // copy vuedraggable uses for manual ordering — picks up the change
      // automatically instead of going stale.
      if (idx !== -1) Object.assign(this.tasks[idx], task);
      else this.tasks.push(task);
    },

    setSortMode(mode: SortMode) {
      this.sortMode = mode;
    },

    async addTask(input: NewTaskInput) {
      const row = await db.createTask(input);
      this.patchLocal(row);
    },

    async editTask(id: number, input: EditTaskInput) {
      const row = await db.updateTask(id, input);
      this.patchLocal(row);
    },

    async removeTask(id: number) {
      await db.deleteTask(id);
      this.tasks = this.tasks.filter((t) => t.id !== id);
    },

    async toggleCompleted(id: number) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return;
      const row = await db.setCompleted(id, !task.is_completed);
      this.patchLocal(row);
    },

    /** Called by the draggable list after a manual drag-and-drop reorder. */
    async applyManualOrder(orderedTasks: Task[]) {
      // Optimistic local update first so the UI doesn't snap back while saving.
      orderedTasks.forEach((t, index) => {
        const local = this.tasks.find((x) => x.id === t.id);
        if (local) local.sort_order = index;
      });
      await db.reorderTasks(orderedTasks.map((t) => t.id));
    },

    async setTimerDuration(id: number, totalSeconds: number) {
      const row = await db.setTimerDuration(id, totalSeconds);
      this.patchLocal(row);
    },

    async startOrResumeTimer(id: number) {
      const row = await db.startOrResumeTimer(id);
      this.patchLocal(row);
    },

    async pauseTimer(id: number) {
      const row = await db.pauseTimer(id);
      this.patchLocal(row);
    },

    async resetTimer(id: number) {
      const row = await db.resetTimer(id);
      this.patchLocal(row);
    },
  },
});