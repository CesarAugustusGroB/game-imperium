import { EndScreen } from './EndScreen';

export function VictoryScreen() {
  return (
    <EndScreen
      outcome="victory"
      title="VICTORY"
      titleColor="#f0d080"
      dividerColor="rgba(240, 208, 128, 0.7)"
      subtitle="The barbarian horde is defeated. Rome endures."
      image="/asset/victory_banner.png"
      imageFilter="drop-shadow(0 4px 16px rgba(180, 140, 40, 0.5))"
      panelBorder="1px solid rgba(180, 160, 100, 0.15)"
      statRowBg="rgba(35, 32, 55, 0.6)"
      statRowBorder="1px solid rgba(180, 160, 100, 0.1)"
      statValueColor="#f0d080"
      statLabelColor="rgba(200, 190, 165, 0.65)"
      summaryLabelColor="rgba(180, 160, 100, 0.45)"
      returnBtnStyle={{
        background: 'linear-gradient(135deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.9))',
        border: '1px solid rgba(220, 190, 100, 0.5)',
        color: '#f0d080',
        hoverClass: 'end-return-btn--victory',
      }}
    />
  );
}
