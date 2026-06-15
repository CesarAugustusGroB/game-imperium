import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { OrnateFrame, OrnateHeader } from './OrnateFrame';
import { sfxMuted, sfxVolume, persistAudioPrefs } from '../sound/sound';
import { musicMuted, toggleMusicMute } from '../sound/music';
import { playSfx } from '../sound/sfx';
import { metaSave, exportCampaignLogsJson } from '../../game/core/meta-save';

if (typeof document !== 'undefined' && !document.getElementById('settings-panel-styles')) {
  const el = document.createElement('style');
  el.id = 'settings-panel-styles';
  el.textContent = `
    @keyframes options-modal-in {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .settings-toggle-row {
      transition: background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
    }
    .settings-toggle-row:hover {
      background: rgba(240, 208, 128, 0.06) !important;
      border-color: var(--color-border-default) !important;
    }
    .settings-toggle-row:focus-visible {
      outline: 2px solid var(--color-gold-primary);
      outline-offset: 2px;
    }
    .options-modal-card {
      animation: options-modal-in var(--duration-normal) var(--ease-default) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .settings-toggle-row,
      .options-modal-card {
        animation: none !important;
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(el);
}

const ROW_STYLE: JSX.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
  padding: '10px 14px', borderRadius: 8,
  background: 'rgba(0,0,0,0.25)', border: '1px solid var(--color-border-subtle, rgba(212,168,67,0.2))',
  fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary, #d8d2c4)',
  cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit',
};

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button class="settings-toggle-row" style={ROW_STYLE} onClick={onToggle} role="switch" aria-checked={on}>
      <span>{label}</span>
      <span style={{
        fontFamily: 'var(--imp-font-mono, monospace)', fontSize: 12, letterSpacing: '.08em',
        color: on ? 'var(--color-gold-primary, #d4a843)' : 'var(--color-text-muted, #6f6757)',
      }}>
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

function downloadTelemetry(): void {
  const json = exportCampaignLogsJson();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `imperium-telemetry-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  playSfx('ui_click');
}

export function SettingsPanel({ style }: { style?: JSX.CSSProperties }) {
  const logCount = metaSave.value.campaignLogs.length;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        fontFamily: 'var(--font-family)',
        ...style,
      }}
    >
      <ToggleRow
        label="Música"
        on={!musicMuted.value}
        onToggle={() => toggleMusicMute()}
      />
      <ToggleRow
        label="Efectos de sonido"
        on={!sfxMuted.value}
        onToggle={() => { sfxMuted.value = !sfxMuted.value; persistAudioPrefs(); playSfx('ui_click'); }}
      />
      <div style={{ ...ROW_STYLE, cursor: 'default' }}>
        <span>Volumen de efectos</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.1}
          value={sfxVolume.value}
          aria-label="Volumen de efectos"
          style={{ accentColor: 'var(--color-gold-primary, #d4a843)', width: 140 }}
          onChange={(e) => {
            sfxVolume.value = Number((e.target as HTMLInputElement).value);
            persistAudioPrefs();
            playSfx('ui_click');
          }}
        />
      </div>
      <button
        class="settings-toggle-row"
        style={{ ...ROW_STYLE, opacity: logCount === 0 ? 0.5 : 1, cursor: logCount === 0 ? 'not-allowed' : 'pointer' }}
        disabled={logCount === 0}
        onClick={downloadTelemetry}
        title="Descarga el registro local de campañas (JSON) para análisis de balance"
      >
        <span>Descargar telemetría de campañas</span>
        <span style={{
          fontFamily: 'var(--imp-font-mono, monospace)', fontSize: 12, letterSpacing: '.08em',
          color: logCount === 0 ? 'var(--color-text-muted, #6f6757)' : 'var(--color-gold-primary, #d4a843)',
        }}>
          {logCount === 0 ? '— vacío' : `${logCount} ↓`}
        </span>
      </button>
    </div>
  );
}

export function OptionsModal({ open, onClose }: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Options"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        // Global options modal: must sit above every gameplay overlay
        // (NotificationFeed 150, Provinciae 200, draft 300, tutorial 400,
        // battle 600) yet below ConfirmDialog / MusicToggle (9999) so a
        // confirm launched from here still appears on top. (Was 20 — hidden
        // behind those overlays.) Will fold into the z-index token scale (MO1).
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(8, 6, 14, 0.72)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <OrnateFrame
        width="min(520px, 94vw)"
        padding="compact"
        className="options-modal-card"
        style={{ maxHeight: 'min(760px, 92vh)', overflowY: 'auto' }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <OrnateHeader
          eyebrow="Main Menu"
          title="Options"
          titleSize="md"
          onClose={onClose}
        />
        <SettingsPanel />
      </OrnateFrame>
    </div>
  );
}
