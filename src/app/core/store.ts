import { Injectable, effect, signal } from '@angular/core';
import {
  Absence,
  AppData,
  OvertimeAdjustment,
  Settings,
  TimeEntry,
  WorkPlan,
  defaultSettings,
  emptyData,
  uid,
} from './models';

const KEY = 'stempeluhr.data.v1';

/** Zentraler Zustand. Alles liegt lokal im Browser (localStorage). */
@Injectable({ providedIn: 'root' })
export class Store {
  readonly data = signal<AppData>(this.load());

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data()));
      } catch (e) {
        console.error('Speichern fehlgeschlagen', e);
      }
    });
    // Synchronisation zwischen mehreren offenen Tabs
    window.addEventListener('storage', (ev) => {
      if (ev.key === KEY && ev.newValue) this.data.set(normalize(JSON.parse(ev.newValue)));
    });
    navigator.storage?.persist?.().catch(() => undefined);
  }

  private load(): AppData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {
      console.error('Laden fehlgeschlagen', e);
    }
    return emptyData();
  }

  replaceAll(data: AppData) {
    this.data.set(normalize(data));
  }

  private patch(fn: (d: AppData) => Partial<AppData>) {
    this.data.update((d) => ({ ...d, ...fn(d) }));
  }

  // --- Zeiteinträge ---
  addEntry(e: Omit<TimeEntry, 'id'>): TimeEntry {
    const entry: TimeEntry = { ...e, id: uid(), updatedAt: Date.now() };
    this.patch((d) => ({ entries: [...d.entries, entry] }));
    return entry;
  }

  updateEntry(id: string, changes: Partial<TimeEntry>) {
    this.patch((d) => ({
      entries: d.entries.map((e) => (e.id === id ? { ...e, ...changes, updatedAt: Date.now() } : e)),
    }));
  }

  deleteEntry(id: string) {
    this.patch((d) => ({ entries: d.entries.filter((e) => e.id !== id) }));
  }

  // --- Abwesenheiten ---
  saveAbsence(a: Omit<Absence, 'id' | 'updatedAt'> & { id?: string }) {
    const now = Date.now();
    this.patch((d) => {
      if (a.id && d.absences.some((x) => x.id === a.id)) {
        return { absences: d.absences.map((x) => (x.id === a.id ? { ...x, ...a, id: x.id, updatedAt: now } : x)) };
      }
      return { absences: [...d.absences, { ...a, id: uid(), updatedAt: now }] };
    });
  }

  deleteAbsence(id: string) {
    this.patch((d) => {
      const a = d.absences.find((x) => x.id === id);
      return {
        absences: d.absences.filter((x) => x.id !== id),
        pendingCalendarDeletes: a?.googleEventId
          ? [...d.pendingCalendarDeletes, a.googleEventId]
          : d.pendingCalendarDeletes,
      };
    });
  }

  markCalendarAdded(id: string) {
    const now = Date.now();
    this.patch((d) => ({ absences: d.absences.map((a) => (a.id === id ? { ...a, calendarAddedAt: now } : a)) }));
  }

  markAbsencesSynced(map: Map<string, string>, deletedIds: string[]) {
    const now = Date.now();
    this.patch((d) => ({
      absences: d.absences.map((a) =>
        map.has(a.id) ? { ...a, googleEventId: map.get(a.id), googleSyncedAt: now } : a,
      ),
      pendingCalendarDeletes: d.pendingCalendarDeletes.filter((x) => !deletedIds.includes(x)),
    }));
  }

  // --- Arbeitspläne ---
  savePlan(p: WorkPlan) {
    this.patch((d) => ({
      plans: d.plans.some((x) => x.id === p.id) ? d.plans.map((x) => (x.id === p.id ? p : x)) : [...d.plans, p],
    }));
  }

  deletePlan(id: string) {
    this.patch((d) => ({ plans: d.plans.filter((x) => x.id !== id) }));
  }

  // --- Überstunden-Korrekturen ---
  saveAdjustment(a: OvertimeAdjustment) {
    this.patch((d) => ({
      adjustments: d.adjustments.some((x) => x.id === a.id)
        ? d.adjustments.map((x) => (x.id === a.id ? a : x))
        : [...d.adjustments, a],
    }));
  }

  deleteAdjustment(id: string) {
    this.patch((d) => ({ adjustments: d.adjustments.filter((x) => x.id !== id) }));
  }

  // --- Einstellungen ---
  updateSettings(s: Partial<Settings>) {
    this.patch((d) => ({ settings: { ...d.settings, ...s } }));
  }
}

function normalize(d: Partial<AppData>): AppData {
  const base = emptyData();
  return {
    ...base,
    ...d,
    version: 1,
    entries: d.entries ?? [],
    absences: d.absences ?? [],
    plans: d.plans ?? [],
    adjustments: d.adjustments ?? [],
    pendingCalendarDeletes: d.pendingCalendarDeletes ?? [],
    settings: { ...defaultSettings(), ...(d.settings ?? {}) },
  };
}
