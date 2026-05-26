use std::sync::Arc;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, State, WebviewUrl};
use tauri::webview::{PageLoadEvent, WebviewBuilder};
use crate::AppState;
use crate::tab_manager::TabInfo;

#[derive(serde::Deserialize, Clone)]
pub struct ContentAreaPayload {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

// ─── Tab Commands ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_tab(
    app: AppHandle,
    state: State<'_, AppState>,
    url: String,
    content_area: ContentAreaPayload,
) -> Result<TabInfo, String> {
    let (tab_id, is_new_tab, parsed_url) = {
        let mut manager = state.tab_manager.lock().unwrap();
        let tab_id = manager.next_tab_id();

        manager.content_area.x = content_area.x;
        manager.content_area.y = content_area.y;
        manager.content_area.width = content_area.width;
        manager.content_area.height = content_area.height;

        let is_new_tab = url.is_empty() || url == "new-tab";
        let parsed_url = if is_new_tab {
            None
        } else {
            Some(normalize_url(&url))
        };
        manager.add_tab(
            tab_id.clone(),
            if is_new_tab { "".to_string() } else { parsed_url.clone().unwrap_or_default() },
            is_new_tab,
        );
        (tab_id, is_new_tab, parsed_url)
    };

    if is_new_tab {
        let manager = state.tab_manager.lock().unwrap();
        return Ok(manager.tabs[&tab_id].clone());
    }

    let url_str = parsed_url.unwrap();
    create_child_webview(&app, &state, &tab_id, &url_str, &content_area)?;

    let manager = state.tab_manager.lock().unwrap();
    Ok(manager.tabs[&tab_id].clone())
}

