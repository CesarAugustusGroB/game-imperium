import { OrnatePanel } from '../../../components/OrnatePanel';
import { Masthead } from '../Masthead';

interface PlaceholderTabProps {
  title: string;
  subtitle: string;
  nextTask: string;
}

/**
 * Temporary tab body used by every Forum tab until the real content lands in
 * its own sprint task (S22-03 through S22-08). Replaces itself one tab at a
 * time so `ForumShell` can ship with all routes wired in S22-02.
 */
export function PlaceholderTab({ title, subtitle, nextTask }: PlaceholderTabProps) {
  return (
    <>
      <Masthead title={title} subtitle={subtitle} />
      <div style={{ flex: 1, padding: '20px 32px 24px', minHeight: 0, display: 'flex' }}>
        <OrnatePanel style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '48px 32px' }}>
            <div style={{
              fontFamily: 'var(--imp-font-display)',
              fontSize: 20, letterSpacing: 4,
              color: 'var(--imp-text-mid)',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              Coming in {nextTask}
            </div>
            <div style={{
              fontFamily: 'var(--imp-font-serif)',
              fontStyle: 'italic', fontSize: 13,
              color: 'var(--imp-text-lo)',
            }}>
              Tab shell is live — content ships in a later sprint task.
            </div>
          </div>
        </OrnatePanel>
      </div>
    </>
  );
}
