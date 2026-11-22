import { Pipe, PipeTransform } from '@angular/core';
import { fmtDate, fmtDateLong, fmtDateShort, fmtDuration, fmtTime, fmtWeekday } from '../core/date-utils';

/** Minuten → "7:05" */
@Pipe({ name: 'dur' })
export class DurPipe implements PipeTransform {
  transform(min: number | null | undefined, sign = false): string {
    return min == null ? '–' : fmtDuration(min, sign);
  }
}

/** Epoch-ms → "08:15" */
@Pipe({ name: 'hm' })
export class HmPipe implements PipeTransform {
  transform(ts: number | null | undefined): string {
    return ts == null ? '…' : fmtTime(ts);
  }
}

/** YYYY-MM-DD → formatiertes Datum */
@Pipe({ name: 'day' })
export class DayPipe implements PipeTransform {
  transform(k: string | null | undefined, style: 'long' | 'short' | 'date' | 'wd' = 'date'): string {
    if (!k) return '';
    if (style === 'long') return fmtDateLong(k);
    if (style === 'short') return fmtDateShort(k);
    if (style === 'wd') return fmtWeekday(k);
    return fmtDate(k);
  }
}

/** Zahl mit deutschem Komma, ohne unnötige Nachkommastellen */
@Pipe({ name: 'num' })
export class NumPipe implements PipeTransform {
  transform(n: number | null | undefined): string {
    return n == null ? '–' : n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  }
}

export const PIPES = [DurPipe, HmPipe, DayPipe, NumPipe] as const;
