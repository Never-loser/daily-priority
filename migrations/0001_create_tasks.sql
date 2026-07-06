-- One row per task. SQLite has no native boolean, so `is_completed` is
-- stored as 0/1. Timer fields implement an "absolute end timestamp" design:
-- see src/lib/db.ts for the full rationale.
CREATE TABLE IF NOT EXISTS tasks (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    title                   TEXT NOT NULL,
    description             TEXT,
    priority                INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    is_completed            INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
    sort_order              INTEGER NOT NULL DEFAULT 0,

    timer_duration_seconds  INTEGER NOT NULL DEFAULT 0,
    timer_remaining_seconds INTEGER NOT NULL DEFAULT 0,
    timer_status            TEXT NOT NULL DEFAULT 'idle'
                                CHECK (timer_status IN ('idle', 'running', 'paused', 'finished')),
    timer_end_at            INTEGER, -- epoch ms; only meaningful while timer_status = 'running'

    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks (sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks (is_completed);
