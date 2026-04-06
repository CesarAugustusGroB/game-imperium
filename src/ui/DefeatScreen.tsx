import { useState, useEffect } from 'preact/hooks';
import { EndScreen } from './EndScreen';
import { completedSpokes } from '../game/game-state';
import { provinces } from '../game/province-store';

export function DefeatScreen() {
  const [brightness, setBrightness] = useState(0.85);

  // Transition from darker to normal over 2s
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setBrightness(1);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const battles = completedSpokes.value;
  const seasons = completedSpokes.value * 2;
  const provinceCount = provinces.value.length;

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
        titleColor="#c05050"
        titleGlow="#b03030"
        backgroundTint="#180808"
        battles={battles}
        seasons={seasons}
        provinceCount={provinceCount}
      />
    </div>
  );
}
