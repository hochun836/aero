import { Component, inject, output } from '@angular/core';
import { SettingsService, TabPosition } from '../../services/settings.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings-panel.component.html',
  styleUrl: './settings-panel.component.css',
})
export class SettingsPanelComponent {
  readonly close = output<void>();
  private settingsService = inject(SettingsService);
  readonly settings = this.settingsService.settings;

  async setTabPosition(pos: TabPosition) {
    await this.settingsService.set('tabPosition', pos);
  }

  async setAdblock(event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    await this.settingsService.set('adblockEnabled', enabled);
  }
}
