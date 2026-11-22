import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Calc } from './core/calc';
import { Store } from './core/store';
import { Ui } from './core/ui';
import { Icon } from './shared/icon';
import { Sheet } from './shared/sheet';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected ui = inject(Ui);
  protected calc = inject(Calc);
  private store = inject(Store);
  private sw = inject(SwUpdate);

  protected readonly tabs = [
    { path: '/heute', label: 'Heute', icon: 'timer' },
    { path: '/uebersicht', label: 'Übersicht', icon: 'chart' },
    { path: '/abwesenheiten', label: 'Abwesend', icon: 'event' },
    { path: '/uni', label: 'Uni', icon: 'school' },
    { path: '/einstellungen', label: 'Mehr', icon: 'settings' },
  ];

  constructor() {
    effect(() => {
      const theme = this.store.data().settings.theme;
      const root = document.documentElement;
      if (theme === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', theme);
      const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#111418' : '#f8f9ff');
    });
    if (this.sw.isEnabled) {
      this.sw.versionUpdates.subscribe((ev) => {
        if (ev.type === 'VERSION_READY') {
          this.ui.show('Neue Version verfügbar', { label: 'Neu laden', run: () => location.reload() }, 15000);
        }
      });
    }
  }
}
