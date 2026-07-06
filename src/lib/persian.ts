const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert any string/number containing ASCII digits to Persian digits. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/**
 * Format a duration in seconds as a countdown string.
 * نمایش روز فقط وقتی مدت زمان بیشتر از ۲۴ ساعت باشد.
 * مثال‌ها: ۰۲:۳۰ / ۰۱:۲۰:۰۰ / ۲ روز ۰۳:۱۵:۰۰
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const d = Math.floor(safe / 86400);
  const h = Math.floor((safe % 86400) / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d} روز ${time}` : h > 0 ? time : `${pad(m)}:${pad(s)}`;
}

/** Persian relative/absolute helpers for the priority badge label, e.g. "۴ از ۵". */
export function priorityLabel(priority: number): string {
  return `${toPersianDigits(priority)} از ۵`;
}