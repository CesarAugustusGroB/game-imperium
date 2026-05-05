import type { JSX } from 'preact';
import type { Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import {
  forceBerserkerMovement,
  gfxCracks,
  gfxHighRes,
  gfxParticles,
  gfxPerfHud,
  gfxShadows,
  saveBattleSettings,
  spriteReloadTrigger,
} from '../../battle/battle-settings';
import { OrnateFrame, OrnateHeader } from './OrnateFrame';

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

function setPersistedSignal(target: Signal<boolean>, value: boolean, afterChange?: () => void): void {
  target.value = value;
  afterChange?.();
  saveBattleSettings();
}

function SectionHeader({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: 'var(--font-size-xs)',
        fontWeight: 700,
        color: 'var(--color-gold-primary)',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        paddingBottom: '6px',
        borderBottom: '1px solid rgba(240, 208, 128, 0.12)',
      }}
    >
      {children}
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      class="settings-toggle-row"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '8px',
        margin: '0 -8px',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--font-family)',
      }}
    >
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-primary)',
          fontWeight: 600,
          lineHeight: 1.25,
        }}>
          {label}
        </span>
        <span style={{
          fontSize: '9px',
          color: 'var(--color-text-muted)',
          lineHeight: 1.35,
        }}>
          {description}
        </span>
      </span>
      <span style={{
        width: '38px',
        height: '21px',
        borderRadius: '999px',
        background: value ? 'var(--color-gold-primary)' : 'rgba(60, 60, 80, 0.82)',
        border: value ? '1px solid rgba(240, 208, 128, 0.85)' : '1px solid rgba(120, 120, 140, 0.35)',
        position: 'relative',
        flexShrink: 0,
        transition: 'background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default)',
      }}>
        <span style={{
          width: '17px',
          height: '17px',
          borderRadius: '50%',
          background: value ? 'rgba(20, 18, 36, 0.95)' : 'rgba(235, 230, 215, 0.95)',
          position: 'absolute',
          top: '1px',
          left: value ? '18px' : '1px',
          transition: 'left var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
        }} />
      </span>
    </button>
  );
}

export function SettingsPanel({ style }: { style?: JSX.CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        fontFamily: 'var(--font-family)',
        ...style,
      }}
    >
      <section style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <SectionHeader>Graphics</SectionHeader>
        <ToggleRow
          label="Shadows"
          description="Drop shadows on all units"
          value={gfxShadows.value}
          onChange={(value) => setPersistedSignal(gfxShadows, value)}
        />
        <ToggleRow
          label="Damage Cracks"
          description="Crack overlay on hurt units"
          value={gfxCracks.value}
          onChange={(value) => setPersistedSignal(gfxCracks, value)}
        />
        <ToggleRow
          label="Particles"
          description="Hit and death particle effects"
          value={gfxParticles.value}
          onChange={(value) => setPersistedSignal(gfxParticles, value)}
        />
        <ToggleRow
          label="High-Res Sprites"
          description="2x resolution, uses more VRAM"
          value={gfxHighRes.value}
          onChange={(value) => setPersistedSignal(gfxHighRes, value, () => { spriteReloadTrigger.value++; })}
        />
        <ToggleRow
          label="Perf HUD"
          description="Frame ms and per-layer render cost"
          value={gfxPerfHud.value}
          onChange={(value) => setPersistedSignal(gfxPerfHud, value)}
        />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <SectionHeader>Gameplay</SectionHeader>
        <ToggleRow
          label="All Units Berserker Mode"
          description="Both armies chase the nearest enemy"
          value={forceBerserkerMovement.value}
          onChange={(value) => setPersistedSignal(forceBerserkerMovement, value)}
        />
      </section>
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
        zIndex: 20,
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
