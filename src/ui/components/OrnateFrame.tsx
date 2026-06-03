import type { JSX, ComponentChildren } from 'preact';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('ornate-styles')) {
  const el = document.createElement('style');
  el.id = 'ornate-styles';
  el.textContent = `
    /* ── Outer ornate frame ── */
    .ornate-frame {
      position: relative;
      background:
        radial-gradient(circle at top, rgba(60, 50, 90, 0.35), transparent 60%),
        var(--color-marble-dark);
      backdrop-filter: blur(var(--blur-panel));
      -webkit-backdrop-filter: blur(var(--blur-panel));
      border: 1px solid var(--color-gold-secondary);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-ornate);
    }
    .ornate-frame::before {
      content: '';
      position: absolute;
      inset: 5px;
      border: 1px solid var(--color-gold-dim);
      border-radius: calc(var(--radius-lg) - 4px);
      pointer-events: none;
    }
    /* Responsive padding classes */
    .ornate-pad-default { padding: 28px 32px; }
    .ornate-pad-compact { padding: 20px 24px; }
    .ornate-pad-hero    { padding: 40px 48px; }
    @media (max-width: 640px) {
      .ornate-pad-default { padding: 20px 16px; }
      .ornate-pad-compact { padding: 16px 14px; }
      .ornate-pad-hero    { padding: 28px 20px; }
    }
    @media (max-width: 400px) {
      .ornate-pad-default { padding: 16px 12px; }
      .ornate-pad-compact { padding: 12px 12px; }
      .ornate-pad-hero    { padding: 20px 16px; }
    }
    /* Corner ornaments — 4 absolutely positioned spans drawn as bracket pieces */
    .ornate-corner {
      position: absolute;
      width: 22px; height: 22px;
      pointer-events: none;
    }
    .ornate-corner::before, .ornate-corner::after {
      content: ''; position: absolute; background: var(--color-gold-primary);
      box-shadow: 0 0 6px rgba(240, 208, 128, 0.4);
    }
    .ornate-corner::before { width: 22px; height: 2px; }
    .ornate-corner::after  { width: 2px; height: 22px; }
    .ornate-corner.tl { top: -1px;    left: -1px; }
    .ornate-corner.tl::before { top: 0;  left: 0; }
    .ornate-corner.tl::after  { top: 0;  left: 0; }
    .ornate-corner.tr { top: -1px;    right: -1px; }
    .ornate-corner.tr::before { top: 0;  right: 0; }
    .ornate-corner.tr::after  { top: 0;  right: 0; }
    .ornate-corner.bl { bottom: -1px; left: -1px; }
    .ornate-corner.bl::before { bottom: 0; left: 0; }
    .ornate-corner.bl::after  { bottom: 0; left: 0; }
    .ornate-corner.br { bottom: -1px; right: -1px; }
    .ornate-corner.br::before { bottom: 0; right: 0; }
    .ornate-corner.br::after  { bottom: 0; right: 0; }

    /* ── Header ── */
    .ornate-eyebrow {
      font-family: var(--font-display);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-gold-secondary);
      letter-spacing: 6px;
      text-transform: uppercase;
    }
    .ornate-title {
      font-family: var(--font-display);
      font-size: 44px;
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 8px;
      text-transform: uppercase;
      line-height: 1;
      text-shadow: 0 2px 10px rgba(240, 208, 128, 0.25), 0 0 24px rgba(0, 0, 0, 0.4);
      word-break: break-word;
    }
    .ornate-title-sm {
      font-size: 28px;
      letter-spacing: 5px;
    }
    @media (max-width: 640px) {
      .ornate-eyebrow { letter-spacing: 3px; }
      .ornate-title   { font-size: 30px; letter-spacing: 5px; }
      .ornate-title-sm { font-size: 22px; letter-spacing: 3px; }
    }
    @media (max-width: 400px) {
      .ornate-title   { font-size: 24px; letter-spacing: 3px; }
      .ornate-title-sm { font-size: 19px; letter-spacing: 2px; }
    }
    .ornate-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--color-gold-secondary), transparent);
      margin: 14px 0 22px;
    }
    .ornate-stat-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      background: rgba(20, 16, 32, 0.6);
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-md);
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .ornate-stat-chip strong {
      color: var(--color-gold-primary);
      font-weight: 700;
      font-size: var(--font-size-sm);
    }
    @media (max-width: 640px) {
      .ornate-stat-chip { padding: 3px 7px; gap: 3px; }
    }
    .ornate-close-btn {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(20, 16, 32, 0.6);
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-sm);
      color: var(--color-gold-secondary);
      font-family: inherit;
      font-size: 18px; font-weight: 400;
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .ornate-close-btn:hover {
      border-color: var(--color-gold-primary);
      color: var(--color-gold-primary);
      background: rgba(80, 60, 20, 0.4);
    }
    .ornate-close-btn:active { transform: scale(0.95); }

    /* ── Gradient gold button ── */
    .ornate-btn {
      padding: 7px 8px;
      border-radius: var(--radius-sm);
      background: linear-gradient(180deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.85));
      border: 1px solid var(--color-border-strong);
      color: var(--color-gold-primary);
      font-family: var(--font-family);
      font-size: var(--font-size-xs);
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .ornate-btn:hover:not(:disabled) {
      border-color: var(--color-gold-primary);
      background: linear-gradient(180deg, rgba(110, 80, 25, 0.85), rgba(70, 55, 20, 0.95));
      color: #fff0c0;
      box-shadow: 0 0 10px rgba(240, 208, 128, 0.25);
    }
    .ornate-btn:active:not(:disabled) { transform: scale(0.97); }
    .ornate-btn:disabled { opacity: 0.35; cursor: not-allowed; }

    /* ── Ghost (secondary/cancel) button ── */
    .ornate-btn-ghost {
      padding: 7px 8px;
      border-radius: var(--radius-sm);
      background: transparent;
      border: 1px solid var(--color-border-default);
      color: var(--color-gold-secondary);
      font-family: var(--font-family);
      font-size: var(--font-size-xs);
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .ornate-btn-ghost:hover:not(:disabled) {
      border-color: var(--color-gold-primary);
      color: var(--color-gold-primary);
      background: rgba(80, 60, 20, 0.2);
    }
    .ornate-btn-ghost:active:not(:disabled) { transform: scale(0.97); }
    .ornate-btn-ghost:disabled { opacity: 0.35; cursor: not-allowed; }
  `;
  document.head.appendChild(el);
}

