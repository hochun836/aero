import { Component, inject, output } from '@angular/core';
import { BookmarkService, PresetSite } from '../../services/bookmark.service';
import { TabService, ContentArea } from '../../services/tab.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-new-tab-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './new-tab-page.component.html',
  styleUrl: './new-tab-page.component.css',
})
export class NewTabPageComponent {
  readonly navigate = output<string>();

  private bookmarkService = inject(BookmarkService);
  private tabService = inject(TabService);

  readonly presets = this.bookmarkService.presets;

  searchQuery = '';
  editingPreset: PresetSite | null = null;
  editUrl = '';
  editTitle = '';
  showAddForm = false;
  newUrl = '';
  newTitle = '';

  onSearch(event: Event) {
    event.preventDefault();
    if (this.searchQuery.trim()) {
      this.navigate.emit(this.searchQuery.trim());
    }
  }

  openPreset(preset: PresetSite) {
    this.navigate.emit(preset.url);
  }

  startEdit(preset: PresetSite) {
    this.editingPreset = preset;
    this.editUrl = preset.url;
    this.editTitle = preset.title;
  }

  async saveEdit() {
    if (!this.editingPreset) return;
    await this.bookmarkService.updatePreset(this.editingPreset.id, this.editUrl, this.editTitle);
    this.editingPreset = null;
  }

  cancelEdit() {
    this.editingPreset = null;
  }

  async removePreset(id: number) {
    await this.bookmarkService.removePreset(id);
  }

  async addPreset() {
    if (!this.newUrl.trim()) return;
    await this.bookmarkService.addPreset(this.newUrl.trim(), this.newTitle.trim() || this.newUrl.trim());
    this.newUrl = '';
    this.newTitle = '';
    this.showAddForm = false;
  }

  faviconUrl(url: string): string {
    try {
      const u = new URL(url.startsWith('http') ? url : 'https://' + url);
      return `https://www.google.com/s2/favicons?sz=32&domain=${u.hostname}`;
    } catch {
      return '';
    }
  }
}
