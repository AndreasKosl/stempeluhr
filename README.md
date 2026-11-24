# Stempeluhr

Persönliche Arbeitszeiterfassung als PWA (Angular 22, zoneless, Signals), optimiert für Google Pixel.

**Live:** https://andreaskosl.github.io/stempeluhr/ – jeder Push auf `main` wird automatisch per GitHub Actions veröffentlicht.
Alle Daten bleiben lokal im Browser (localStorage) – Backups als JSON exportieren.

## Funktionen

- **Heute**: Einstempeln / Pause / Weiter / Ausstempeln, Live-Ring mit Soll, Rest und voraussichtlichem Feierabend
- **Pausen-Button**: trägt mit einem Tipp die Pause 11:30–12:00 ein (Zeiten in den Einstellungen änderbar)
- **Arbeitsort automatisch**: beim Einstempeln per GPS – im Radius eines Büro-Standorts → Büro, sonst Homeoffice (manuell umschaltbar)
- **Übersicht**: Woche / Monat / Jahr mit Ist, Soll, Differenz, Büro- und Homeoffice-Tagen
- **Überstunden**: Saldo ab Beginn des ersten Arbeitsplans, plus manuelle Korrekturen
- **Arbeitsplan**: Sollstunden je Wochentag, mehrere Pläne mit „gültig ab“
- **Abwesenheiten**: Urlaub, Krankheit, Sonderurlaub, Feiertag, Überstundenabbau, halbe Tage; Urlaubskonto mit Übertrag;
  gesetzliche Feiertage werden pro Bundesland automatisch berechnet
- **Kalender**: einzelne Abwesenheit per Link in Google Kalender, alle als `.ics` teilen/exportieren (stabile UIDs),
  optional echte Synchronisation über die Google Calendar API (eigene OAuth-Client-ID nötig)
- **Uni**: eigene Lernzeit-Erfassung mit Fächern, komplett getrennt – keine Überstunden, kein Urlaub, zählt nie zur Arbeitszeit
- **Automatisch einstempeln** per Deep-Link, z. B. aus einem MacroDroid-Geofence (siehe unten)
- **Backup**: Export/Import eigener Backups und Import des JSON-Backups der bisherigen Stempeluhr-App

## Entwicklung

```powershell
npm install
npm start          # Dev-Server auf http://localhost:4200
npm run build      # Produktions-Build nach dist/stempeluhr/browser
```

Technik: Datum und Uhrzeit laufen komplett über die native **Temporal-API** (kein Polyfill, siehe `src/app/core/date-utils.ts`),
Icons kommen aus dem offiziellen Paket **@lucide/angular** – die Lizenzen aller gebündelten Pakete landen beim Build in
`3rdpartylicenses.txt` und sind in der App unter *Mehr → Open-Source-Lizenzen* verlinkt.

Es gibt bewusst keine Unit-Tests. Getestet wird per Playwright mit Pixel-Emulation (nutzt das installierte Chrome):

```powershell
node tools/test-import.mjs   # Backup importieren, alle Seiten als Screenshot (tools/shots)
node tools/test-flow.mjs     # Stempel-Ablauf mit simulierter Uhr
node tools/test-more.mjs     # Homeoffice-Erkennung, Backup-Roundtrip, .ics
node tools/test-pwa.mjs      # Service Worker + Offline (vorher: npm run build; node tools/serve-dist.mjs)
node tools/test-deeplink.mjs # Deep-Link #/stempeln/kommen|gehen
node tools/test-live.mjs     # veröffentlichte Seite inkl. Offline-Betrieb prüfen
```

## Auf das Handy bringen

Service Worker und GPS funktionieren nur über **HTTPS**. Den Inhalt von `dist/stempeluhr/browser` auf einen
statischen Host legen (GitHub Pages, Netlify, Cloudflare Pages …). Dank Hash-Routing (`/#/heute`) sind keine
Server-Rewrites nötig; für einen Unterpfad mit `npx ng build --base-href /stempeluhr/` bauen.
Dann in Chrome auf dem Pixel öffnen → Menü → „App installieren“. Anschließend unter *Mehr → Backup importieren*
die Datei `StempelUhrDataBackup….json` auswählen.

### Google-Kalender-Synchronisation (optional)

1. In der Google Cloud Console ein Projekt anlegen und die **Google Calendar API** aktivieren
2. OAuth-Zustimmungsbildschirm einrichten (Nutzertyp „Extern“, sich selbst als Testnutzer eintragen)
3. OAuth-Client-ID vom Typ **Webanwendung** erstellen, die App-URL als *autorisierten JavaScript-Ursprung* eintragen
4. Client-ID in der App unter *Mehr → Kalender* einfügen; danach in *Abwesenheiten → Sync-Symbol* synchronisieren

### Automatisch einstempeln (MacroDroid-Geofence)

Die App versteht zwei Deep-Links – praktisch für Automationen wie MacroDroid oder als App-Verknüpfung (langes Tippen aufs Icon):

| Link | Wirkung |
| --- | --- |
| `https://andreaskosl.github.io/stempeluhr/#/stempeln/kommen?ort=buero` | einstempeln mit Arbeitsort Büro (ohne GPS-Abfrage) |
| `…/#/stempeln/kommen` | einstempeln, Arbeitsort wie beim Button per GPS |
| `…/#/stempeln/gehen` | ausstempeln (beendet auch eine laufende Pause) |

Läuft schon eine Arbeitszeit, passiert beim erneuten „kommen“ nichts – doppelte Geofence-Auslöser sind also unkritisch.
Danach leitet die App ohne History-Eintrag auf *Heute* um.

MacroDroid-Makro: Auslöser *Geofence betreten* („Büro“), Bedingungen Mo–Fr und 05:00–13:00,
Aktion *Webseite öffnen* mit dem ersten Link, danach eine Bestätigungs-Benachrichtigung (Tippen öffnet den Link erneut).
Damit der Link in der installierten App statt im Browser-Tab landet, muss die PWA installiert sein.
