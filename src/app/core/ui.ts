import { Injectable, signal } from '@angular/core';
import { nowMs } from './date-utils';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export interface ConfirmRequest {
  title: string;
  text?: string;
  ok: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}

/** Snackbar + Bestätigungsdialog */
@Injectable({ providedIn: 'root' })
export class Ui {
  readonly toast = signal<Toast | null>(null);
  readonly confirmReq = signal<ConfirmRequest | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, action?: Toast['action'], ms = 4000) {
    clearTimeout(this.timer);
    const t = { id: nowMs(), text, action };
    this.toast.set(t);
    this.timer = setTimeout(() => this.toast.set(null), ms);
  }

  confirm(title: string, text?: string, ok = 'OK', danger = false): Promise<boolean> {
    return new Promise((resolve) => this.confirmReq.set({ title, text, ok, danger, resolve }));
  }

  answer(v: boolean) {
    this.confirmReq()?.resolve(v);
    this.confirmReq.set(null);
  }
}
