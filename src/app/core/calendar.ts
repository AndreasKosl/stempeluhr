import { Injectable, inject, signal } from '@angular/core';
import { addDays } from './date-utils';
import { ABSENCE_LABELS, Absence } from './models';
import { Store } from './store';

const compact = (k: string) => k.replaceAll('-', '');

export function absenceTitle(a: Absence): string {
  const base = a.type === 'feiertag' && a.note ? a.note : ABSENCE_LABELS[a.type];
  return a.halfDay ? `${base} (halber Tag)` : base;
}

/** Link, der direkt einen vorausgefüllten Termin in Google Kalender öffnet */
export function googleCalendarLink(a: Absence): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: absenceTitle(a),
    dates: `${compact(a.start)}/${compact(addDays(a.end, 1))}`,
    details: [a.type !== 'feiertag' ? a.note : '', 'Eingetragen mit Stempeluhr'].filter(Boolean).join('\n'),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** iCalendar-Datei; stabile UIDs sorgen dafür, dass ein erneuter Import Termine aktualisiert statt dupliziert. */
export function buildIcs(absences: Absence[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stempeluhr//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Abwesenheiten'];
  for (const a of absences) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${a.id}@stempeluhr`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${Math.floor(a.updatedAt / 1000) % 2_000_000_000}`,
      `DTSTART;VALUE=DATE:${compact(a.start)}`,
      `DTEND;VALUE=DATE:${compact(addDays(a.end, 1))}`,
      `SUMMARY:${esc(absenceTitle(a))}`,
      ...(a.note && a.type !== 'feiertag' ? [`DESCRIPTION:${esc(a.note)}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Datei teilen (Android-Share-Sheet) oder herunterladen */
export async function shareOrDownload(content: string, filename: string, mime: string): Promise<'shared' | 'downloaded'> {
  const file = new File([content], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

// ---- Google Calendar API (optional, benötigt eigene OAuth-Client-ID) ----

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken(o?: { prompt?: string }): void;
}
declare const google: {
  accounts: {
    oauth2: {
      initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: unknown) => void }): TokenClient;
    };
  };
};

@Injectable({ providedIn: 'root' })
export class GoogleCalendarSync {
  private store = inject(Store);
  private token: { value: string; exp: number } | null = null;
  readonly busy = signal(false);

  private loadScript(): Promise<void> {
    if (typeof google !== 'undefined') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Google-Anmeldung konnte nicht geladen werden (offline?)'));
      document.head.appendChild(s);
    });
  }

  private async accessToken(clientId: string): Promise<string> {
    if (this.token && this.token.exp > Date.now() + 60_000) return this.token.value;
    await this.loadScript();
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: (r) => {
          if (r.error || !r.access_token) return reject(new Error(r.error ?? 'Keine Berechtigung erhalten'));
          this.token = { value: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 };
          resolve(r.access_token);
        },
        error_callback: (e) => reject(new Error((e as { message?: string })?.message ?? 'Anmeldung abgebrochen')),
      });
      client.requestAccessToken({ prompt: '' });
    });
  }

  /** Legt neue Abwesenheiten an, aktualisiert geänderte und löscht entfernte. */
  async sync(): Promise<{ created: number; updated: number; deleted: number }> {
    const d = this.store.data();
    const { googleClientId, googleCalendarId, calendarIncludeHolidays } = d.settings;
    if (!googleClientId) throw new Error('Bitte zuerst eine Google OAuth-Client-ID hinterlegen');
    this.busy.set(true);
    try {
      const token = await this.accessToken(googleClientId);
      const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId || 'primary')}/events`;
      const call = async (method: string, url: string, body?: unknown) => {
        const r = await fetch(url, {
          method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!r.ok && !(method === 'DELETE' && (r.status === 404 || r.status === 410))) {
          const err = new Error(`Google API ${r.status}`) as Error & { status: number };
          err.status = r.status;
          throw err;
        }
        return r.status === 204 || method === 'DELETE' ? null : r.json();
      };
      const synced = new Map<string, string>();
      let created = 0;
      let updated = 0;
      for (const a of d.absences) {
        if (a.type === 'feiertag' && !calendarIncludeHolidays) continue;
        if (a.googleEventId && a.googleSyncedAt && a.googleSyncedAt >= a.updatedAt) continue;
        const body = {
          summary: absenceTitle(a),
          description: [a.type !== 'feiertag' ? a.note : '', 'Eingetragen mit Stempeluhr'].filter(Boolean).join('\n'),
          start: { date: a.start },
          end: { date: addDays(a.end, 1) },
          transparency: 'transparent',
          extendedProperties: { private: { stempeluhrId: a.id } },
        };
        if (a.googleEventId) {
          try {
            await call('PUT', `${base}/${a.googleEventId}`, body);
            synced.set(a.id, a.googleEventId);
            updated++;
            continue;
          } catch (e) {
            if (![404, 410].includes((e as { status?: number }).status ?? 0)) throw e;
          }
        }
        const ev = (await call('POST', base, body)) as { id: string };
        synced.set(a.id, ev.id);
        created++;
      }
      const deleted: string[] = [];
      for (const id of d.pendingCalendarDeletes) {
        await call('DELETE', `${base}/${id}`);
        deleted.push(id);
      }
      this.store.markAbsencesSynced(synced, deleted);
      return { created, updated, deleted: deleted.length };
    } finally {
      this.busy.set(false);
    }
  }
}
