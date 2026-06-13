import { useState } from 'preact/hooks';
import { setTutorialDismissed } from '../../../game/core/meta-save';
import { GameIcon, type GameIconName } from '../../components/GameIcon';

/**
 * First-run contextual tutorial for the current main loop (Forum hub + Iter
 * Belli). Replaces the removed Bellum tutorial overlay that left `tutorialDismissed`
 * and the Sidebar re-trigger button orphaned. Shows while `tutorialDismissed`
 * is false; "Comenzar" / "Saltar" set it true; the Sidebar button re-opens it.
 */

interface TabLine { icon: GameIconName; name: string; desc: string; }

const FORUM_TABS: TabLine[] = [
  { icon: 'nav-forum',      name: 'Forum',      desc: 'El panel de mando: tesorería, resumen y el botón para partir en campaña.' },
  { icon: 'nav-provinciae', name: 'Provinciae', desc: 'Tus provincias: impuestos, edificios y orden público. La fuente de tu economía.' },
  { icon: 'nav-consilium',  name: 'Consilium',  desc: 'El consejo de asesores: contrátalos para misiones y bonos pasivos.' },
  { icon: 'nav-exercitus',  name: 'Exercitus',  desc: 'Tu ejército: recluta cohortes, mejora armaduras y compra suministros y munición.' },
  { icon: 'nav-doctrinae',  name: 'Doctrinae',  desc: 'Doctrinas pasivas equipables (4 ranuras): descuentos, ingresos y bonos de batalla.' },
  { icon: 'nav-decreta',    name: 'Decreta',    desc: 'Pergaminos de un solo uso: lánzalos en el hub o en la batalla decisiva.' },
];

interface Step { title: string; body: preact.JSX.Element; }

function buildSteps(): Step[] {
  return [
    {
      title: 'Bienvenido al Imperium',
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={pStyle}>
            Diriges Roma desde el <b>Foro Imperial</b>: gestionas provincias, ejército, consejo
            y cartas entre campaña y campaña.
          </p>
          <p style={pStyle}>
            Cuando estés listo, partes en una campaña de <b>Iter Belli</b>: una marcha de cartas
            que culmina en una <b>batalla decisiva</b> de formaciones y dados. Ganar desbloquea la
            siguiente campaña y premia con botín y doctrinas.
          </p>
          <p style={{ ...pStyle, color: 'rgba(212,168,67,0.85)' }}>
            Saquea → construye → domina. Tu primera campaña se libra casi a pelo; el oro llega del botín.
          </p>
        </div>
      ),
    },
    {
      title: 'El Foro Imperial — 6 dominios',
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FORUM_TABS.map((t) => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ flexShrink: 0, marginTop: 1, opacity: 0.9 }}><GameIcon name={t.icon} size="row" /></span>
              <div style={{ minWidth: 0 }}>
                <span style={{ color: 'var(--imp-text-hi)', fontFamily: 'var(--imp-font-display)', fontSize: 14, letterSpacing: '0.04em' }}>{t.name}</span>
                <span style={{ ...pStyle, display: 'block', marginTop: 1 }}>{t.desc}</span>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Iter Belli — la campaña',
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={pStyle}>Tres relojes deciden tu campaña. Vigílalos:</p>
          <ThreatRow icon="🥖" label="Suministros (upkeep)">
            Cada turno de marcha consume suministros. Si se agotan, el <b>hambre derrumba la moral</b> —
            repón en las ubicaciones aliadas antes de quedarte seco.
          </ThreatRow>
          <ThreatRow icon="⚔" label="Amenaza">
            Las acciones arriesgadas y las quests fallidas <b>suben la amenaza</b>, que <b>refuerza al
            enemigo</b> de la batalla decisiva. Bájala con pagos y decisiones prudentes.
          </ThreatRow>
          <ThreatRow icon="⏳" label="Plazo">
            Tienes un <b>número de días</b> para llegar al objetivo. Avanza con cartas de movimiento;
            agotar el plazo <b>pierde la campaña</b>.
          </ThreatRow>
          <p style={{ ...pStyle, color: 'rgba(212,168,67,0.85)', marginTop: 2 }}>
            Llega al objetivo con tropas y moral, y vence la batalla decisiva para triunfar.
          </p>
        </div>
      ),
    },
  ];
}

function ThreatRow({ icon, label, children }: { icon: string; label: string; children: preact.ComponentChildren }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ flexShrink: 0, fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <span style={{ color: 'var(--imp-text-hi)', fontFamily: 'var(--imp-font-display)', fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ ...pStyle, display: 'block', marginTop: 1 }}>{children}</span>
      </div>
    </div>
  );
}

const pStyle: preact.JSX.CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--imp-text-mid)',
  fontFamily: 'var(--imp-font-body)',
};

export function TutorialOverlay() {
  // Mounted only while the tutorial is active (ForumShell gates on
  // tutorialDismissed), so `step` resets to 0 on every (re)open.
  const [step, setStep] = useState(0);

  const steps = buildSteps();
  const cur = steps[step];
  const isLast = step === steps.length - 1;
  const finish = () => setTutorialDismissed(true);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8, 6, 12, 0.72)', backdropFilter: 'blur(2px)',
        animation: 'imp-tut-fade 200ms ease',
      }}
      onClick={finish}
    >
      <style>{`@keyframes imp-tut-fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 94vw)', maxHeight: '90vh', overflow: 'auto',
          background: 'linear-gradient(180deg, rgba(24, 21, 36, 0.98) 0%, rgba(15, 13, 22, 0.99) 100%)',
          border: '1px solid rgba(212, 168, 67, 0.45)',
          borderRadius: 6, padding: '22px 26px 18px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <GameIcon name="nav-tutorial" size="row" />
          <h2 style={{
            margin: 0, fontFamily: 'var(--imp-font-display)', fontSize: 20,
            color: 'var(--imp-text-hi)', letterSpacing: '0.03em',
          }}>{cur.title}</h2>
        </div>

        <div style={{ minHeight: 180 }}>{cur.body}</div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7, margin: '16px 0 14px' }}>
          {steps.map((_, i) => (
            <span key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: i === step ? 'var(--imp-gold, #d4a843)' : 'rgba(212,168,67,0.28)',
              transition: 'background 160ms',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <button onClick={finish} style={ghostBtn}>Saltar</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} style={ghostBtn}>Atrás</button>
            )}
            <button
              onClick={() => (isLast ? finish() : setStep(step + 1))}
              style={primaryBtn}
            >
              {isLast ? 'Comenzar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ghostBtn: preact.JSX.CSSProperties = {
  padding: '7px 14px', background: 'transparent',
  border: '1px solid rgba(212, 168, 67, 0.25)', borderRadius: 3,
  color: 'rgba(212, 168, 67, 0.7)', fontSize: 12, cursor: 'pointer',
  fontFamily: 'var(--imp-font-display)', letterSpacing: '0.04em', textTransform: 'uppercase',
};

const primaryBtn: preact.JSX.CSSProperties = {
  padding: '7px 18px',
  background: 'linear-gradient(180deg, rgba(212,168,67,0.92), rgba(168,128,42,0.92))',
  border: '1px solid rgba(240, 208, 128, 0.5)', borderRadius: 3,
  color: '#1a1408', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'var(--imp-font-display)', letterSpacing: '0.05em', textTransform: 'uppercase',
};
