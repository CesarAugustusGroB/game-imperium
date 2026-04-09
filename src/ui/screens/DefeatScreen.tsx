import { useState, useEffect } from 'preact/hooks';
import { EndScreen } from './EndScreen';

export function DefeatScreen() {
  const [brightness, setBrightness] = useState(0.85);

  // Transition from darker to normal over 2s
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setBrightness(1);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      style={{
        filter: `brightness(${brightness})`,
        transition: 'filter 2s ease-out',
        width: '100%',
        height: '100%',
      }}
    >
      <EndScreen
        outcome="defeat"
        title="Defeat"
        titleColor="var(--color-danger)"
        titleGlow="#b03030"
        backgroundTint="#180808"
      />
    </div>
  );
}
