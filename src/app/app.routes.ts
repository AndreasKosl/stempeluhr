import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, Routes } from '@angular/router';
import { Place } from './core/models';
import { Tracking } from './core/tracking';

/**
 * Deep-Link für Automationen (z. B. MacroDroid-Geofence):
 * `#/stempeln/kommen?ort=buero` stempelt ein, `#/stempeln/gehen` stempelt aus.
 * Bereits laufende Einträge bleiben unverändert; danach wird (ohne History-Eintrag) auf „Heute“ umgeleitet,
 * damit ein erneutes Öffnen der zuletzt besuchten URL nicht noch einmal stempelt.
 */
function stempeln(route: ActivatedRouteSnapshot) {
  const track = inject(Tracking);
  const ort = route.queryParamMap.get('ort');
  const place: Place | undefined = ort === 'buero' || ort === 'homeoffice' ? ort : undefined;
  const aktion = route.paramMap.get('aktion');
  if (aktion === 'kommen') void track.startWork(place);
  else if (aktion === 'gehen') track.stop();
  return inject(Router).parseUrl('/heute');
}


export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'heute' },
  { path: 'heute', title: 'Stempeluhr', loadComponent: () => import('./pages/heute').then((m) => m.HeutePage) },
  { path: 'stempeln/:aktion', children: [], canActivate: [stempeln] },
  { path: 'uebersicht', title: 'Übersicht · Stempeluhr', loadComponent: () => import('./pages/uebersicht').then((m) => m.UebersichtPage) },
  { path: 'tag/:key', title: 'Tag · Stempeluhr', loadComponent: () => import('./pages/tag').then((m) => m.TagPage) },
  { path: 'abwesenheiten', title: 'Abwesenheiten · Stempeluhr', loadComponent: () => import('./pages/abwesenheiten').then((m) => m.AbwesenheitenPage) },
  { path: 'uni', title: 'Uni · Stempeluhr', loadComponent: () => import('./pages/uni').then((m) => m.UniPage) },
  { path: 'einstellungen', title: 'Einstellungen · Stempeluhr', loadComponent: () => import('./pages/einstellungen').then((m) => m.EinstellungenPage) },
  { path: '**', redirectTo: 'heute' },
];