fn create_child_webview(
    app: &AppHandle,
    state: &State<'_, AppState>,
    tab_id: &str,
    url: &str,
    content_area: &ContentAreaPayload,
) -> Result<(), String> {
    let parsed: tauri::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    let webview_url = WebviewUrl::External(parsed);
    let tab_id_owned = tab_id.to_string();
    let app_clone = app.clone();
    let adblock_ref = Arc::clone(&state.adblock);

    // Need tauri::Window (not WebviewWindow) for add_child (unstable API)
    let main_window = app.get_window("main").ok_or("Main window not found")?;

    let builder = WebviewBuilder::new(tab_id, webview_url)
        .initialization_script(&build_title_script(tab_id))
        .on_navigation(move |nav_url| {
            // AdBlock: block known ad domains
            if let Ok(engine) = adblock_ref.lock() {
                if engine.is_blocked(nav_url.as_str()) {
                    return false; // block navigation
                }
            }
            true // allow
        })
        .on_page_load(move |_webview, payload| {
            let loading = payload.event() == PageLoadEvent::Started;
            let url = payload.url().to_string();
            let _ = app_clone.emit("tab-updated", serde_json::json!({
                "tab_id": tab_id_owned,
                "url": url,
                "loading": loading,
            }));
        });

    main_window
        .add_child(
            builder,
            LogicalPosition::new(content_area.x, content_area.y),
            LogicalSize::new(content_area.width, content_area.height),
        )
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn build_title_script(tab_id: &str) -> String {
    format!(
        r#"
(function() {{
    const TAB_ID = "{tab_id}";
    function sendInfo() {{
        try {{
            if (window.__TAURI_INTERNALS__) {{
                window.__TAURI_INTERNALS__.ipc.postMessage(JSON.stringify({{
                    cmd: "plugin:tauri|invoke",
                    callback: 0,
                    error: 0,
                    payload: {{
                        __tauriModule: "Tauri",
                        message: {{
                            cmd: "report_tab_title",
                            tabId: TAB_ID,
                            title: document.title || location.hostname,
                            url: location.href
                        }}
                    }}
                }}));
            }}
        }} catch(e) {{}}
    }}
    window.addEventListener('load', sendInfo);
    const titleEl = document.querySelector('title');
    if (titleEl) {{
        new MutationObserver(sendInfo).observe(titleEl, {{ childList: true }});
    }} else {{
        const obs = new MutationObserver(function() {{
            const el = document.querySelector('title');
            if (el) {{
                obs.disconnect();
                new MutationObserver(sendInfo).observe(el, {{ childList: true }});
                sendInfo();
            }}
        }});
        obs.observe(document, {{ childList: true, subtree: true }});
    }}
}})();
"#,
        tab_id = tab_id
    )
}

#[tauri::command]
pub async fn report_tab_title(
    app: AppHandle,
    state: State<'_, AppState>,
    tab_id: String,
    title: String,
    url: String,
) -> Result<(), String> {
    {
        let mut manager = state.tab_manager.lock().unwrap();
        manager.update_tab(&tab_id, Some(url.clone()), Some(title.clone()), Some(false));
    }
    let _ = app.emit("tab-title", serde_json::json!({
        "tab_id": tab_id,
        "title": title,
        "url": url,
    }));
    Ok(())
}

#[tauri::command]
pub async fn close_tab(
    app: AppHandle,
    state: State<'_, AppState>,
    tab_id: String,
) -> Result<Option<String>, String> {
    let next_active = {
        let mut manager = state.tab_manager.lock().unwrap();
        manager.remove_tab(&tab_id);
        manager.active_tab.clone()
    };

    if let Some(webview) = app.get_webview(&tab_id) {
        webview.close().map_err(|e| e.to_string())?;
    }

    Ok(next_active)
}

#[tauri::command]
pub async fn switch_tab(
    app: AppHandle,
    state: State<'_, AppState>,
    tab_id: String,
) -> Result<(), String> {
    let (tab_order, content_area) = {
        let mut manager = state.tab_manager.lock().unwrap();
        manager.active_tab = Some(tab_id.clone());
        let ca = (manager.content_area.x, manager.content_area.y, manager.content_area.width, manager.content_area.height);
        (manager.tab_order.clone(), ca)
    };

    for id in &tab_order {
        if let Some(webview) = app.get_webview(id) {
            if id == &tab_id {
                let _ = webview.set_position(tauri::Position::Logical(
                    LogicalPosition::new(content_area.0, content_area.1),
                ));
                let _ = webview.set_size(tauri::Size::Logical(
                    LogicalSize::new(content_area.2, content_area.3),
                ));
                let _ = webview.set_focus();
            } else {
                let _ = webview.set_position(tauri::Position::Logical(
                    LogicalPosition::new(-9999.0, -9999.0),
                ));
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn navigate_tab(
    app: AppHandle,
    state: State<'_, AppState>,
    tab_id: String,
    url: String,
    content_area: ContentAreaPayload,
) -> Result<TabInfo, String> {
    let full_url = normalize_url(&url);

    let tab_exists = {
        let manager = state.tab_manager.lock().unwrap();
        manager.tabs.contains_key(&tab_id)
    };

    if !tab_exists {
        return Err("Tab not found".to_string());
    }

    if let Some(webview) = app.get_webview(&tab_id) {
        let parsed: tauri::Url = full_url.parse().map_err(|e: url::ParseError| e.to_string())?;
        webview.navigate(parsed).map_err(|e| e.to_string())?;
    } else {
        create_child_webview(&app, &state, &tab_id, &full_url, &content_area)?;
    }

    {
        let mut manager = state.tab_manager.lock().unwrap();
        manager.content_area.x = content_area.x;
        manager.content_area.y = content_area.y;
        manager.content_area.width = content_area.width;
        manager.content_area.height = content_area.height;
        manager.update_tab(&tab_id, Some(full_url), None, Some(true));
    }

    let manager = state.tab_manager.lock().unwrap();
    Ok(manager.tabs[&tab_id].clone())
}

#[tauri::command]
pub async fn go_back(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&tab_id) {
        webview.eval("window.history.back()").map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn go_forward(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&tab_id) {
        webview.eval("window.history.forward()").map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn reload_tab(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&tab_id) {
        webview.eval("window.location.reload()").map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn update_content_area(
    app: AppHandle,
    state: State<'_, AppState>,
    content_area: ContentAreaPayload,
) -> Result<(), String> {
    let (active_id, order) = {
        let mut manager = state.tab_manager.lock().unwrap();
        manager.content_area.x = content_area.x;
        manager.content_area.y = content_area.y;
        manager.content_area.width = content_area.width;
        manager.content_area.height = content_area.height;
        (manager.active_tab.clone(), manager.tab_order.clone())
    };

    for id in &order {
        if Some(id) == active_id.as_ref() {
            if let Some(webview) = app.get_webview(id) {
                let _ = webview.set_position(tauri::Position::Logical(
                    LogicalPosition::new(content_area.x, content_area.y),
                ));
                let _ = webview.set_size(tauri::Size::Logical(
                    LogicalSize::new(content_area.width, content_area.height),
                ));
            }
        }
    }
    Ok(())
}

// ─── AdBlock Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn set_adblock_enabled(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    let mut engine = state.adblock.lock().unwrap();
    engine.set_enabled(enabled);
    Ok(())
}

#[tauri::command]
pub async fn get_adblock_enabled(state: State<'_, AppState>) -> Result<bool, String> {
    let engine = state.adblock.lock().unwrap();
    Ok(engine.enabled)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

fn normalize_url(url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else if trimmed.contains('.') && !trimmed.contains(' ') {
        format!("https://{}", trimmed)
    } else {
        let query = urlencoding::encode(trimmed);
        format!("https://www.google.com/search?q={}", query)
    }
}
