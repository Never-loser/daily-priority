import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { useThemeStore, watchThemePersistence } from "@/stores/theme";
import "./style.css";

const app = createApp(App);
app.use(createPinia());

// Apply the saved/system theme before mount so there's no flash of the wrong theme.
const themeStore = useThemeStore();
themeStore.init();
watchThemePersistence(themeStore);

app.mount("#app");
