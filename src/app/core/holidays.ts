import { addDays, keyOf } from './date-utils';

export const STATES: { code: string; name: string }[] = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
];

/** Ostersonntag (Gauß / anonymer gregorianischer Algorithmus) */
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return keyOf(year, month, day);
}

const fixed = keyOf;

/** Gesetzliche Feiertage für ein Jahr und Bundesland → Map Datum → Name */
export function holidaysFor(year: number, state: string): Map<string, string> {
  const e = easter(year);
  const s = (...codes: string[]) => codes.includes(state);
  const list: [string, string, boolean][] = [
    [fixed(year, 1, 1), 'Neujahr', true],
    [fixed(year, 1, 6), 'Heilige Drei Könige', s('BW', 'BY', 'ST')],
    [fixed(year, 3, 8), 'Internationaler Frauentag', (s('BE') && year >= 2019) || (s('MV') && year >= 2023)],
    [addDays(e, -2), 'Karfreitag', true],
    [addDays(e, 1), 'Ostermontag', true],
    [fixed(year, 5, 1), 'Tag der Arbeit', true],
    [addDays(e, 39), 'Christi Himmelfahrt', true],
    [addDays(e, 50), 'Pfingstmontag', true],
    [addDays(e, 60), 'Fronleichnam', s('BW', 'BY', 'HE', 'NW', 'RP', 'SL')],
    [fixed(year, 8, 15), 'Mariä Himmelfahrt', s('SL')],
    [fixed(year, 9, 20), 'Weltkindertag', s('TH') && year >= 2019],
    [fixed(year, 10, 3), 'Tag der Deutschen Einheit', true],
    [fixed(year, 10, 31), 'Reformationstag', s('BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH')],
    [fixed(year, 11, 1), 'Allerheiligen', s('BW', 'BY', 'NW', 'RP', 'SL')],
    [bussUndBettag(year), 'Buß- und Bettag', s('SN')],
    [fixed(year, 12, 25), '1. Weihnachtsfeiertag', true],
    [fixed(year, 12, 26), '2. Weihnachtsfeiertag', true],
  ];
  const map = new Map<string, string>();
  for (const [k, name, ok] of list) if (ok) map.set(k, name);
  return map;
}

/** Mittwoch vor dem 23. November */
function bussUndBettag(year: number): string {
  let d = Temporal.PlainDate.from({ year, month: 11, day: 22 });
  while (d.dayOfWeek !== 3) d = d.subtract({ days: 1 });
  return d.toString();
}
