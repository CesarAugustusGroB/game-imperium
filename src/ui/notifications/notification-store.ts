import { signal } from '@preact/signals';

export type NotificationKind = 'toast' | 'pinned' | 'alert';

export interface Notification {
  id: string;
  kind: NotificationKind;
  title?: string;
  message: string;
  icon?: string;         // emoji
  color?: string;        // accent color (default: var(--color-gold-primary))
  duration?: number;     // ms before auto-dismiss (toast/alert only), default: toast=3000 alert=1500
}

export const notifications = signal<Notification[]>([]);

let _nextId = 1;

export function addNotification(n: Omit<Notification, 'id'>): string {
  const id = `notif-${_nextId++}`;
  const notif: Notification = { id, ...n };
  notifications.value = [...notifications.value, notif];

  // Auto-dismiss non-pinned notifications
  if (notif.kind !== 'pinned') {
    const duration = notif.duration ?? (notif.kind === 'toast' ? 3000 : 1500);
    setTimeout(() => removeNotification(id), duration);
  }
  return id;
}

export function removeNotification(id: string): void {
  notifications.value = notifications.value.filter(n => n.id !== id);
}

export function clearNotifications(): void {
  notifications.value = [];
}
