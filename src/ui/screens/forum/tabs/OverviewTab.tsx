import { selectedCommander, completedSpokes } from '../../../../game/core/game-state';
import { Masthead } from '../Masthead';
import { ConsiliumPanel } from '../panels/ConsiliumPanel';
import { ExercitusPanel } from '../panels/ExercitusPanel';
import { EmbarkCard } from '../panels/EmbarkCard';
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
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 1fr',
        gap: 14,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* LEFT — Council + Army */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          minHeight: 0, overflow: 'auto',
        }}>
          <ConsiliumPanel />
          <ExercitusPanel />
        </div>

        {/* CENTER — Embark + Provinces */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          minHeight: 0, overflow: 'hidden',
        }}>
          <EmbarkCard />
          <ProvinciaeListPanel />
        </div>

        {/* RIGHT — Doctrinae + Decreta */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          minHeight: 0, overflow: 'hidden',
        }}>
          <DoctrinaePanel />
          <DecretaPanel />
        </div>
      </div>
    </>
  );
}
