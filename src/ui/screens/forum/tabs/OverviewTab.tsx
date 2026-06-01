import { selectedCommander, completedSpokes } from '../../../../game/core/game-state';
import { Masthead } from '../Masthead';
import { EmbarkCard } from '../panels/EmbarkCard';
import { TreasuryPanel } from '../panels/TreasuryPanel';
import { ConsiliumPanel } from '../panels/ConsiliumPanel';
import { ExercitusPanel } from '../panels/ExercitusPanel';
import { ProvinciaeListPanel } from '../panels/ProvinciaeListPanel';
import { DoctrinaePanel } from '../panels/DoctrinaePanel';
import { DecretaPanel } from '../panels/DecretaPanel';

export function OverviewTab() {
  const commander = selectedCommander.value;
  const turn = completedSpokes.value;
  const title = commander?.name.toUpperCase() ?? 'IMPERIUM';
  const subtitle = `Strategic Hub · Turn ${turn}`;

  return (
    <>
      <Masthead title={title} subtitle={subtitle} />
      <div style={{
        flex: 1,
        padding: '20px 32px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: 0,
        overflow: 'auto',
      }}>
        {/* TOP — cinematic hero beside the Treasury + Council stack */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)',
          gap: 14,
        }}>
          <EmbarkCard index={0} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <TreasuryPanel index={1} />
            <ConsiliumPanel index={2} />
          </div>
        </div>

        {/* BOTTOM — the four domain panels, staggered in */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr)',
          gap: 14,
          flex: 1,
          minHeight: 260,
        }}>
          <ProvinciaeListPanel index={3} />
          <ExercitusPanel index={4} />
          <DoctrinaePanel index={5} />
          <DecretaPanel index={6} />
        </div>
      </div>
    </>
  );
}
