import { battleSession, chooseFormation } from '../../../../game/iterBelli/battle/controller';
import { FORMATIONS } from '../../../../game/iterBelli/battle/orders';

export function DeploymentPanel() {
  const s = battleSession.value;
  if (!s || s.phase !== 'deployment') return null;
  // Every formation in formationOptions is selectable: availableFormations
  // already filtered by discipline, and when nothing qualifies the controller
  // offers battleLine as a fallback — re-locking it here would dead-end the
  // deployment with no clickable option.
  return (
    <div class="ib-bm-deploy">
      <div class="ib-section-title">Choose your formation</div>
      <div class="ib-bm-forms">
        {s.formationOptions.map((key) => {
          const f = FORMATIONS[key];
          return (
            <button key={key} class="ib-bm-form"
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
