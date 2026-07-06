-- بازه‌ی priority از ۱-۱۰ به ۱-۵ کوچک شد. این migration دو کار می‌کند:
--   ۱) مقادیر priority موجود را با همان نسبت به بازه‌ی جدید نگاشت می‌کند
--      (هر دو واحد قدیمی = یک واحد جدید؛ یعنی ceil(priority_old / 2))
--      تا ترتیب نسبی تسک‌ها حفظ شود، نه اینکه صرفاً هرچه بالای ۵ بود به ۵ کلمپ شود.
--   ۲) قید CHECK را برای مقادیر تازه تنگ‌تر می‌کند.
--
-- SQLite امکان ALTER کردن مستقیم یک CHECK constraint را نمی‌دهد،
-- بنابراین طبق روش استاندارد خودش، جدول از نو با schema درست ساخته
-- می‌شود، داده منتقل می‌شود، و جدول قدیمی جایگزین می‌شود.

PRAGMA foreign_keys=off;

CREATE TABLE tasks_new (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    title                   TEXT NOT NULL,
    description             TEXT,
    priority                INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    is_completed            INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
    sort_order              INTEGER NOT NULL DEFAULT 0,

    timer_duration_seconds  INTEGER NOT NULL DEFAULT 0,
    timer_remaining_seconds INTEGER NOT NULL DEFAULT 0,
    timer_status            TEXT NOT NULL DEFAULT 'idle'
                                CHECK (timer_status IN ('idle', 'running', 'paused', 'finished')),
    timer_end_at            INTEGER,

    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL
);

INSERT INTO tasks_new
    (id, title, description, priority, is_completed, sort_order,
     timer_duration_seconds, timer_remaining_seconds, timer_status, timer_end_at,
     created_at, updated_at)
SELECT
    id,
    title,
    description,
    -- نگاشت نسبتی ۱-۱۰ -> ۱-۵: ceil(priority / 2)، با clamp دفاعی به ۱..۵
    MIN(5, MAX(1, (priority + 1) / 2)),
    is_completed,
    sort_order,
    timer_duration_seconds,
    timer_remaining_seconds,
    timer_status,
    timer_end_at,
    created_at,
    updated_at
FROM tasks;

DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;

CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks (sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks (is_completed);

PRAGMA foreign_keys=on;
