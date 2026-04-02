import { EndScreen } from './EndScreen';

export function DefeatScreen() {
  return (
    <EndScreen
      outcome="defeat"
      title="DEFEAT"
      titleColor="#c24a3a"
      dividerColor="rgba(194, 74, 58, 0.7)"
      subtitle="The empire has fallen. The barbarians rule the ashes."
      image="/asset/defeat_label.png"
      imageFilter="drop-shadow(0 4px 16px rgba(120, 40, 30, 0.6))"
      panelBorder="1px solid rgba(180, 100, 80, 0.15)"
      statRowBg="rgba(35, 28, 28, 0.6)"
      statRowBorder="1px solid rgba(180, 100, 80, 0.1)"
      statValueColor="#c24a3a"
      statLabelColor="rgba(200, 175, 165, 0.65)"
      summaryLabelColor="rgba(180, 120, 100, 0.45)"
      returnBtnStyle={{
        background: 'linear-gradient(135deg, rgba(60, 20, 20, 0.7), rgba(40, 18, 18, 0.9))',
        border: '1px solid rgba(194, 74, 58, 0.45)',
        color: '#c24a3a',
        hoverClass: 'end-return-btn--defeat',
      }}
    />
  );
}
