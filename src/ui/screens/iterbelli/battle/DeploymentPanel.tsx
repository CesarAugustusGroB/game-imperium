import { battleSession, chooseFormation } from '../../../../game/iterBelli/battle/controller';
import { FORMATIONS } from '../../../../game/iterBelli/battle/orders';

export function DeploymentPanel() {
  const s = battleSession.value;
  if (!s || s.phase !== 'deployment') return null;
  const disc = s.state.you.discipline;
  return (
    <div class="ib-bm-deploy">
      <div class="ib-section-title">Choose your formation</div>
      <div class="ib-bm-forms">
        {s.formationOptions.map((key) => {
          const f = FORMATIONS[key];
          const locked = disc < f.disc;
          return (
            <button key={key} class={`ib-bm-form${locked ? ' locked' : ''}`} disabled={locked}
              onClick={() => chooseFormation(key)}>
              <div class="ib-bm-form-name">{f.name}</div>
              <div class="ib-bm-form-req">disc {f.disc}{f.trait ? ` · ${f.trait}` : ' · common'}</div>
              <div class="ib-bm-form-desc">{f.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
