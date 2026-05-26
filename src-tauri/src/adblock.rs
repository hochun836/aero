use std::collections::HashSet;

pub struct AdBlockEngine {
    blocked_domains: HashSet<String>,
    pub enabled: bool,
}

impl AdBlockEngine {
    pub fn new() -> Self {
        let blocked_domains = include_str!("../blocklist.txt")
            .lines()
            .filter(|l| !l.starts_with('#') && !l.is_empty())
            .map(|l| l.trim().to_lowercase())
            .collect();
        Self {
            blocked_domains,
            enabled: true,
        }
    }

    pub fn is_blocked(&self, url_str: &str) -> bool {
        if !self.enabled {
            return false;
        }
        if let Ok(parsed) = url::Url::parse(url_str) {
            if let Some(host) = parsed.host_str() {
                let host = host.trim_start_matches("www.").to_lowercase();
                if self.blocked_domains.contains(&host) {
                    return true;
                }
                // Check parent domains (e.g. sub.blocked.com → check blocked.com)
                let parts: Vec<&str> = host.splitn(4, '.').collect();
                for i in 1..parts.len() {
                    let parent = parts[i..].join(".");
                    if self.blocked_domains.contains(&parent) {
                        return true;
                    }
                }
            }
        }
        false
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
}
