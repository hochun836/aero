import { Injectable, signal, computed } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  loading: boolean;
  isNewTab: boolean;
}

export interface ContentArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class TabService {
  readonly tabs = signal<Tab[]>([]);
  readonly activeTabId = signal<string | null>(null);
  readonly activeTab = computed(() =>
    this.tabs().find(t => t.id === this.activeTabId()) ?? null
  );

  private unlisteners: UnlistenFn[] = [];

  async init() {
    const unlisten1 = await listen<{ tab_id: string; url: string; loading: boolean }>(
      'tab-updated',
      ({ payload }) => {
        this.tabs.update(tabs =>
          tabs.map(t =>
            t.id === payload.tab_id
              ? { ...t, url: payload.url ?? t.url, loading: payload.loading }
              : t
          )
        );
      }
    );
    const unlisten2 = await listen<{ tab_id: string; title: string; url: string }>(
      'tab-title',
      ({ payload }) => {
        this.tabs.update(tabs =>
          tabs.map(t =>
            t.id === payload.tab_id
              ? { ...t, title: payload.title || t.title, url: payload.url || t.url, loading: false }
              : t
          )
        );
      }
    );
    this.unlisteners.push(unlisten1, unlisten2);
  }

  async openTab(url: string, contentArea: ContentArea): Promise<Tab> {
    const info = await invoke<{ id: string; url: string; title: string; favicon: string | null; loading: boolean; is_new_tab: boolean }>('create_tab', { url, contentArea });
    const tab: Tab = {
      id: info.id,
      url: info.url,
      title: info.title,
      favicon: info.favicon ?? undefined,
      loading: info.loading,
      isNewTab: info.is_new_tab,
    };
    this.tabs.update(tabs => [...tabs, tab]);
    this.activeTabId.set(tab.id);
    return tab;
  }

  async closeTab(tabId: string): Promise<void> {
    const nextId = await invoke<string | null>('close_tab', { tabId });
    this.tabs.update(tabs => tabs.filter(t => t.id !== tabId));
    if (nextId) {
      this.activeTabId.set(nextId);
    } else if (this.tabs().length > 0) {
      this.activeTabId.set(this.tabs()[this.tabs().length - 1].id);
    } else {
      this.activeTabId.set(null);
    }
  }

  async switchTab(tabId: string): Promise<void> {
    if (this.activeTabId() === tabId) return;
    await invoke('switch_tab', { tabId });
    this.activeTabId.set(tabId);
  }

  async navigate(tabId: string, url: string, contentArea: ContentArea): Promise<void> {
    const info = await invoke<Tab>('navigate_tab', { tabId, url, contentArea });
    this.tabs.update(tabs =>
      tabs.map(t =>
        t.id === tabId
          ? { ...t, url: info.url, title: info.title, loading: true, isNewTab: false }
          : t
      )
    );
  }

  async goBack(tabId: string) { await invoke('go_back', { tabId }); }
  async goForward(tabId: string) { await invoke('go_forward', { tabId }); }
  async reload(tabId: string) { await invoke('reload_tab', { tabId }); }

  async updateContentArea(contentArea: ContentArea) {
    await invoke('update_content_area', { contentArea });
  }

  setTabLoading(tabId: string, loading: boolean) {
    this.tabs.update(tabs =>
      tabs.map(t => (t.id === tabId ? { ...t, loading } : t))
    );
  }

  destroy() {
    this.unlisteners.forEach(fn => fn());
  }
}
