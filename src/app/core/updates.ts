import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { Ui } from './ui';

/** Wird beim Deploy per `ng build --define BUILD_VERSION=...` gesetzt. */
declare const BUILD_VERSION: string;

/** Version des laufenden Bundles, z. B. "25.11.2026 · cf97605" (lokal: "dev"). */
export const APP_VERSION: string = typeof BUILD_VERSION === 'string' ? BUILD_VERSION : 'dev';

/** Service-Worker-Updates: automatische Benachrichtigung und manuelle Suche. */
@Injectable({ providedIn: 'root' })
export class Updates {
  private sw = inject(SwUpdate);
  private ui = inject(Ui);

  readonly enabled = this.sw.isEnabled;
  /** Neue Version ist geladen und wird beim Neuladen aktiv */
  readonly ready = signal(false);
  readonly checking = signal(false);

  constructor() {
    if (!this.sw.isEnabled) return;
    this.sw.versionUpdates.subscribe((ev) => {
      if (ev.type === 'VERSION_READY') {
        this.ready.set(true);
        this.offerReload();
      }
    });
  }

  reload() {
    location.reload();
  }

  async check() {
    if (!this.sw.isEnabled) {
      this.ui.show('Update-Suche ist nur in der installierten App verfügbar');
      return;
    }
    if (this.ready()) {
      this.offerReload();
      return;
    }
    this.checking.set(true);
    try {
      if (await this.sw.checkForUpdate()) {
        this.ready.set(true);
        this.offerReload();
      } else {
        this.ui.show('Stempeluhr ist auf dem neuesten Stand');
      }
    } catch {
      this.ui.show('Update-Suche fehlgeschlagen – bist du online?');
    } finally {
      this.checking.set(false);
    }
  }

  private offerReload() {
    this.ui.show('Neue Version verfügbar', { label: 'Neu laden', run: () => this.reload() }, 15000);
  }
}
