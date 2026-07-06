use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, PhysicalPosition, PhysicalSize, State, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Single source of truth for the database schema.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_tasks_table",
            sql: include_str!("../migrations/0001_create_tasks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "priority_scale_1_to_5",
            sql: include_str!("../migrations/0002_priority_scale_1_to_5.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// نگه‌دارنده‌ی وضعیت «حالت نوار کناری» — اگر true باشد، پنجره قفل
/// موقعیت/اندازه است و با هیچ روشی (درگ، اسنپ ویندوز، ریسایز) جابجا نمی‌شود.
struct SidebarLock(Mutex<bool>);

/// فلگ جلوگیری از واکنش نادرست به Moved/Resized: وقتی ما خودمان
/// (به‌صورت برنامه‌ای) در حال صدا زدن set_size/set_position هستیم —
/// چه برای اعمال حالت نوار کناری، چه برای جابه‌جایی به/از بیرون صفحه —
/// این مقدار true می‌شود تا هندلر رویداد دوباره واکنش نشان ندهد.
struct ApplyingGeometry(AtomicBool);

/// آیا پنجره الان «در پس‌زمینه» (بیرون از صفحه) است؟
struct InBackground(AtomicBool);

/// آخرین موقعیت/اندازه‌ی شناخته‌شده‌ی پنجره روی صفحه، قبل از رفتن به پس‌زمینه.
/// برای بازگرداندن پنجره در حالت آزاد (غیر نوار-کناری) استفاده می‌شود.
struct LastOnScreenGeometry(Mutex<Option<(PhysicalPosition<i32>, PhysicalSize<u32>)>>);

/// موقعیت خارج از محدوده‌ی هر مانیتوری — برای «مخفی‌کردن» پنجره بدون
/// minimize/hide واقعی استفاده می‌شود.
const OFFSCREEN_X: i32 = -32000;
const OFFSCREEN_Y: i32 = -32000;

/// محاسبه‌ی اندازه و موقعیت صحیح حالت نوار کناری (چسبیده به راست، ارتفاع کامل مانیتور)
fn sidebar_geometry(window: &tauri::WebviewWindow) -> Option<(PhysicalSize<u32>, PhysicalPosition<i32>)> {
    let monitor = window.primary_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let screen = monitor.size();

    let logical_width: f64 = 400.0;
    let phys_width = (logical_width * scale).round() as u32;
    let phys_height = screen.height;

    let size = PhysicalSize { width: phys_width, height: phys_height };
    let x = (screen.width as i32) - (phys_width as i32);
    let y = monitor.position().y;
    let pos = PhysicalPosition { x, y };

    Some((size, pos))
}

/// تنظیم موقعیت/اندازه‌ی پنجره با محافظت از فلگ ApplyingGeometry تا
/// هندلر Moved/Resized واکنش غلط نشان ندهد.
fn set_geometry_guarded(app: &tauri::AppHandle, window: &tauri::WebviewWindow, size: PhysicalSize<u32>, pos: PhysicalPosition<i32>) {
    let flag = app.state::<ApplyingGeometry>();
    flag.0.store(true, Ordering::SeqCst);

    let _ = window.set_size(size);
    let _ = window.set_position(pos);

    flag.0.store(false, Ordering::SeqCst);
}

/// پنجره را در محل صحیح حالت نوار کناری قرار می‌دهد و قفل می‌کند.
fn apply_sidebar_mode(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
    if let Some((size, pos)) = sidebar_geometry(window) {
        let current_size = window.outer_size().ok();
        let current_pos = window.outer_position().ok();
        let already_correct = current_size.map_or(false, |s| s.width == size.width && s.height == size.height)
            && current_pos.map_or(false, |p| p.x == pos.x && p.y == pos.y);

        if already_correct {
            return;
        }

        let _ = window.set_resizable(false);
        set_geometry_guarded(app, window, size, pos);
    }
}

/// خروج از حالت نوار کناری: پنجره آزاد می‌شود تا کاربر بتواند جابجا/ریسایز کند.
fn release_sidebar_mode(window: &tauri::WebviewWindow) {
    let _ = window.set_resizable(true);
}

/// «مخفی‌کردن» پنجره — بدون minimize/hide واقعی.
///
/// نکته‌ی مهم: نه window.hide() و نه window.minimize() استفاده نمی‌شود.
/// هر دو باعث می‌شوند WebView2 روی این پنجره (transparent:true +
/// decorations:false) سرفیس رندرش را suspend کند، و در بیلد release
/// روی ویندوز هنگام resume گیر می‌کند (Not Responding) — این اتفاق حتی
/// با ژست‌های سیستم‌عامل مثل Show Desktop (سه‌انگشتی / Win+D) هم رخ
/// می‌دهد، پس مشکل از خود minimize/restore این نوع پنجره است، نه از
/// تابع خاصی که صدایش می‌زنیم.
///
/// راه‌حل: پنجره هرگز minimize نمی‌شود؛ به‌جای آن به بیرون از محدوده‌ی
/// هر مانیتوری جابه‌جا می‌شود. از نظر ویندوز و WebView2 پنجره همچنان
/// «نمایش داده‌شده» است (فقط دیده نمی‌شود)، پس هیچ‌وقت وارد مسیر
/// suspend/resume نمی‌شود و این باگ اصلاً پیش نمی‌آید.
fn hide_to_background(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
    if let (Ok(size), Ok(pos)) = (window.outer_size(), window.outer_position()) {
        let last = app.state::<LastOnScreenGeometry>();
        *last.0.lock().unwrap() = Some((pos, size));

        set_geometry_guarded(app, window, size, PhysicalPosition { x: OFFSCREEN_X, y: OFFSCREEN_Y });
    }

    let bg = app.state::<InBackground>();
    bg.0.store(true, Ordering::SeqCst);
}

/// بازگرداندن پنجره از پس‌زمینه به صفحه.
fn show_from_background(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
    let lock_state = app.state::<SidebarLock>();
    if *lock_state.0.lock().unwrap() {
        apply_sidebar_mode(app, window);
    } else {
        // حالت آزاد: برگرداندن به آخرین موقعیت شناخته‌شده روی صفحه
        let last = app.state::<LastOnScreenGeometry>();
        let saved = last.0.lock().unwrap().clone();
        if let Some((pos, size)) = saved {
            set_geometry_guarded(app, window, size, pos);
        }
    }

    let bg = app.state::<InBackground>();
    bg.0.store(false, Ordering::SeqCst);

    let _ = window.show();
    let _ = window.set_focus();
}

/// Command صدا‌زده‌شده از فرانت‌اند (مثلاً با کلید Esc) برای مخفی‌کردن
/// پنجره. از همان منطق امن off-screen استفاده می‌کند که با تری هم
/// استفاده می‌شود — هرگز hide()/minimize() واقعی صدا زده نمی‌شود.
#[tauri::command]
fn hide_to_tray(app: tauri::AppHandle, window: tauri::WebviewWindow) {
    hide_to_background(&app, &window);
}

/// Command صدا‌زده‌شده از فرانت‌اند برای نمایش دوباره‌ی پنجره از حالت
/// مخفی.
#[tauri::command]
fn show_from_tray(app: tauri::AppHandle, window: tauri::WebviewWindow) {
    show_from_background(&app, &window);
}

/// Command صدا‌زده‌شده از فرانت‌اند برای روشن‌کردن «اجرای خودکار هنگام
/// روشن‌شدن سیستم». از پلاگین رسمی tauri-plugin-autostart استفاده می‌کند.
#[tauri::command]
fn enable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    app.autolaunch().enable().map_err(|e| e.to_string())
}

/// Command صدا‌زده‌شده از فرانت‌اند برای خاموش‌کردن autostart.
#[tauri::command]
fn disable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    app.autolaunch().disable().map_err(|e| e.to_string())
}

