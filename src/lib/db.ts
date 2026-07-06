/**
 * Data access layer for the `tasks` table.
 *
 * Architecture note: we use `@tauri-apps/plugin-sql` directly from the
 * frontend, which is the officially documented way to use tauri-plugin-sql.
 * The Rust side (src-tauri/src/lib.rs) only registers the plugin and owns
 * the schema migration — all SQL lives in this one file, isolated behind
 * small, typed functions so the rest of the app never writes raw SQL.
 * Every exported function below corresponds 1:1 to a "command" the UI can
 * issue (create, update, delete, reorder, timer controls, etc.).
 */
import Database from "@tauri-apps/plugin-sql";
import type { TaskRow, NewTaskInput, EditTaskInput } from "@/types/task";

const DB_PATH = "sqlite:daily_priority.db";

let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_PATH);
  }
  return dbPromise;
}

function now(): number {
  return Date.now();
}

async function selectOne(db: Database, id: number): Promise<TaskRow> {
  const rows = await db.select<TaskRow[]>("SELECT * FROM tasks WHERE id = ?", [id]);
  if (!rows[0]) throw new Error(`Task ${id} not found`);
  return rows[0];
}

/** Load every task, ordered for "manual" mode by default; the store re-sorts for "priority" mode. */
export async function listTasks(): Promise<TaskRow[]> {
  const db = await getDb();
  return db.select<TaskRow[]>("SELECT * FROM tasks ORDER BY sort_order ASC, id ASC");
}

export async function createTask(input: NewTaskInput): Promise<TaskRow> {
  const db = await getDb();
  const ts = now();
  // New tasks go to the TOP of the manual order — the newest task is always
  // the first thing the user sees, ahead of everything already in the list.
  const [{ next_order } = { next_order: 0 }] = await db.select<{ next_order: number }[]>(
    "SELECT COALESCE(MIN(sort_order), 0) - 1 AS next_order FROM tasks",
  );
  const result = await db.execute(
    `INSERT INTO tasks
      (title, description, priority, is_completed, sort_order,
       timer_duration_seconds, timer_remaining_seconds, timer_status, timer_end_at,
       created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, 0, 0, 'idle', NULL, ?, ?)`,
    [input.title, input.description ?? null, input.priority, next_order, ts, ts],
  );
  return selectOne(db, Number(result.lastInsertId));
}

export async function updateTask(id: number, input: EditTaskInput): Promise<TaskRow> {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET title = ?, description = ?, priority = ?, updated_at = ? WHERE id = ?`,
    [input.title, input.description ?? null, input.priority, now(), id],
  );
  return selectOne(db, id);
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = ?", [id]);
}

export async function setCompleted(id: number, completed: boolean): Promise<TaskRow> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET is_completed = ?, updated_at = ? WHERE id = ?", [
    completed ? 1 : 0,
    now(),
    id,
  ]);
  return selectOne(db, id);
}

/** Persist a full manual re-order. `orderedIds` is the new top-to-bottom order. */
export async function reorderTasks(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  // SQLite doesn't support multi-row UPDATE ... FROM (VALUES) portably across
  // versions, so we issue one statement per row. The list is small (a day's
  // worth of tasks), so this stays effectively instant.
  for (let index = 0; index < orderedIds.length; index++) {
    await db.execute("UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?", [
      index,
      now(),
      orderedIds[index],
    ]);
  }
}

/* ---------------------------------------------------------------------- *
 * Timer controls
 *
 * Design: while a timer is RUNNING we store an absolute end timestamp
 * (`timer_end_at`, epoch ms) instead of repeatedly writing the remaining
 * seconds. The remaining time is always derivable as `end_at - now()`.
 * This means:
 *   - No periodic DB writes are needed while a timer runs (cheap + simple).
 *   - Reopening the app after a close/crash recomputes the exact remaining
 *     time from the stored end timestamp, so the countdown "continues from
 *     where it left off" — including counting down the wall-clock time
 *     that passed while the app was closed, just like a real countdown to
 *     a deadline would.
 *   - Pausing snapshots the remaining time into `timer_remaining_seconds`
 *     and clears `timer_end_at`, so a paused timer never drifts.
 * ---------------------------------------------------------------------- */

export async function setTimerDuration(id: number, totalSeconds: number): Promise<TaskRow> {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks
     SET timer_duration_seconds = ?, timer_remaining_seconds = ?,
         timer_status = 'idle', timer_end_at = NULL, updated_at = ?
     WHERE id = ?`,
    [totalSeconds, totalSeconds, now(), id],
  );
  return selectOne(db, id);
}

export async function startOrResumeTimer(id: number): Promise<TaskRow> {
  const db = await getDb();
  const task = await selectOne(db, id);
  const remaining = task.timer_status === "finished" ? task.timer_duration_seconds : task.timer_remaining_seconds;
  if (remaining <= 0) return task; // nothing to start (no duration set)
  const endAt = now() + remaining * 1000;
  await db.execute(
    `UPDATE tasks SET timer_status = 'running', timer_end_at = ?, timer_remaining_seconds = ?, updated_at = ?
     WHERE id = ?`,
    [endAt, remaining, now(), id],
  );
  return selectOne(db, id);
}

export async function pauseTimer(id: number): Promise<TaskRow> {
  const db = await getDb();
  const task = await selectOne(db, id);
  if (task.timer_status !== "running" || task.timer_end_at == null) return task;
  const remaining = Math.max(0, Math.round((task.timer_end_at - now()) / 1000));
  await db.execute(
    `UPDATE tasks SET timer_status = ?, timer_remaining_seconds = ?, timer_end_at = NULL, updated_at = ?
     WHERE id = ?`,
    [remaining > 0 ? "paused" : "finished", remaining, now(), id],
  );
  return selectOne(db, id);
}

export async function resetTimer(id: number): Promise<TaskRow> {
  const db = await getDb();
  const task = await selectOne(db, id);
  await db.execute(
    `UPDATE tasks SET timer_status = 'idle', timer_remaining_seconds = ?, timer_end_at = NULL, updated_at = ?
     WHERE id = ?`,
    [task.timer_duration_seconds, now(), id],
  );
  return selectOne(db, id);
}

/** Called by the store's ticker once a running timer's end time has passed. */
export async function markTimerFinished(id: number): Promise<TaskRow> {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET timer_status = 'finished', timer_remaining_seconds = 0, timer_end_at = NULL, updated_at = ?
     WHERE id = ?`,
    [now(), id],
  );
  return selectOne(db, id);
}