import { Injectable, signal } from '@angular/core';
import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

export type TabPosition = 'top' | 'left';

export interface Settings {
  tabPosition: TabPosition;
  adblockEnabled: boolean;
  homePage: string;
}

const DEFAULTS: Settings = {
  tabPosition: 'top',
  adblockEnabled: true,
  homePage: '',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<Settings>({ ...DEFAULTS });

  private db: Awaited<ReturnType<typeof Database.load>> | null = null;

  async init() {
    this.db = await Database.load('sqlite:aero.db');
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    await this.load();
  }

  private async load() {
    if (!this.db) return;
    const rows = await this.db.select<{ key: string; value: string }[]>(
      'SELECT key, value FROM settings'
    );
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    this.settings.set({
      tabPosition: (map['tabPosition'] as TabPosition) ?? DEFAULTS.tabPosition,
      adblockEnabled: (map['adblockEnabled'] ?? String(DEFAULTS.adblockEnabled)) === 'true',
      homePage: map['homePage'] ?? DEFAULTS.homePage,
    });

    // Sync adblock to Rust backend
    await invoke('set_adblock_enabled', { enabled: this.settings().adblockEnabled });
  }

  async set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    if (!this.db) return;
    await this.db.execute(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, String(value)]
    );
    this.settings.update(s => ({ ...s, [key]: value }));
    if (key === 'adblockEnabled') {
      await invoke('set_adblock_enabled', { enabled: value as boolean });
    }
  }
}
