/**
 * timer-alert.ts
 * صدا و نوتیفیکیشن سیستم هنگام تمام‌شدن تایمر.
 *
 * صدا: با Web Audio API ساخته می‌شود — بدون هیچ فایل صوتی یا dependency
 * اضافه‌ای. یک صدای بیپ سه‌مرحله‌ای (beep-beep-beep) پخش می‌شود.
 *
 * نوتیف: از @tauri-apps/plugin-notification استفاده می‌شود تا حتی وقتی
 * پنجره مخفی (offscreen) است هم نوتیف native ویندوز نمایش داده شود.
 */

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

// ─── صدا ───────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/**
 * یک بیپ کوتاه پخش می‌کند.
 * @param frequency فرکانس (Hz) — پیش‌فرض ۸۸۰ (نت A5، صدای تیز و واضح)
 * @param duration  مدت (ثانیه) — پیش‌فرض ۰.۱۵
 * @param startAt   زمان شروع نسبت به audioCtx.currentTime
 */
function playBeep(frequency = 880, duration = 0.15, startAt = 0): void {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = frequency;

  // کاهش تدریجی صدا در انتها تا pop ناخوشایند نداشته باشیم
  const start = ctx.currentTime + startAt;
  gain.gain.setValueAtTime(0.5, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

/**
 * سه بیپ پشت سرهم با کمی فاصله پخش می‌کند (الگوی هشدار).
 */
export function playTimerAlert(): void {
  try {
    playBeep(880, 0.15, 0.0);
    playBeep(880, 0.15, 0.2);
    playBeep(1100, 0.25, 0.4); // بیپ آخر کمی بلندتر
  } catch (err) {
    console.warn("پخش صدای تایمر ناموفق بود:", err);
  }
}

// ─── نوتیفیکیشن ────────────────────────────────────────────────────────────

/**
 * نوتیف native سیستم‌عامل ارسال می‌کند.
 * اگر permission قبلاً داده نشده باشد، ابتدا درخواست می‌دهد.
 */
export async function sendTimerNotification(taskTitle: string): Promise<void> {
  try {
    let permitted = await isPermissionGranted();
    if (!permitted) {
      const result = await requestPermission();
      permitted = result === "granted";
    }
    if (!permitted) return;

    sendNotification({
      title: "⏰ تایمر تمام شد",
      body: `زمان تسک «${taskTitle}» به پایان رسید.`,
    });
  } catch (err) {
    console.warn("ارسال نوتیفیکیشن ناموفق بود:", err);
  }
}

/**
 * ترکیب صدا + نوتیف — این تابع از tasks.ts صدا زده می‌شود.
 */
export async function alertTimerFinished(taskTitle: string): Promise<void> {
  playTimerAlert();
  await sendTimerNotification(taskTitle);
}
