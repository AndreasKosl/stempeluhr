import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { exportBackup, parseBackup } from '../core/backup';
import { Calc } from '../core/calc';
import { shareOrDownload } from '../core/calendar';
import { fmtDuration, parseDuration, todayKey } from '../core/date-utils';
import { Geo, PlaceResult } from '../core/geo';
import { STATES } from '../core/holidays';
import { OfficeLocation, OvertimeAdjustment, PLACE_LABELS, Settings, WorkPlan, emptyData, uid } from '../core/models';
import { Store } from '../core/store';
import { Ui } from '../core/ui';
import { Icon } from '../shared/icon';
import { DayPipe, DurPipe, NumPipe } from '../shared/pipes';
import { Sheet } from '../shared/sheet';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

@Component({
  selector: 'app-einstellungen',
  imports: [FormsModule, Icon, Sheet, DayPipe, DurPipe, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './einstellungen.html',
  styleUrl: './einstellungen.scss',
})
export class EinstellungenPage {
  protected store = inject(Store);
  protected calc = inject(Calc);
  protected geo = inject(Geo);
  private ui = inject(Ui);

  protected readonly states = STATES;
  protected readonly wd = WD;
  protected readonly placeLabels = PLACE_LABELS;
  protected readonly version = '1.0.0';

  protected s = computed(() => this.store.data().settings);
  protected plans = computed(() => [...this.calc.plans()].reverse());
  protected adjustments = computed(() => [...this.store.data().adjustments].sort((a, b) => b.date.localeCompare(a.date)));
  protected counts = computed(() => {
    const d = this.store.data();
    return {
      work: d.entries.filter((e) => e.kind === 'work').length,
      uni: d.entries.filter((e) => e.kind === 'uni').length,
      absences: d.absences.length,
    };
  });

  // Arbeitsplan-Editor
  protected planEdit = signal<WorkPlan | null>(null);
  // Korrektur-Editor
  protected adjEdit = signal<{ id: string; date: string; value: string; note: string } | null>(null);
  // Büro-Editor
  protected officeEdit = signal<OfficeLocation | null>(null);
  protected locTest = signal<PlaceResult | null>(null);

  update(s: Partial<Settings>) {
    this.store.updateSettings(s);
  }

  planExists(id: string) {
    return this.store.data().plans.some((x) => x.id === id);
  }

  planTotal(p: WorkPlan) {
    return p.hours.reduce((a, b) => a + (Number(b) || 0), 0);
  }

  planDays(p: WorkPlan) {
    const days = p.hours.map((h, i) => (h > 0 ? WD[i] : null)).filter(Boolean);
    const uniform = new Set(p.hours.filter((h) => h > 0)).size === 1;
    const hrs = p.hours.find((h) => h > 0) ?? 0;
    return days.length ? `${days.join(', ')}${uniform ? ` à ${hrs.toLocaleString('de-DE')} h` : ''}` : 'keine Arbeitstage';
  }

  newPlan() {
    const last = this.calc.plans().at(-1);
    this.planEdit.set({ id: uid(), validFrom: todayKey(), hours: last ? [...last.hours] : [8, 8, 8, 8, 8, 0, 0] });
  }

  setPlanHour(i: number, v: string | number) {
    const p = this.planEdit();
    if (!p) return;
    const hours = [...p.hours];
    hours[i] = Math.max(0, Number(String(v).replace(',', '.')) || 0);
    this.planEdit.set({ ...p, hours });
  }

  savePlan() {
    const p = this.planEdit();
    if (!p?.validFrom) return;
    this.store.savePlan(p);
    this.planEdit.set(null);
    this.ui.show('Arbeitsplan gespeichert');
  }

  async deletePlan() {
    const p = this.planEdit();
    if (!p) return;
    if (!(await this.ui.confirm('Arbeitsplan löschen?', 'Soll- und Überstunden werden neu berechnet.', 'Löschen', true))) return;
    this.store.deletePlan(p.id);
    this.planEdit.set(null);
  }

  newAdjustment() {
    this.adjEdit.set({ id: uid(), date: todayKey(), value: '', note: '' });
  }

  editAdjustment(a: OvertimeAdjustment) {
    this.adjEdit.set({ id: a.id, date: a.date, value: fmtDuration(a.minutes, true).replace('−', '-'), note: a.note ?? '' });
  }

  saveAdjustment() {
    const a = this.adjEdit();
    if (!a) return;
    const minutes = parseDuration(a.value);
    if (minutes == null || !a.date) {
      this.ui.show('Bitte Dauer als z. B. "+2:30" oder "-1:00" angeben');
      return;
    }
    this.store.saveAdjustment({ id: a.id, date: a.date, minutes, note: a.note.trim() || undefined });
    this.adjEdit.set(null);
  }

  deleteAdjustment() {
    const a = this.adjEdit();
    if (a) this.store.deleteAdjustment(a.id);
    this.adjEdit.set(null);
  }

  patchAdj(p: Partial<{ date: string; value: string; note: string }>) {
    const a = this.adjEdit();
    if (a) this.adjEdit.set({ ...a, ...p });
  }

  patchOffice(p: Partial<OfficeLocation>) {
    const o = this.officeEdit();
    if (o) this.officeEdit.set({ ...o, ...p });
  }

  newOffice() {
    this.officeEdit.set({ id: uid(), name: 'Büro', lat: 0, lon: 0, radius: 150 });
  }

  async useCurrentPosition() {
    try {
      const pos = await this.geo.position();
      this.patchOffice({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      this.ui.show(`Standort übernommen (±${Math.round(pos.coords.accuracy)} m)`);
    } catch {
      this.ui.show('Standort konnte nicht ermittelt werden');
    }
  }

  saveOffice() {
    const o = this.officeEdit();
    if (!o) return;
    if (!o.lat && !o.lon) {
      this.ui.show('Bitte Koordinaten angeben oder aktuellen Standort übernehmen');
      return;
    }
    const offices = this.s().offices.some((x) => x.id === o.id)
      ? this.s().offices.map((x) => (x.id === o.id ? o : x))
      : [...this.s().offices, o];
    this.update({ offices });
    this.officeEdit.set(null);
  }

  deleteOffice() {
    const o = this.officeEdit();
    if (o) this.update({ offices: this.s().offices.filter((x) => x.id !== o.id) });
    this.officeEdit.set(null);
  }

  async testLocation() {
    this.locTest.set(null);
    this.locTest.set(await this.geo.detectPlace());
  }

  async exportData() {
    const name = `stempeluhr-backup-${todayKey()}.json`;
    try {
      const r = await shareOrDownload(exportBackup(this.store.data()), name, 'application/json');
      this.ui.show(r === 'shared' ? 'Backup geteilt' : 'Backup gespeichert');
    } catch {
      /* abgebrochen */
    }
  }

  async importFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const result = parseBackup(JSON.parse(await file.text()));
      const label = result.format === 'stempeluhr-ios' ? 'Backup der bisherigen Stempeluhr-App' : 'Stempeluhr-Backup';
      const keepUni = result.format === 'stempeluhr-ios' && this.counts().uni > 0;
      const ok = await this.ui.confirm(
        `${label} importieren?`,
        `Gefunden: ${result.summary.join(', ')}. Vorhandene Arbeitsdaten werden ersetzt${keepUni ? ' (Uni-Zeiten bleiben erhalten)' : ''}.`,
        'Importieren',
      );
      if (!ok) return;
      if (keepUni) {
        result.data.entries.push(...this.store.data().entries.filter((e) => e.kind === 'uni'));
        result.data.settings = { ...result.data.settings, googleClientId: this.s().googleClientId, theme: this.s().theme };
      }
      this.store.replaceAll(result.data);
      this.ui.show('Import abgeschlossen');
    } catch (e) {
      this.ui.show(`Import fehlgeschlagen: ${(e as Error).message}`, undefined, 6000);
    }
  }

  async resetAll() {
    if (!(await this.ui.confirm('Alle Daten löschen?', 'Das kann nicht rückgängig gemacht werden. Vorher ein Backup exportieren!', 'Alles löschen', true)))
      return;
    this.store.replaceAll(emptyData());
    this.ui.show('Alle Daten gelöscht');
  }

  num(v: unknown, fallback = 0) {
    const n = Number(String(v).replace(',', '.'));
    return isNaN(n) ? fallback : n;
  }
}
