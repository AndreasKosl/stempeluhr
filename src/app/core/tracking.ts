import { Injectable, inject } from '@angular/core';
import { Calc } from './calc';
import { fmtDuration, nowMinute, nowMs, timeToTs, todayKey } from './date-utils';
import { Geo } from './geo';
import { PLACE_LABELS } from './models';
import { Store } from './store';
import { Ui } from './ui';

/** Stempel-Aktionen: Kommen, Pause, Gehen, Mittagspause, Uni */
@Injectable({ providedIn: 'root' })
export class Tracking {
  private store = inject(Store);
  private calc = inject(Calc);
  private geo = inject(Geo);
  private ui = inject(Ui);

  async startWork() {
    if (this.calc.runningWork()) return;
    const s = this.store.data().settings;
    const entry = this.store.addEntry({ kind: 'work', start: nowMinute(), end: null, place: s.defaultPlace, placeAuto: false });
    if (!s.autoLocation) {
      this.ui.show(`Eingestempelt · ${PLACE_LABELS[s.defaultPlace]}`);
      return;
    }
    this.ui.show('Eingestempelt · Standort wird ermittelt …');
    await this.tagPlace(entry.id);
  }

  /** Ermittelt den Arbeitsort per GPS und setzt ihn am Eintrag. */
  async tagPlace(entryId: string) {
    const r = await this.geo.detectPlace();
    if (!this.store.data().entries.some((e) => e.id === entryId)) return;
    this.store.updateEntry(entryId, { place: r.place, placeAuto: r.located });
    if (r.located) {
      const dist = r.distance != null ? ` (${Math.round(r.distance)} m bis ${r.office?.name ?? 'Büro'})` : '';
      this.ui.show(`${PLACE_LABELS[r.place]} erkannt${dist}`);
    } else {
      this.ui.show(`${r.error ?? 'Standort unbekannt'} – ${PLACE_LABELS[r.place]} gesetzt`);
    }
  }

  pause() {
    if (!this.calc.runningWork() || this.calc.runningPause()) return;
    this.store.addEntry({ kind: 'pause', start: nowMinute(), end: null });
    this.ui.show('Pause gestartet');
  }

  resume() {
    const p = this.calc.runningPause();
    if (!p) return;
    this.store.updateEntry(p.id, { end: nowMinute() });
    this.ui.show('Weiter geht’s');
  }

  stop() {
    const now = nowMinute();
    const p = this.calc.runningPause();
    if (p) this.store.updateEntry(p.id, { end: now });
    const w = this.calc.runningWork();
    if (!w) return;
    this.store.updateEntry(w.id, { end: now });
    const t = this.calc.day(todayKey(), now);
    let msg = `Ausgestempelt · heute ${fmtDuration(t.workedMin)} h`;
    if (t.workedMin > 9 * 60 && t.pauseMin < 45) msg += ' · Hinweis: ab 9 h sind 45 min Pause vorgeschrieben';
    else if (t.workedMin > 6 * 60 && t.pauseMin < 30) msg += ' · Hinweis: ab 6 h sind 30 min Pause vorgeschrieben';
    this.ui.show(msg, undefined, 6000);
  }

  /** Trägt die Standard-Mittagspause (z. B. 11:30–12:00) für einen Tag ein. */
  addLunch(day = todayKey()) {
    const s = this.store.data().settings;
    const start = timeToTs(day, s.lunchStart);
    const end = timeToTs(day, s.lunchEnd);
    const clash = (this.calc.workByDay().get(day) ?? []).some(
      (e) => e.kind === 'pause' && e.start < end && (e.end ?? nowMs()) > start,
    );
    if (clash) {
      this.ui.show('In diesem Zeitraum ist bereits eine Pause eingetragen');
      return;
    }
    const entry = this.store.addEntry({ kind: 'pause', start, end, note: 'Mittagspause' });
    this.ui.show(`Pause ${s.lunchStart}–${s.lunchEnd} eingetragen`, {
      label: 'Rückgängig',
      run: () => this.store.deleteEntry(entry.id),
    });
  }

  startUni(note?: string) {
    if (this.calc.runningUni()) return;
    this.store.addEntry({ kind: 'uni', start: nowMinute(), end: null, note: note || undefined });
    this.ui.show('Uni-Zeit läuft');
  }

  stopUni() {
    const u = this.calc.runningUni();
    if (!u) return;
    this.store.updateEntry(u.id, { end: nowMinute() });
    this.ui.show('Uni-Zeit gestoppt');
  }
}
