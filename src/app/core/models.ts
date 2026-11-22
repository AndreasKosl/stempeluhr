/** Art eines Zeiteintrags. `uni` wird komplett getrennt von der Arbeitszeit behandelt. */
export type EntryKind = 'work' | 'pause' | 'uni';
export type Place = 'buero' | 'homeoffice';

export interface TimeEntry {
  id: string;
  kind: EntryKind;
  /** Epoch-Millisekunden */
  start: number;
  /** Epoch-Millisekunden, `null` = läuft noch */
  end: number | null;
  /** Nur für Arbeit: automatisch per Standort ermittelt oder manuell gesetzt */
  place?: Place | null;
  /** true, wenn der Ort automatisch per GPS bestimmt wurde */
  placeAuto?: boolean;
  /** Notiz – bei Uni z. B. Fach/Modul */
  note?: string;
  updatedAt?: number;
}

export type AbsenceType = 'urlaub' | 'krank' | 'sonderurlaub' | 'feiertag' | 'abbau';

export interface Absence {
  id: string;
  type: AbsenceType;
  /** YYYY-MM-DD (inklusive) */
  start: string;
  /** YYYY-MM-DD (inklusive) */
  end: string;
  halfDay?: boolean;
  note?: string;
  updatedAt: number;
  /** Google-Kalender-Event-ID nach Synchronisation */
  googleEventId?: string;
  googleSyncedAt?: number;
  /** Zeitpunkt, zu dem der Termin per Link in den Kalender übernommen wurde */
  calendarAddedAt?: number;
}

/** Arbeitsplan, gültig ab `validFrom` bis zum nächsten Plan. */
export interface WorkPlan {
  id: string;
  validFrom: string;
  /** Sollstunden je Wochentag, Index 0 = Montag … 6 = Sonntag */
  hours: number[];
}

/** Manuelle Korrektur des Überstundensaldos (z. B. Startsaldo, Auszahlung). */
export interface OvertimeAdjustment {
  id: string;
  date: string;
  minutes: number;
  note?: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Radius in Metern */
  radius: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  /** Bundesland-Kürzel, z. B. NW */
  state: string;
  vacationDaysPerYear: number;
  vacationCarryOver: boolean;
  lunchStart: string;
  lunchEnd: string;
  offices: OfficeLocation[];
  autoLocation: boolean;
  defaultPlace: Place;
  googleClientId: string;
  googleCalendarId: string;
  calendarIncludeHolidays: boolean;
  theme: ThemeMode;
}

export interface AppData {
  version: 1;
  entries: TimeEntry[];
  absences: Absence[];
  plans: WorkPlan[];
  adjustments: OvertimeAdjustment[];
  settings: Settings;
  /** Gelöschte, bereits synchronisierte Kalendertermine – werden beim nächsten Sync entfernt */
  pendingCalendarDeletes: string[];
}

export const ABSENCE_LABELS: Record<AbsenceType, string> = {
  urlaub: 'Urlaub',
  krank: 'Krankheit',
  sonderurlaub: 'Sonderurlaub',
  feiertag: 'Feiertag',
  abbau: 'Überstundenabbau',
};

export const ABSENCE_ICONS: Record<AbsenceType, string> = {
  urlaub: 'beach',
  krank: 'sick',
  sonderurlaub: 'gift',
  feiertag: 'star',
  abbau: 'trending_down',
};

/** Abwesenheiten, die den Soll-Tag gutschreiben. Überstundenabbau schreibt nichts gut. */
export const ABSENCE_CREDITS: Record<AbsenceType, boolean> = {
  urlaub: true,
  krank: true,
  sonderurlaub: true,
  feiertag: true,
  abbau: false,
};

export const PLACE_LABELS: Record<Place, string> = {
  buero: 'Büro',
  homeoffice: 'Homeoffice',
};

export function defaultSettings(): Settings {
  return {
    state: 'NW',
    vacationDaysPerYear: 30,
    vacationCarryOver: true,
    lunchStart: '11:30',
    lunchEnd: '12:00',
    offices: [],
    autoLocation: true,
    defaultPlace: 'homeoffice',
    googleClientId: '',
    googleCalendarId: 'primary',
    calendarIncludeHolidays: false,
    theme: 'system',
  };
}

export function emptyData(): AppData {
  return {
    version: 1,
    entries: [],
    absences: [],
    plans: [],
    adjustments: [],
    settings: defaultSettings(),
    pendingCalendarDeletes: [],
  };
}

export function uid(): string {
  return crypto.randomUUID();
}