// ── OrnateFrame ──

interface OrnateFrameProps {
  children: ComponentChildren;
  width?: string;
  padding?: 'default' | 'compact' | 'hero';
  className?: string;
  style?: JSX.CSSProperties;
  onClick?: (e: MouseEvent) => void;
  /** Show the 4 gold corner-bracket ornaments. Default true. */
  corners?: boolean;
}

export function OrnateFrame({
  children,
  width = 'min(1180px, 94vw)',
  padding = 'default',
  className,
  style,
  onClick,
  corners = true,
}: OrnateFrameProps) {
  const padClass =
    padding === 'compact' ? 'ornate-pad-compact' :
    padding === 'hero'    ? 'ornate-pad-hero' :
                            'ornate-pad-default';
  return (
    <div
      class={`ornate-frame ${padClass}${className ? ' ' + className : ''}`}
      style={{ width, ...style }}
      onClick={onClick}
    >
      {corners && (
        <>
          <span class="ornate-corner tl" />
          <span class="ornate-corner tr" />
          <span class="ornate-corner bl" />
          <span class="ornate-corner br" />
        </>
      )}
      {children}
    </div>
  );
}

// ── OrnateHeader ──

interface OrnateHeaderProps {
  eyebrow?: string;
  title: string;
  titleSize?: 'lg' | 'md';
  rightSlot?: ComponentChildren;
  onClose?: () => void;
  accentColor?: string;
}

export function OrnateHeader({
  eyebrow,
  title,
  titleSize = 'lg',
  rightSlot,
  onClose,
  accentColor,
}: OrnateHeaderProps) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {eyebrow && <div class="ornate-eyebrow">{eyebrow}</div>}
          <div
            class={titleSize === 'lg' ? 'ornate-title' : 'ornate-title ornate-title-sm'}
            style={{ marginTop: eyebrow ? '8px' : 0 }}
          >
            {title}
          </div>
        </div>
        {(rightSlot || onClose) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {rightSlot}
            {onClose && (
              <button class="ornate-close-btn" onClick={onClose} title="Close">×</button>
            )}
          </div>
        )}
      </div>
      <OrnateDivider color={accentColor} />
    </>
  );
}

// ── OrnateDivider ──

export function OrnateDivider({ color }: { color?: string }) {
  return (
    <div
      class="ornate-divider"
      style={color ? { background: `linear-gradient(90deg, transparent, ${color}90, transparent)` } : undefined}
    />
  );
}
