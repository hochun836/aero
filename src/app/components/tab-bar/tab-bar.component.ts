import {
  Component, inject, input, output, computed, signal
} from '@angular/core';
import { TabService, Tab, ContentArea } from '../../services/tab.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.css',
})
export class TabBarComponent {
  readonly contentAreaFn = input.required<() => ContentArea>();
  readonly onOpenSettings = output<void>();

  private tabService = inject(TabService);
  private settingsService = inject(SettingsService);

  readonly tabs = computed(() => this.tabService.tabs());
  readonly activeTabId = computed(() => this.tabService.activeTabId());
  readonly tabPosition = computed(() => this.settingsService.settings().tabPosition);

  async newTab() {
    await this.tabService.openTab('new-tab', this.contentAreaFn()());
  }

  async selectTab(tab: Tab) {
    if (tab.isNewTab || !tab.loading) {
      await this.tabService.switchTab(tab.id);
    } else {
      await this.tabService.switchTab(tab.id);
    }
  }

  async closeTab(event: MouseEvent, tabId: string) {
    event.stopPropagation();
    await this.tabService.closeTab(tabId);
  }

  favicon(tab: Tab): string {
    if (tab.isNewTab) return '';
    try {
      const u = new URL(tab.url);
      return `https://www.google.com/s2/favicons?sz=16&domain=${u.hostname}`;
    } catch {
      return '';
    }
  }

  shortTitle(tab: Tab): string {
    if (tab.isNewTab) return '新分頁';
    if (tab.loading) return '載入中...';
    return tab.title || (tab.url ? new URL(tab.url).hostname : '');
  }

  openSettings() {
    this.onOpenSettings.emit();
  }
}
