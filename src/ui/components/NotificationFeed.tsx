import type { JSX } from 'preact/jsx-runtime';
import { notifications, removeNotification } from '../notifications/notification-store';
import type { Notification } from '../notifications/notification-store';

// Inject notification CSS once
if (typeof document !== 'undefined' && !document.getElementById('notif-styles')) {
  const el = document.createElement('style');
  el.id = 'notif-styles';
  el.textContent = `
    @keyframes notif-in {
      from { opacity: 0; transform: translateX(20px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes notif-out {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(20px); }
    }
    .notif-card {
      animation: notif-in var(--duration-normal) var(--ease-default);
    }
    .notif-dismiss-btn:hover {
      color: var(--color-text-primary) !important;
      background: rgba(255,255,255,0.08) !important;
    }
  `;
  document.head.appendChild(el);
}

function NotifCard({ notif }: { notif: Notification }): JSX.Element {
  const accentColor = notif.color ?? 'var(--color-gold-primary)';
  const borderColor = notif.color
    ? `${notif.color}4d`   // hex color + '4d' = ~30% opacity in hex
    : 'var(--color-border-subtle)';

  return (
    <div
      class="notif-card"
      style={{
        width: 'min(280px, calc(100vw - 32px))',
        background: 'var(--color-bg-primary)',
        backdropFilter: 'blur(var(--blur-panel))',
        WebkitBackdropFilter: 'blur(var(--blur-panel))',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 'var(--space-xs)',
        boxSizing: 'border-box',
        pointerEvents: notif.kind === 'pinned' ? 'auto' : 'none',
      }}
    >
      {notif.icon && (
        <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: '1.4' }}>
          {notif.icon}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {notif.title && (
          <div style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            color: accentColor,
            marginBottom: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {notif.title}
          </div>
        )}
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          lineHeight: '1.4',
          wordBreak: 'break-word',
        }}>
          {notif.message}
        </div>
      </div>
      {notif.kind === 'pinned' && (
        <button
          class="notif-dismiss-btn"
          onClick={() => removeNotification(notif.id)}
          aria-label="Dismiss notification"
          style={{
            flexShrink: 0,
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            fontSize: '16px',
            lineHeight: '1',
            cursor: 'pointer',
            padding: '0 2px',
            borderRadius: 'var(--radius-sm)',
            transition: `color var(--duration-fast), background var(--duration-fast)`,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function NotificationFeed(): JSX.Element | null {
  const notifs = notifications.value;
  const toasts = notifs.filter(n => n.kind === 'toast' || n.kind === 'alert');
  const pinned = notifs.filter(n => n.kind === 'pinned');

  if (notifs.length === 0) return null;

  return (
    <>
      {/* Toasts / alerts — top right */}
      <div style={{
        position: 'fixed',
        top: '60px',
        right: '16px',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        pointerEvents: 'none',
      }}>
        {toasts.map(n => <NotifCard key={n.id} notif={n} />)}
      </div>
      {/* Pinned — bottom right */}
      <div style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}>
        {pinned.map(n => <NotifCard key={n.id} notif={n} />)}
      </div>
    </>
  );
}
