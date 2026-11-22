import { Injectable, inject, signal } from '@angular/core';
import { OfficeLocation, Place } from './models';
import { Store } from './store';

export interface PlaceResult {
  place: Place;
  office?: OfficeLocation;
  distance?: number;
  accuracy?: number;
  /** false, wenn kein Standort ermittelt werden konnte und der Standard verwendet wurde */
  located: boolean;
  error?: string;
}

/** Entfernung in Metern (Haversine) */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

@Injectable({ providedIn: 'root' })
export class Geo {
  private store = inject(Store);
  readonly busy = signal(false);

  position(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject(new Error('Standort wird nicht unterstützt'));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 60_000,
      });
    });
  }

  /** Bestimmt Büro/Homeoffice anhand der Entfernung zu den hinterlegten Büro-Standorten. */
  async detectPlace(): Promise<PlaceResult> {
    const s = this.store.data().settings;
    const fallback: PlaceResult = { place: s.defaultPlace, located: false };
    if (!s.offices.length) return { ...fallback, error: 'Kein Büro-Standort hinterlegt' };
    this.busy.set(true);
    try {
      const pos = await this.position();
      const { latitude, longitude, accuracy } = pos.coords;
      let best: { office: OfficeLocation; distance: number } | null = null;
      for (const o of s.offices) {
        const d = distanceM(latitude, longitude, o.lat, o.lon);
        if (!best || d < best.distance) best = { office: o, distance: d };
      }
      // Ungenauigkeit (bis 100 m) wird zugunsten des Büros berücksichtigt
      const inOffice = !!best && best.distance - Math.min(accuracy, 100) <= best.office.radius;
      return {
        place: inOffice ? 'buero' : 'homeoffice',
        office: best?.office,
        distance: best?.distance,
        accuracy,
        located: true,
      };
    } catch (e) {
      const err = e as GeolocationPositionError;
      const msg =
        err?.code === 1 ? 'Standortzugriff verweigert' : err?.code === 3 ? 'Standort-Timeout' : 'Standort nicht verfügbar';
      return { ...fallback, error: msg };
    } finally {
      this.busy.set(false);
    }
  }
}
