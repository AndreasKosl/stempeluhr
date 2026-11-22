export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Lokales Datum als YYYY-MM-DD */
export function dateKey(d: Date | number): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function todayKey(): string {
  return dateKey(Date.now());
}

export function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k: string, n: number): string {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function addMonths(k: string, n: number): string {
  const d = parseKey(k);
  return dateKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** 0 = Montag … 6 = Sonntag */
export function weekdayIdx(k: string): number {
  return (parseKey(k).getDay() + 6) % 7;
}

export function startOfWeek(k: string): string {
  return addDays(k, -weekdayIdx(k));
}

export function startOfMonth(k: string): string {
  return k.slice(0, 8) + '01';
}

export function endOfMonth(k: string): string {
  const d = parseKey(k);
  return dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Alle Tage von a bis b (inklusive) */
export function eachDay(a: string, b: string): string[] {
  const out: string[] = [];
  for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
  return out;
}

/** ISO-Kalenderwoche */
export function isoWeek(k: string): number {
  const d = parseKey(k);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Minuten → "7:05" bzw. "-0:15" / "+1:30" */
export function fmtDuration(min: number, withSign = false): string {
  const neg = min < 0;
  const abs = Math.round(Math.abs(min));
  const s = `${Math.floor(abs / 60)}:${pad(abs % 60)}`;
  if (neg) return '−' + s;
  return withSign && abs > 0 ? '+' + s : s;
}

/** Millisekunden → "7:05:12" */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Datum + "HH:MM" → Epoch-ms (lokal) */
export function timeToTs(k: string, hhmm: string): number {
  const d = parseKey(k);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const longFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const shortFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const monthShortFmt = new Intl.DateTimeFormat('de-DE', { month: 'short' });
const wdFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

export const fmtDateLong = (k: string) => longFmt.format(parseKey(k));
export const fmtDateShort = (k: string) => shortFmt.format(parseKey(k));
export const fmtDate = (k: string) => dateFmt.format(parseKey(k));
export const fmtMonth = (k: string) => monthFmt.format(parseKey(k));
export const fmtMonthShort = (k: string) => monthShortFmt.format(parseKey(k));
export const fmtWeekday = (k: string) => wdFmt.format(parseKey(k)).replace('.', '');

export function fmtRange(a: string, b: string): string {
  if (a === b) return fmtDate(a);
  return `${fmtDate(a).slice(0, 6)} – ${fmtDate(b)}`;
}

export function hoursToMin(h: number): number {
  return Math.round(h * 60);
}

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
