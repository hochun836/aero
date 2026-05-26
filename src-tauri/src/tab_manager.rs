use std::collections::HashMap;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TabInfo {
    pub id: String,
    pub url: String,
    pub title: String,
    pub favicon: Option<String>,
    pub loading: bool,
    pub is_new_tab: bool,
}

pub struct ContentArea {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub struct TabManager {
    pub tabs: HashMap<String, TabInfo>,
    pub tab_order: Vec<String>,
    pub active_tab: Option<String>,
    pub content_area: ContentArea,
    pub tab_counter: u32,
}

impl TabManager {
    pub fn new() -> Self {
        Self {
            tabs: HashMap::new(),
            tab_order: Vec::new(),
            active_tab: None,
            content_area: ContentArea {
                x: 0.0,
                y: 84.0,
                width: 1280.0,
                height: 716.0,
            },
            tab_counter: 0,
        }
    }

    pub fn next_tab_id(&mut self) -> String {
        self.tab_counter += 1;
        format!("tab_{}", self.tab_counter)
    }

    pub fn add_tab(&mut self, id: String, url: String, is_new_tab: bool) {
        let title = if is_new_tab {
            "新分頁".to_string()
        } else {
            url::Url::parse(&url)
                .ok()
                .and_then(|u| u.host_str().map(|h| h.to_string()))
                .unwrap_or_else(|| "載入中...".to_string())
        };
        let info = TabInfo {
            id: id.clone(),
            url,
            title,
            favicon: None,
            loading: !is_new_tab,
            is_new_tab,
        };
        self.tab_order.push(id.clone());
        self.tabs.insert(id.clone(), info);
        self.active_tab = Some(id);
    }

    pub fn remove_tab(&mut self, id: &str) {
        self.tabs.remove(id);
        self.tab_order.retain(|t| t != id);
        if self.active_tab.as_deref() == Some(id) {
            self.active_tab = self.tab_order.last().cloned();
        }
    }

    pub fn update_tab(&mut self, id: &str, url: Option<String>, title: Option<String>, loading: Option<bool>) {
        if let Some(tab) = self.tabs.get_mut(id) {
            if let Some(u) = url {
                tab.url = u;
                tab.is_new_tab = false;
            }
            if let Some(t) = title {
                if !t.is_empty() {
                    tab.title = t;
                }
            }
            if let Some(l) = loading {
                tab.loading = l;
            }
        }
    }

    pub fn get_ordered_tabs(&self) -> Vec<TabInfo> {
        self.tab_order
            .iter()
            .filter_map(|id| self.tabs.get(id).cloned())
            .collect()
    }
}
