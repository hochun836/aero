import { Injectable, signal } from '@angular/core';
import Database from '@tauri-apps/plugin-sql';

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  favicon?: string;
  created_at: string;
}

export interface PresetSite {
  id: number;
  url: string;
  title: string;
  icon_url?: string;
  position: number;
}

@Injectable({ providedIn: 'root' })
export class BookmarkService {
  readonly bookmarks = signal<Bookmark[]>([]);
  readonly presets = signal<PresetSite[]>([]);

  private db: Awaited<ReturnType<typeof Database.load>> | null = null;

  async init() {
    this.db = await Database.load('sqlite:aero.db');
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        favicon TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS preset_sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        icon_url TEXT,
        position INTEGER DEFAULT 0
      );
    `);
    await this.loadBookmarks();
    await this.loadPresets();

    // Seed default presets on first run
    if (this.presets().length === 0) {
      const defaults = [
        { url: 'https://www.google.com', title: 'Google', position: 0 },
        { url: 'https://github.com', title: 'GitHub', position: 1 },
        { url: 'https://www.youtube.com', title: 'YouTube', position: 2 },
        { url: 'https://www.wikipedia.org', title: 'Wikipedia', position: 3 },
      ];
      for (const site of defaults) {
        await this.addPreset(site.url, site.title, undefined, site.position);
      }
    }
  }

  private async loadBookmarks() {
    if (!this.db) return;
    const rows = await this.db.select<Bookmark[]>('SELECT * FROM bookmarks ORDER BY created_at DESC');
    this.bookmarks.set(rows);
  }

  private async loadPresets() {
    if (!this.db) return;
    const rows = await this.db.select<PresetSite[]>('SELECT * FROM preset_sites ORDER BY position ASC');
    this.presets.set(rows);
  }

  async addBookmark(url: string, title: string, favicon?: string): Promise<void> {
    if (!this.db) return;
    await this.db.execute(
      'INSERT INTO bookmarks (url, title, favicon) VALUES (?, ?, ?)',
      [url, title, favicon ?? null]
    );
    await this.loadBookmarks();
  }

  async removeBookmark(id: number): Promise<void> {
    if (!this.db) return;
    await this.db.execute('DELETE FROM bookmarks WHERE id = ?', [id]);
    this.bookmarks.update(list => list.filter(b => b.id !== id));
  }

  isBookmarked(url: string): boolean {
    return this.bookmarks().some(b => b.url === url);
  }

  async addPreset(url: string, title: string, iconUrl?: string, position?: number): Promise<void> {
    if (!this.db) return;
    const pos = position ?? this.presets().length;
    await this.db.execute(
      'INSERT INTO preset_sites (url, title, icon_url, position) VALUES (?, ?, ?, ?)',
      [url, title, iconUrl ?? null, pos]
    );
    await this.loadPresets();
  }

  async updatePreset(id: number, url: string, title: string, iconUrl?: string): Promise<void> {
    if (!this.db) return;
    await this.db.execute(
      'UPDATE preset_sites SET url = ?, title = ?, icon_url = ? WHERE id = ?',
      [url, title, iconUrl ?? null, id]
    );
    await this.loadPresets();
  }

  async removePreset(id: number): Promise<void> {
    if (!this.db) return;
    await this.db.execute('DELETE FROM preset_sites WHERE id = ?', [id]);
    this.presets.update(list => list.filter(p => p.id !== id));
  }
}