/// Command صدا‌زده‌شده از فرانت‌اند برای خواندن وضعیت فعلی autostart —
/// مثلاً هنگام بازشدن پنل تنظیمات تا سوییچ با وضعیت واقعی هماهنگ باشد.
#[tauri::command]
fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

/// Command صدا‌زده‌شده از فرانت‌اند هر بار که کاربر تیک «نوار کناری» را
/// عوض می‌کند. هم state داخلی Rust و هم خود پنجره را هماهنگ می‌کند.
#[tauri::command]
fn set_sidebar_lock(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    lock_state: State<SidebarLock>,
    enabled: bool,
) {
    *lock_state.0.lock().unwrap() = enabled;

    // اگر الان در پس‌زمینه‌ایم، فقط state را به‌روزرسانی کن و چیزی را
    // جابه‌جا نکن — هندسه‌ی واقعی هنگام show_from_background اعمال می‌شود.
    let bg = app.state::<InBackground>();
    if bg.0.load(Ordering::SeqCst) {
        return;
    }

    if enabled {
        apply_sidebar_mode(&app, &window);
    } else {
        release_sidebar_mode(&window);
    }
}

/// Command صدا‌زده‌شده از فرانت‌اند برای خروج کامل از برنامه (نه فقط
/// مخفی‌کردن به تری). با میانبر Shift+Esc در UI صدا زده می‌شود؛ همان
/// کاری را می‌کند که گزینه‌ی «خروج کامل» در منوی تری انجام می‌دهد.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SidebarLock(Mutex::new(true))) // پیش‌فرض state فرانت‌اند هم true است
        .manage(ApplyingGeometry(AtomicBool::new(false)))
        .manage(InBackground(AtomicBool::new(false)))
        .manage(LastOnScreenGeometry(Mutex::new(None)))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:daily_priority.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    if let Some(win) = app.get_webview_window("main") {
                        let bg = app.state::<InBackground>();
                        if bg.0.load(Ordering::SeqCst) {
                            // پنجره در پس‌زمینه (offscreen) است — نمایشش بده
                            show_from_background(app, &win);
                        } else {
                            // پنجره روی صفحه است ولی ممکن است focus نداشته
                            // باشد (مثلاً کاربر روی دسکتاپ کلیک کرده) —
                            // فقط آن را جلو بیاور و focus بده
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            set_sidebar_lock,
            hide_to_tray,
            show_from_tray,
            enable_autostart,
            disable_autostart,
            is_autostart_enabled,
            quit_app
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window not found");
            let handle = app.handle().clone();

            // مستثناکردن پنجره از تسک‌بار و ژست‌های "Show Desktop"
            // (Win+D، سه‌انگشتی روی تاچ‌پد) — این ژست‌ها معمولاً پنجره‌های
            // بدون ورودی تسک‌بار را minimize نمی‌کنند، که دقیقاً همان
            // چیزی است که می‌خواهیم چون minimize این پنجره باعث فریز می‌شود.
            let _ = window.set_skip_taskbar(true);

            // غیرفعال‌کردن کامل قابلیت minimize روی این پنجره. این هم
            // دکمه‌ی minimize را از نوار تایتل (وقتی decorations فعال
            // می‌شود) حذف می‌کند و هم گزینه‌ی Minimize را در منوی
            // راست‌کلیک روی تایتل‌بار (system menu) غیرفعال می‌کند، چون
            // هر دو به یک ویژگی سطح ویندوز (WS_MINIMIZEBOX) وابسته‌اند.
            // بدون این کار، minimize واقعی همچنان باعث فریز WebView2 روی
            // این پنجره‌ی transparent می‌شود.
            let _ = window.set_minimizable(false);

            // ───── ثبت میان‌بر سراسری Alt+Ctrl+F1 برای نمایش برنامه ─────
            // این میان‌بر حتی وقتی پنجره دیده نمی‌شود (بیرون از صفحه) هم
            // کار می‌کند، چون در سطح سیستم‌عامل ثبت شده، نه فقط داخل
            // وب‌ویوی برنامه.
            let show_shortcut = Shortcut::new(Some(Modifiers::ALT | Modifiers::CONTROL), Code::F1);
            app.global_shortcut().register(show_shortcut)?;

            apply_sidebar_mode(&handle, &window);
            let _ = window.show();
            let _ = window.set_focus();

            // ───── ساخت آیکون System Tray ─────
            let show_item = MenuItem::with_id(app, "show", "نمایش برنامه", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "خروج کامل", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("missing tray icon"))
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("اولویت روزانه")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            show_from_background(app, &win);
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let bg = app.state::<InBackground>();
                            if bg.0.load(Ordering::SeqCst) {
                                show_from_background(app, &win);
                            } else {
                                hide_to_background(app, &win);
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    let app = window.app_handle();
                    if let Some(webview_window) = app.get_webview_window(window.label()) {
                        hide_to_background(app, &webview_window);
                    }
                    api.prevent_close();
                }
                // ───── قفل واقعی موقعیت/اندازه در حالت نوار کناری ─────
                WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                    let app = window.app_handle();

                    let applying = app.state::<ApplyingGeometry>();
                    if applying.0.load(Ordering::SeqCst) {
                        return;
                    }

                    // اگر در پس‌زمینه‌ایم (بیرون از صفحه)، enforcement را
                    // اجرا نکن — وگرنه فوراً پنجره را به‌اشتباه به صفحه
                    // برمی‌گرداند.
                    let bg = app.state::<InBackground>();
                    if bg.0.load(Ordering::SeqCst) {
                        return;
                    }

                    let lock_state = app.state::<SidebarLock>();
                    if *lock_state.0.lock().unwrap() {
                        if let Some(webview_window) = app.get_webview_window(window.label()) {
                            apply_sidebar_mode(app, &webview_window);
                        }
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}