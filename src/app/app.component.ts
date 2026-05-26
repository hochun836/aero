import {
  Component, inject, OnInit, OnDestroy, ViewChild, ElementRef,
  AfterViewInit, signal, computed, HostListener
} from '@angular/core';
import { TabService, ContentArea } from './services/tab.service';
import { BookmarkService } from './services/bookmark.service';
import { SettingsService } from './services/settings.service';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { TabBarComponent } from './components/tab-bar/tab-bar.component';
import { NewTabPageComponent } from './components/new-tab-page/new-tab-page.component';
import { BookmarksPanelComponent } from './components/bookmarks-panel/bookmarks-panel.component';
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ToolbarComponent,
    TabBarComponent,
    NewTabPageComponent,
    BookmarksPanelComponent,
    SettingsPanelComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('contentArea') contentAreaRef!: ElementRef<HTMLDivElement>;

  readonly tabService = inject(TabService);
  readonly bookmarkService = inject(BookmarkService);
  readonly settingsService = inject(SettingsService);

  readonly tabPosition = computed(() => this.settingsService.settings().tabPosition);
  readonly activeTab = computed(() => this.tabService.activeTab());
  readonly showNewTabPage = computed(() => !this.activeTab() || this.activeTab()!.isNewTab);

  showBookmarks = signal(false);
  showSettings = signal(false);

  private resizeObserver?: ResizeObserver;

  getContentArea(): ContentArea {
    const el = this.contentAreaRef?.nativeElement;
    if (!el) return { x: 0, y: 84, width: 1280, height: 716 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }

  // Arrow fn so it can be passed as input
  readonly contentAreaFn = () => this.getContentArea();

  async ngOnInit() {
    await this.settingsService.init();
    await this.bookmarkService.init();
    await this.tabService.init();
    // Open initial new tab
    await this.tabService.openTab('new-tab', this.getContentArea());
  }

  ngAfterViewInit() {
    this.resizeObserver = new ResizeObserver(() => {
      this.tabService.updateContentArea(this.getContentArea());
    });
    if (this.contentAreaRef?.nativeElement) {
      this.resizeObserver.observe(this.contentAreaRef.nativeElement);
    }
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.tabService.destroy();
  }

  async onNavigate(url: string) {
    const tab = this.activeTab();
    if (tab) {
      await this.tabService.navigate(tab.id, url, this.getContentArea());
    }
  }

  // ─── Keyboard shortcuts ───────────────────────────────────────
  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 't') { e.preventDefault(); this.tabService.openTab('new-tab', this.getContentArea()); }
    if (ctrl && e.key === 'w') { e.preventDefault(); const t = this.activeTab(); if (t) this.tabService.closeTab(t.id); }
    if (ctrl && e.key === 'r') { e.preventDefault(); const t = this.activeTab(); if (t && !t.isNewTab) this.tabService.reload(t.id); }
    if (ctrl && e.key === 'Tab') { e.preventDefault(); this.switchToNextTab(e.shiftKey ? -1 : 1); }
  }

  private switchToNextTab(dir: 1 | -1) {
    const tabs = this.tabService.tabs();
    const activeId = this.tabService.activeTabId();
    const idx = tabs.findIndex(t => t.id === activeId);
    if (idx === -1) return;
    const next = (idx + dir + tabs.length) % tabs.length;
    this.tabService.switchTab(tabs[next].id);
  }
}
