import { Component, inject, output } from '@angular/core';
import { BookmarkService, Bookmark } from '../../services/bookmark.service';
import { TabService } from '../../services/tab.service';

@Component({
  selector: 'app-bookmarks-panel',
  standalone: true,
  templateUrl: './bookmarks-panel.component.html',
  styleUrl: './bookmarks-panel.component.css',
})
export class BookmarksPanelComponent {
  readonly close = output<void>();
  readonly navigate = output<string>();

  private bookmarkService = inject(BookmarkService);
  readonly bookmarks = this.bookmarkService.bookmarks;

  open(bookmark: Bookmark) {
    this.navigate.emit(bookmark.url);
    this.close.emit();
  }

  async remove(id: number) {
    await this.bookmarkService.removeBookmark(id);
  }

  faviconUrl(url: string): string {
    try {
      const u = new URL(url);
      return `https://www.google.com/s2/favicons?sz=16&domain=${u.hostname}`;
    } catch { return ''; }
  }
}
