import {
  Component, inject, signal, computed, output, input,
  OnChanges, SimpleChanges
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TabService } from '../../services/tab.service';
import { BookmarkService } from '../../services/bookmark.service';
import { ContentArea } from '../../services/tab.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.css',
})
export class ToolbarComponent implements OnChanges {
  readonly contentAreaFn = input.required<() => ContentArea>();

  private tabService = inject(TabService);
  private bookmarkService = inject(BookmarkService);

  readonly activeTab = computed(() => this.tabService.activeTab());
  readonly inputUrl = signal('');
  readonly isFocused = signal(false);

  readonly isBookmarked = computed(() => {
    const tab = this.activeTab();
    return tab ? this.bookmarkService.isBookmarked(tab.url) : false;
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['contentAreaFn']) return;
    const tab = this.activeTab();
    if (tab && !this.isFocused()) {
      this.inputUrl.set(tab.isNewTab ? '' : tab.url);
    }
  }

  onUrlFocus() {
    this.isFocused.set(true);
    const tab = this.activeTab();
    if (tab && !tab.isNewTab) this.inputUrl.set(tab.url);
  }

  onUrlBlur() {
    this.isFocused.set(false);
    const tab = this.activeTab();
    if (tab && !tab.isNewTab) this.inputUrl.set(tab.url);
    else this.inputUrl.set('');
  }

  async onNavigate(event: Event) {
    event.preventDefault();
    const url = this.inputUrl().trim();
    if (!url) return;
    const tab = this.activeTab();
    if (!tab) return;
    this.isFocused.set(false);
    await this.tabService.navigate(tab.id, url, this.contentAreaFn()());
  }

  async goBack() {
    const tab = this.activeTab();
    if (tab) await this.tabService.goBack(tab.id);
  }

  async goForward() {
    const tab = this.activeTab();
    if (tab) await this.tabService.goForward(tab.id);
  }

  async reload() {
    const tab = this.activeTab();
    if (tab) await this.tabService.reload(tab.id);
  }

  async toggleBookmark() {
    const tab = this.activeTab();
    if (!tab || tab.isNewTab) return;
    if (this.isBookmarked()) {
      const bm = this.bookmarkService.bookmarks().find(b => b.url === tab.url);
      if (bm) await this.bookmarkService.removeBookmark(bm.id);
    } else {
      await this.bookmarkService.addBookmark(tab.url, tab.title);
    }
  }

  displayUrl = computed(() => {
    const tab = this.activeTab();
    if (!tab || tab.isNewTab) return '';
    if (this.isFocused()) return this.inputUrl();
    return tab.url;
  });
}
