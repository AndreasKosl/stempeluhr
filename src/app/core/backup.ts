import { dateKey, fmtTime } from './date-utils';
import { holidaysFor } from './holidays';
import {
  Absence,
  AbsenceType,
  AppData,
  OfficeLocation,
  Place,
  TimeEntry,
  WorkPlan,
  defaultSettings,
  emptyData,
  uid,
} from './models';

export interface ImportResult {
  data: AppData;
  format: 'stempeluhr-pwa' | 'stempeluhr-ios';
  summary: string[];
}

/** Erkennt das Format und wandelt in AppData um. */
export function parseBackup(json: unknown): ImportResult {
  const o = json as Record<string, unknown>;
  if (o && o['app'] === 'stempeluhr-pwa' && o['data']) {
    const data = { ...emptyData(), ...(o['data'] as AppData) };
    return {
      data,
      format: 'stempeluhr-pwa',
      summary: [
        `${data.entries.length} Zeiteinträge`,
        `${data.absences.length} Abwesenheiten`,
        `${data.plans.length} Arbeitspläne`,
      ],
    };
  }
  if (o && Array.isArray(o['timers']) && Array.isArray(o['workPlans'])) return importLegacy(o as unknown as LegacyBackup);
  throw new Error('Unbekanntes Backup-Format');
}

export function exportBackup(data: AppData): string {
  return JSON.stringify({ app: 'stempeluhr-pwa', exportedAt: new Date().toISOString(), data }, null, 1);
}

// ---- Format der bisherigen Stempeluhr-App (iOS) ----

