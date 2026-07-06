import { defineStore } from "pinia";
import { getCurrentWindow, currentMonitor, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

const STORAGE_KEY = "daily-priority:settings";

interface SettingsState {
  sidebarMode: boolean;
  titleBarVisible: boolean;
  autostartEnabled: boolean;
}

function loadState(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return {
        sidebarMode: true,
        titleBarVisible: false,
        autostartEnabled: false,
        ...(JSON.parse(raw) as Partial<SettingsState>),
      } as SettingsState;
    }
  } catch {}
  return { sidebarMode: true, titleBarVisible: false, autostartEnabled: false };
}

export const useSettingsStore = defineStore("settings", {
  state: (): SettingsState => loadState(),

  actions: {
    async toggleSidebarMode() {
      this.sidebarMode = !this.sidebarMode;
      this._persist();
      await this._applyWindowMode();
    },

    async setSidebarMode(value: boolean) {
      this.sidebarMode = value;
      this._persist();
      await this._applyWindowMode();
    },

    async toggleTitleBar() {
      this.titleBarVisible = !this.titleBarVisible;
      this._persist();
      await this._applyTitleBar();
    },

    async setTitleBarVisible(value: boolean) {
      this.titleBarVisible = value;
      this._persist();
      await this._applyTitleBar();
    },

    // ───── اجرای خودکار هنگام روشن‌شدن سیستم (Autostart) ─────

    /// هنگام بازشدن برنامه/پنل تنظیمات صدا زده می‌شود تا وضعیت واقعی
    /// autostart (که سمت سیستم‌عامل ذخیره می‌شود، نه localStorage) را
    /// بخواند و state را با آن همگام کند.
    async syncAutostartState() {
      try {
        this.autostartEnabled = await invoke<boolean>("is_autostart_enabled");
      } catch (err) {
        console.error("خواندن وضعیت autostart ناموفق بود:", err);
      }
    },

    async toggleAutostart() {
      const next = !this.autostartEnabled;
      try {
        if (next) {
          await invoke("enable_autostart");
        } else {
          await invoke("disable_autostart");
        }
        this.autostartEnabled = next;
        this._persist();
      } catch (err) {
        console.error("تغییر وضعیت autostart ناموفق بود:", err);
      }
    },

    async _applyTitleBar() {
      try {
        const win = getCurrentWindow();
        // decorations:true نوار تایتل و دکمه‌های استاندارد سیستم‌عامل
        // (بستن/بزرگ‌کردن/کوچک‌کردن) را نشان می‌دهد.
        await win.setDecorations(this.titleBarVisible);
      } catch (err) {
        console.error("toggle title bar failed:", err);
      }
    },

    _persist() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sidebarMode: this.sidebarMode,
          titleBarVisible: this.titleBarVisible,
          autostartEnabled: this.autostartEnabled,
        })
      );
    },

    async _applyWindowMode() {
      try {
        const win = getCurrentWindow();
        const monitor = await currentMonitor();
        if (!monitor) return;

        const { width: mw, height: mh } = monitor.size;
        const scaleFactor = monitor.scaleFactor;
        const mx = monitor.position.x;
        const my = monitor.position.y;

        if (this.sidebarMode) {
          // ───── حالت نوار کناری: چسبیده به راست، ارتفاع کامل، قفل کامل ─────
          const appWidth = Math.round(340* scaleFactor);

          await win.setResizable(true); // برای اینکه setSize/setPosition رد نشه روی بعضی پلتفرم‌ها
          await win.setSize(new PhysicalSize(appWidth, mh));
          await win.setPosition(new PhysicalPosition(mx + mw - appWidth, my));
          await win.setResizable(false);

          // اطلاع به Rust: از این به بعد هر تلاش برای جابجایی یا تغییر اندازه
          // (مثل اسنپ ویندوز، چنگ‌زدن، کشیدن لبه) فوراً به همین موقعیت/اندازه
          // برگردانده می‌شود — قفل واقعی، نه فقط غیرفعال‌کردن دستگیره ریسایز.
          await invoke("set_sidebar_lock", { enabled: true });
          console.log("[sidebar] قفل فعال شد — پنجره چسبیده به راست");
        } else {
          // ───── حالت آزاد: کاربر می‌تواند جابجا و ریسایز کند ─────
          // ابتدا قفل سمت Rust برداشته می‌شود تا enforcement مزاحم نشود.
          await invoke("set_sidebar_lock", { enabled: false });
          console.log("[sidebar] قفل برداشته شد — پنجره آزاد است");

          const defaultW = Math.round(1000 * scaleFactor);
          const defaultH = Math.round(760 * scaleFactor);

          await win.setResizable(true);
          await win.setSize(new PhysicalSize(defaultW, defaultH));
          await win.setPosition(new PhysicalPosition(
            mx + Math.round((mw - defaultW) / 2),
            my + Math.round((mh - defaultH) / 2),
          ));
        }
      } catch (err) {
        console.error("window resize/move failed:", err);
      }
    },
  },
});