import { defineStore } from "pinia";

const STORAGE_KEY = "daily-priority:theme";
const GLASS_KEY = "daily-priority:glass";

type Theme = "light" | "dark";

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function applyGlass(enabled: boolean) {
  document.documentElement.classList.toggle("glass", enabled);
}

export const useThemeStore = defineStore("theme", {
  state: () => ({
    theme: (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? (systemPrefersDark() ? "dark" : "light"),
    glassEnabled: localStorage.getItem(GLASS_KEY) === "true",
  }),
  actions: {
    init() {
      applyTheme(this.theme);
      applyGlass(this.glassEnabled);
    },
    toggle() {
      this.theme = this.theme === "dark" ? "light" : "dark";
    },
    set(theme: Theme) {
      this.theme = theme;
    },
    toggleGlass() {
      this.glassEnabled = !this.glassEnabled;
      localStorage.setItem(GLASS_KEY, String(this.glassEnabled));
      applyGlass(this.glassEnabled);
    },
  },
});

export function watchThemePersistence(store: ReturnType<typeof useThemeStore>) {
  store.$subscribe((_mutation, state) => {
    applyTheme(state.theme);
    localStorage.setItem(STORAGE_KEY, state.theme);
  });
}