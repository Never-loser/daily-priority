/**
 * Mirrors the `tasks` SQLite table (see src-tauri/migrations/0001_create_tasks.sql).
 * SQLite has no boolean type, so `is_completed` is stored/read as 0|1.
 */
export type TimerStatus = "idle" | "running" | "paused" | "finished";
export type SortMode = "manual" | "priority";

export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  priority: number; // 1-10
  is_completed: 0 | 1;
  sort_order: number;
  timer_duration_seconds: number;
  timer_remaining_seconds: number;
  timer_status: TimerStatus;
  timer_end_at: number | null; // epoch ms, only meaningful while status === "running"
  created_at: number; // epoch ms
  updated_at: number; // epoch ms
}

/** Frontend-friendly shape (booleans instead of 0/1). */
export interface Task extends Omit<TaskRow, "is_completed"> {
  is_completed: boolean;
}

export interface NewTaskInput {
  title: string;
  description?: string;
  priority: number;
}

export interface EditTaskInput {
  title: string;
  description?: string;
  priority: number;
}
