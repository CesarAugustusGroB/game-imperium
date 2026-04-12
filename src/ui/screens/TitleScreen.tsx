import { navigateTo } from '../screens';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';

const containerStyle: Record<string, string> = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  height: '100vh', fontFamily: 'var(--font-family)',
  background: 'var(--color-bg-primary)',
};

const shieldStyle: Record<string, string> = {
  width: '120px', height: '120px', marginBottom: '24px',
  filter: 'drop-shadow(0 0 24px var(--color-border-strong))',
  animation: 'shield-float 3s ease-in-out infinite',
};

const versionStyle: Record<string, string> = {
  position: 'fixed', bottom: '16px', right: '20px',
  fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', letterSpacing: '1px',
};

export function TitleScreen() {
  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes shield-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      <img
        src="/asset/spartan_gold_round.png"
        alt="Shield"
        style={shieldStyle}
      />

      <OrnateFrame width="min(560px, 92vw)" padding="hero">
        <OrnateHeader
          eyebrow="A Roman strategy game"
          title="IMPERIUM"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <button
            class="ornate-btn"
            style={{ padding: '14px 24px', fontSize: 'var(--font-size-lg)', letterSpacing: '2px' }}
            onClick={() => navigateTo('commander-select')}
          >
            New Game
          </button>
          <button
            class="ornate-btn-ghost"
            style={{ padding: '14px 24px', fontSize: 'var(--font-size-lg)', letterSpacing: '2px' }}
            disabled
          >
            Continue
          </button>
          <button
            class="ornate-btn-ghost"
            style={{ padding: '14px 24px', fontSize: 'var(--font-size-lg)', letterSpacing: '2px' }}
            onClick={() => navigateTo('battle')}
          >
            Quick Battle
          </button>
        </div>
      </OrnateFrame>

      <div style={versionStyle}>v0.5.0 — Sprint 5</div>
    </div>
  );
}
