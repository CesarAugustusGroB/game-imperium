interface LaurelProps {
  size?: number;
  color?: string;
  opacity?: number;
  flip?: boolean;
}

export function Laurel({ size = 40, color = '#d4a843', opacity = 0.8, flip = false }: LaurelProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      style={{ opacity, transform: flip ? 'scaleX(-1)' : 'none' }}
    >
      <g fill="none" stroke={color} stroke-width="0.8" stroke-linecap="round">
        <path d="M20 38 Q14 30 12 22 Q10 14 14 8" />
        <path d="M15 33 Q11 31 8 32" />
        <path d="M13 28 Q9 26 6 26" />
        <path d="M11 23 Q7 20 5 20" />
        <path d="M11 17 Q8 14 6 13" />
        <path d="M13 11 Q11 8 10 5" />
        <path d="M20 38 Q26 30 28 22 Q30 14 26 8" />
        <path d="M25 33 Q29 31 32 32" />
        <path d="M27 28 Q31 26 34 26" />
        <path d="M29 23 Q33 20 35 20" />
        <path d="M29 17 Q32 14 34 13" />
        <path d="M27 11 Q29 8 30 5" />
      </g>
      <g fill={color}>
        <ellipse cx="13" cy="32.5" rx="2.2" ry="1" transform="rotate(-20 13 32.5)" />
        <ellipse cx="10.5" cy="27" rx="2.2" ry="1" transform="rotate(-10 10.5 27)" />
        <ellipse cx="8.5" cy="21" rx="2.2" ry="1" />
        <ellipse cx="9" cy="15" rx="2.2" ry="1" transform="rotate(15 9 15)" />
        <ellipse cx="11" cy="9" rx="2.2" ry="1" transform="rotate(30 11 9)" />
        <ellipse cx="27" cy="32.5" rx="2.2" ry="1" transform="rotate(20 27 32.5)" />
        <ellipse cx="29.5" cy="27" rx="2.2" ry="1" transform="rotate(10 29.5 27)" />
        <ellipse cx="31.5" cy="21" rx="2.2" ry="1" />
        <ellipse cx="31" cy="15" rx="2.2" ry="1" transform="rotate(-15 31 15)" />
        <ellipse cx="29" cy="9" rx="2.2" ry="1" transform="rotate(-30 29 9)" />
      </g>
    </svg>
  );
}
