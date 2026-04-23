import { musicMuted, toggleMusicMute } from '../sound/music';

const containerStyle: Record<string, string> = {
  position: 'fixed',
  top: '12px',
  right: '12px',
  zIndex: '9999',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  background: 'rgba(20, 18, 14, 0.7)',
  border: '1px solid var(--color-border-default, #7a6a42)',
  color: 'var(--color-text-secondary, #d9c989)',
  cursor: 'pointer',
  fontSize: '18px',
  lineHeight: '1',
  userSelect: 'none',
  transition: 'all 150ms ease',
};

export function MusicToggle() {
  const muted = musicMuted.value;
  return (
    <button
      type="button"
      aria-label={muted ? 'Unmute music' : 'Mute music'}
      title={muted ? 'Unmute music' : 'Mute music'}
      onClick={toggleMusicMute}
      style={containerStyle}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
