/**
 * Datums- und Zeitfunktionen auf Basis der nativen Temporal-API (kein Polyfill).
 *
 * Konventionen in der App:
 * - Kalendertage werden als ISO-String `YYYY-MM-DD` gespeichert (= `Temporal.PlainDate.toString()`).
 * - Zeitpunkte von Einträgen werden als Epoch-Millisekunden gespeichert (= `Temporal.Instant.epochMilliseconds`).
 * - Umrechnung zwischen beiden erfolgt immer in der Zeitzone des Geräts.
 */

const LOCALE = 'de-DE';

/** Millisekunden pro Minute (für Dauer-Arithmetik auf Epoch-ms) */
export const MINUTE = 60_000;

/** Zeitzone des Geräts, z. B. "Europe/Berlin" */
export const timeZone = (): string => Temporal.Now.timeZoneId();

/** Aktueller Zeitpunkt in Epoch-Millisekunden */
export const nowMs = (): number => Temporal.Now.instant().epochMilliseconds;

/** Aktueller Zeitpunkt, auf volle Minuten abgerundet (Sekunden werden beim Stempeln ignoriert) */
export const nowMinute = (): number =>
  Temporal.Now.zonedDateTimeISO().round({ smallestUnit: 'minute', roundingMode: 'floor' }).epochMilliseconds;

export const plainDate = (k: string): Temporal.PlainDate => Temporal.PlainDate.from(k);

/** Epoch-ms → Zeitpunkt in der Gerätezeitzone */
export const zoned = (ms: number): Temporal.ZonedDateTime =>
  Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(timeZone());

/** ISO-Zeitstempel (z. B. "2025-01-02T07:53:00.000Z") → Epoch-ms */
export const isoToMs = (iso: string): number => Temporal.Instant.from(iso).epochMilliseconds;

/** Lokaler Kalendertag eines Zeitpunkts als YYYY-MM-DD */
export const dateKey = (ms: number): string => zoned(ms).toPlainDate().toString();

/** Kalendertag eines ISO-Zeitstempels in UTC (für Ganztagesdaten aus Fremd-Backups) */
export const utcDateKey = (iso: string): string => Temporal.Instant.from(iso).toZonedDateTimeISO('UTC').toPlainDate().toString();

export const todayKey = (): string => Temporal.Now.plainDateISO().toString();

export const currentYear = (): number => Temporal.Now.plainDateISO().year;

export const keyOf = (year: number, month: number, day: number): string =>
  Temporal.PlainDate.from({ year, month, day }).toString();

export const addDays = (k: string, days: number): string => plainDate(k).add({ days }).toString();

/** Erster Tag des um n Monate verschobenen Monats */
export const addMonths = (k: string, months: number): string => plainDate(k).with({ day: 1 }).add({ months }).toString();

/** 0 = Montag … 6 = Sonntag */
export const weekdayIdx = (k: string): number => plainDate(k).dayOfWeek - 1;

export const startOfWeek = (k: string): string => addDays(k, -weekdayIdx(k));

export const startOfMonth = (k: string): string => plainDate(k).with({ day: 1 }).toString();

export const endOfMonth = (k: string): string => {
  const d = plainDate(k);
  return d.with({ day: d.daysInMonth }).toString();
};

/** Alle Tage von a bis b (inklusive) */
export function eachDay(a: string, b: string): string[] {
  const out: string[] = [];
  const end = plainDate(b);
  for (let d = plainDate(a); Temporal.PlainDate.compare(d, end) <= 0; d = d.add({ days: 1 })) out.push(d.toString());
  return out;
}

/** ISO-Kalenderwoche */
export const isoWeek = (k: string): number => plainDate(k).weekOfYear ?? 0;

/** Datum + "HH:MM" → Epoch-ms (Gerätezeitzone, sommerzeitsicher) */
export const timeToTs = (k: string, hhmm: string): number =>
  plainDate(k).toZonedDateTime({ timeZone: timeZone(), plainTime: Temporal.PlainTime.from(hhmm) }).epochMilliseconds;

/** Epoch-ms → "08:15" */
export const fmtTime = (ms: number): string => zoned(ms).toPlainTime().toString({ smallestUnit: 'minute' });

const pad = (n: number) => String(n).padStart(2, '0');

/** Minuten → "7:05" bzw. "−0:15" / "+1:30" */
export function fmtDuration(min: number, withSign = false): string {
  const neg = min < 0;
  const abs = Math.round(Math.abs(min));
  const s = `${Math.floor(abs / 60)}:${pad(abs % 60)}`;
  if (neg) return '−' + s;
  return withSign && abs > 0 ? '+' + s : s;
}

/** Millisekunden → "7:05:12" */
export function fmtClock(ms: number): string {
  const d = Temporal.Duration.from({ milliseconds: Math.max(0, Math.floor(ms)) }).round({
    largestUnit: 'hour',
    smallestUnit: 'second',
    roundingMode: 'trunc',
  });
  return `${d.hours}:${pad(d.minutes)}:${pad(d.seconds)}`;
}

const fmt = (k: string, o: Intl.DateTimeFormatOptions) => plainDate(k).toLocaleString(LOCALE, o);

export const fmtDateLong = (k: string) => fmt(k, { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtDateShort = (k: string) => fmt(k, { weekday: 'short', day: '2-digit', month: '2-digit' });
export const fmtDate = (k: string) => fmt(k, { day: '2-digit', month: '2-digit', year: 'numeric' });
export const fmtMonth = (k: string) => fmt(k, { month: 'long', year: 'numeric' });
export const fmtMonthShort = (k: string) => fmt(k, { month: 'short' });
export const fmtWeekday = (k: string) => fmt(k, { weekday: 'short' }).replace('.', '');

export function fmtRange(a: string, b: string): string {
  if (a === b) return fmtDate(a);
  return `${fmtDate(a).slice(0, 6)} – ${fmtDate(b)}`;
}

/** iCalendar-Zeitstempel in UTC, z. B. "20261122T204655Z" */
export const icsStamp = (): string =>
  Temporal.Now.instant().toString({ smallestUnit: 'second' }).replace(/[-:]/g, '');

export const hoursToMin = (h: number): number => Math.round(h * 60);

/** "1:30" / "-0:45" / "1,5" → Minuten */
export function parseDuration(s: string): number | null {
  const t = s.trim().replace('−', '-');
  if (!t) return null;
  const neg = t.startsWith('-');
  const body = t.replace(/^[+-]/, '');
  let min: number;
  if (body.includes(':')) {
    const [h, m] = body.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    min = h * 60 + m;
  } else {
    const h = Number(body.replace(',', '.'));
    if (isNaN(h)) return null;
    min = Math.round(h * 60);
  }
  return neg ? -min : min;
}