interface LegacyBackup {
  timers: {
    startDate: string;
    endDate: string | null;
    type: 'timer' | 'pause' | string;
    locationId?: string | null;
    jobId?: string;
    comment?: string | null;
  }[];
  workPlans: {
    start: string;
    end: string | null;
    jobId: string;
    type: string;
    hours: number;
    dayCount: number;
    days: { weekday: string; hours: number }[];
    pauses?: { suggestedStart: string; pauseInHours: number }[];
  }[];
  absences: {
    start: string;
    end: string;
    type: string;
    name: string | null;
    auto: boolean;
    isUTC: boolean;
    jobId?: string;
  }[];
  absenceTypes?: { label: string; isSickDay: boolean; isHoliday: boolean; fullDay: boolean }[];
  locations?: { exportId: string; name: string; latitude: number | null; longitude: number | null; radius: number; isDefault: boolean }[];
  contingents?: { absenceTypeName: string; amount: number }[];
  preferences?: { key: string; value: string; jobId: string | null }[];
  overtimes?: { date?: string; start?: string; hours?: number; minutes?: number; value?: number; comment?: string }[];
  jobs?: { exportId: string; isActive: boolean }[];
}

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function importLegacy(b: LegacyBackup): ImportResult {
  const data = emptyData();
  const settings = defaultSettings();
  const summary: string[] = [];

  const jobId = b.jobs?.find((j) => j.isActive)?.exportId ?? b.workPlans[0]?.jobId;
  const sameJob = (x: { jobId?: string | null }) => !jobId || !x.jobId || x.jobId === jobId;

  // Bundesland
  const statePref = b.preferences?.find((p) => p.key === 'state');
  if (statePref) {
    try {
      const v = JSON.parse(statePref.value) as string;
      const code = v.split('-')[1];
      if (code) settings.state = code;
    } catch {
      /* ignorieren */
    }
  }

  // Orte: Orte mit Koordinaten = Büro, ohne Koordinaten / "Home" = Homeoffice
  const placeById = new Map<string, Place>();
  for (const l of b.locations ?? []) {
    const isHome = l.latitude == null || /home/i.test(l.name);
    placeById.set(l.exportId, isHome ? 'homeoffice' : 'buero');
    if (!isHome && l.latitude != null && l.longitude != null) {
      settings.offices.push({
        id: uid(),
        name: l.name,
        lat: l.latitude,
        lon: l.longitude,
        radius: Math.max(50, Math.round(l.radius || 100)),
      } satisfies OfficeLocation);
    }
  }

  // Zeiteinträge
  for (const t of b.timers) {
    if (!sameJob(t)) continue;
    const kind = t.type === 'pause' ? 'pause' : 'work';
    const entry: TimeEntry = {
      id: uid(),
      kind,
      start: Date.parse(t.startDate),
      end: t.endDate ? Date.parse(t.endDate) : null,
      place: kind === 'work' ? (t.locationId ? (placeById.get(t.locationId) ?? null) : null) : undefined,
      note: t.comment ?? undefined,
      updatedAt: Date.now(),
    };
    if (isNaN(entry.start)) continue;
    data.entries.push(entry);
  }
  summary.push(`${data.entries.filter((e) => e.kind === 'work').length} Arbeitsblöcke, ${data.entries.filter((e) => e.kind === 'pause').length} Pausen`);

  // Arbeitspläne
  for (const p of b.workPlans) {
    if (!sameJob(p)) continue;
    const hours = [0, 0, 0, 0, 0, 0, 0];
    if (p.days?.length) {
      for (const d of p.days) {
        const i = WEEKDAYS.indexOf(d.weekday);
        if (i >= 0) hours[i] = d.hours;
      }
    } else {
      const per = p.hours / (p.dayCount || 5);
      for (let i = 0; i < Math.min(p.dayCount || 5, 7); i++) hours[i] = per;
    }
    data.plans.push({ id: uid(), validFrom: dateKey(Date.parse(p.start)), hours } satisfies WorkPlan);
    const pause = p.pauses?.[0];
    if (pause?.suggestedStart && pause.pauseInHours > 0) {
      const s = Date.parse(pause.suggestedStart);
      settings.lunchStart = fmtTime(s);
      settings.lunchEnd = fmtTime(s + pause.pauseInHours * 3_600_000);
    }
  }
  summary.push(`${data.plans.length} Arbeitsplan`);

  // Abwesenheiten
  const typeInfo = new Map((b.absenceTypes ?? []).map((t) => [t.label, t]));
  const mapType = (label: string): AbsenceType => {
    const l = label.toLowerCase();
    if (l.includes('urlaub') && l.includes('sonder')) return 'sonderurlaub';
    if (l.includes('urlaub')) return 'urlaub';
    if (l.includes('krank')) return 'krank';
    if (l.includes('feiertag')) return 'feiertag';
    if (l.includes('abbau')) return 'abbau';
    const info = typeInfo.get(label);
    if (info?.isSickDay) return 'krank';
    if (info?.isHoliday) return 'feiertag';
    return 'sonderurlaub';
  };
  const toKey = (iso: string, utc: boolean) => (utc ? iso.slice(0, 10) : dateKey(Date.parse(iso)));
  const legalCache = new Map<number, Map<string, string>>();
  const isLegal = (k: string) => {
    const y = Number(k.slice(0, 4));
    if (!legalCache.has(y)) legalCache.set(y, holidaysFor(y, settings.state));
    return legalCache.get(y)!.has(k);
  };
  let skipped = 0;
  for (const a of b.absences) {
    if (!sameJob(a)) continue;
    const type = mapType(a.type);
    const start = toKey(a.start, a.isUTC);
    const end = toKey(a.end, a.isUTC);
    // Automatisch importierte gesetzliche Feiertage werden von der App selbst berechnet
    if (type === 'feiertag' && a.auto && start === end && isLegal(start)) {
      skipped++;
      continue;
    }
    data.absences.push({
      id: uid(),
      type,
      start,
      end: end < start ? start : end,
      note: a.name ?? (type === 'feiertag' ? holidayName(start) : undefined),
      updatedAt: Date.now(),
    } satisfies Absence);
  }
  summary.push(`${data.absences.length} Abwesenheiten (${skipped} gesetzliche Feiertage werden automatisch berechnet)`);

  // Urlaubskontingent
  const cont = b.contingents?.find((c) => /urlaub/i.test(c.absenceTypeName));
  if (cont?.amount) settings.vacationDaysPerYear = cont.amount;

  // Überstunden-Korrekturen (Format unbekannt → best effort)
  for (const o of b.overtimes ?? []) {
    const date = o.date ?? o.start;
    const minutes = o.minutes ?? (o.hours != null ? o.hours * 60 : o.value != null ? o.value * 60 : null);
    if (!date || minutes == null) continue;
    data.adjustments.push({ id: uid(), date: dateKey(Date.parse(date)), minutes: Math.round(minutes), note: o.comment ?? 'Import' });
  }

  data.settings = settings;
  return { data, format: 'stempeluhr-ios', summary };
}

function holidayName(k: string): string {
  const md = k.slice(5);
  if (md === '12-24') return 'Heiligabend';
  if (md === '12-31') return 'Silvester';
  return 'Feiertag';
}
