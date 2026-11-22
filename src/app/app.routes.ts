import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'heute' },
  { path: 'heute', title: 'Stempeluhr', loadComponent: () => import('./pages/heute').then((m) => m.HeutePage) },
  { path: 'uebersicht', title: 'Übersicht · Stempeluhr', loadComponent: () => import('./pages/uebersicht').then((m) => m.UebersichtPage) },
  { path: 'tag/:key', title: 'Tag · Stempeluhr', loadComponent: () => import('./pages/tag').then((m) => m.TagPage) },
  { path: 'abwesenheiten', title: 'Abwesenheiten · Stempeluhr', loadComponent: () => import('./pages/abwesenheiten').then((m) => m.AbwesenheitenPage) },
  { path: 'uni', title: 'Uni · Stempeluhr', loadComponent: () => import('./pages/uni').then((m) => m.UniPage) },
  { path: 'einstellungen', title: 'Einstellungen · Stempeluhr', loadComponent: () => import('./pages/einstellungen').then((m) => m.EinstellungenPage) },
  { path: '**', redirectTo: 'heute' },
];
