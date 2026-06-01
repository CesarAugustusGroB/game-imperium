import type { JSX } from 'preact';

// ── Hub sidebar nav + tutorial/abandon/collapse ──
import navForum from '../../assets/ui/icons/nav-forum.png';
import navProvinciae from '../../assets/ui/icons/nav-provinciae.png';
import navConsilium from '../../assets/ui/icons/nav-consilium.png';
import navExercitus from '../../assets/ui/icons/nav-exercitus.png';
import navDoctrinae from '../../assets/ui/icons/nav-doctrinae.png';
import navDecreta from '../../assets/ui/icons/nav-decreta.png';
import navTutorial from '../../assets/ui/icons/nav-tutorial.png';
import navAbandon from '../../assets/ui/icons/nav-abandon.png';
import navPrev from '../../assets/ui/icons/nav-prev.png';
import navNext from '../../assets/ui/icons/nav-next.png';
// ── Node icons (battle/event/rest/boss) ──
import nodeBattle from '../../assets/ui/icons/node-battle.png';
import nodeEvent from '../../assets/ui/icons/node-event.png';
import nodeRest from '../../assets/ui/icons/node-rest.png';
import nodeBoss from '../../assets/ui/icons/node-boss.png';
// ── Hub misc ──
import arrowRight from '../../assets/ui/icons/arrow-right.png';
import suppliesCrate from '../../assets/ui/icons/supplies-crate.png';
import deltaUp from '../../assets/ui/icons/delta-up.png';
import deltaDown from '../../assets/ui/icons/delta-down.png';
// ── Campaign resources ──
import resSoldiers from '../../assets/ui/icons/res-soldiers.png';
import resMorale from '../../assets/ui/icons/res-morale.png';
import resDiscipline from '../../assets/ui/icons/res-discipline.png';
import resSupplies from '../../assets/ui/icons/res-supplies.png';
import resThreat from '../../assets/ui/icons/res-threat.png';
// ── Operation card categories ──
import catLogistica from '../../assets/ui/icons/cat-logistica.png';
import catMovimiento from '../../assets/ui/icons/cat-movimiento.png';
import catInteligencia from '../../assets/ui/icons/cat-inteligencia.png';
import catCoercion from '../../assets/ui/icons/cat-coercion.png';
import catDiplomacia from '../../assets/ui/icons/cat-diplomacia.png';
import catPostura from '../../assets/ui/icons/cat-postura.png';
import catOperaciones from '../../assets/ui/icons/cat-operaciones.png';
import catCrisis from '../../assets/ui/icons/cat-crisis.png';
// ── Operation card quest / final battle ──
import opQuest from '../../assets/ui/icons/op-quest.png';
import opFinalBattle from '../../assets/ui/icons/op-final-battle.png';

/** Single source of truth: icon name → bundled asset URL. */
export const GAME_ICONS = {
  'nav-forum': navForum,
  'nav-provinciae': navProvinciae,
  'nav-consilium': navConsilium,
  'nav-exercitus': navExercitus,
  'nav-doctrinae': navDoctrinae,
  'nav-decreta': navDecreta,
  'nav-tutorial': navTutorial,
  'nav-abandon': navAbandon,
  'nav-prev': navPrev,
  'nav-next': navNext,
  'node-battle': nodeBattle,
  'node-event': nodeEvent,
  'node-rest': nodeRest,
  'node-boss': nodeBoss,
  'arrow-right': arrowRight,
  'supplies-crate': suppliesCrate,
  'delta-up': deltaUp,
  'delta-down': deltaDown,
  'res-soldiers': resSoldiers,
  'res-morale': resMorale,
  'res-discipline': resDiscipline,
  'res-supplies': resSupplies,
  'res-threat': resThreat,
  'cat-logistica': catLogistica,
  'cat-movimiento': catMovimiento,
  'cat-inteligencia': catInteligencia,
  'cat-coercion': catCoercion,
  'cat-diplomacia': catDiplomacia,
  'cat-postura': catPostura,
  'cat-operaciones': catOperaciones,
  'cat-crisis': catCrisis,
  'op-quest': opQuest,
  'op-final-battle': opFinalBattle,
} as const;

export type GameIconName = keyof typeof GAME_ICONS;

interface GameIconProps {
  name: GameIconName;
  size?: number;
  className?: string;
  style?: JSX.CSSProperties;
  title?: string;
}

/** Renders a sliced Roman medallion icon at the given pixel size. */
export function GameIcon({ name, size = 16, className, style, title }: GameIconProps) {
  return (
    <img
      src={GAME_ICONS[name]}
      alt=""
      title={title}
      width={size}
      height={size}
      class={className}
      style={{
        display: 'inline-block',
        objectFit: 'contain',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
