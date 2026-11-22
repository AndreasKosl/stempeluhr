import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import {
  LucideArrowLeft,
  LucideBuilding,
  LucideCalendarDays,
  LucideCalendarPlus,
  LucideChartColumn,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideDownload,
  LucideDynamicIcon,
  LucideFileText,
  LucideGift,
  LucideGraduationCap,
  LucideHouse,
  LucideIcon,
  LucideInfo,
  LucideLocateFixed,
  LucideMapPin,
  LucidePause,
  LucidePencil,
  LucidePlay,
  LucidePlus,
  LucideRefreshCw,
  LucideSettings,
  LucideShare2,
  LucideSquare,
  LucideStar,
  LucideThermometer,
  LucideTimer,
  LucideTrash,
  LucideTreePalm,
  LucideTrendingDown,
  LucideTriangleExclamationPoint,
  LucideUpload,
  LucideUtensils,
} from '@lucide/angular';

/**
 * Lucide-Icons (ISC-Lizenz) aus dem offiziellen Paket @lucide/angular.
 * Nur die hier importierten Icons landen im Build.
 */
const ICONS: Record<string, LucideIcon> = {
  add: LucidePlus,
  back: LucideArrowLeft,
  beach: LucideTreePalm,
  calendar_add: LucideCalendarPlus,
  chart: LucideChartColumn,
  check: LucideCheck,
  chevron_left: LucideChevronLeft,
  chevron_right: LucideChevronRight,
  delete: LucideTrash,
  download: LucideDownload,
  edit: LucidePencil,
  event: LucideCalendarDays,
  gift: LucideGift,
  home: LucideHouse,
  info: LucideInfo,
  location: LucideMapPin,
  lunch: LucideUtensils,
  my_location: LucideLocateFixed,
  office: LucideBuilding,
  pause: LucidePause,
  plan: LucideFileText,
  play: LucidePlay,
  school: LucideGraduationCap,
  settings: LucideSettings,
  share: LucideShare2,
  sick: LucideThermometer,
  star: LucideStar,
  stop: LucideSquare,
  sync: LucideRefreshCw,
  timer: LucideTimer,
  trending_down: LucideTrendingDown,
  upload: LucideUpload,
  warning: LucideTriangleExclamationPoint,
};

/** Steuer-Icons werden ausgefüllt dargestellt */
const SOLID = new Set(['play', 'pause', 'stop']);

@Component({
  selector: 'app-icon',
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.solid]': 'solid()' },
  template: `<svg [lucideIcon]="icon()" [size]="size()" [strokeWidth]="fill() ? 2.5 : 2"></svg>`,
  // Ohne Kapselung: die SVG-Kindelemente rendert die Lucide-Komponente, gekapselte Styles erreichen sie nicht.
  encapsulation: ViewEncapsulation.None,
  styles: `
    app-icon {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
    app-icon.solid svg :is(path, rect, polygon) {
      fill: currentColor;
    }
  `,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(24);
  /** Hervorgehoben (aktiver Navigations-Tab, Avatare) – Lucide hat keine gefüllten Varianten, daher kräftigere Linie */
  readonly fill = input(false);

  protected readonly icon = computed(() => ICONS[this.name()] ?? LucideInfo);
  protected readonly solid = computed(() => SOLID.has(this.name()));
}
