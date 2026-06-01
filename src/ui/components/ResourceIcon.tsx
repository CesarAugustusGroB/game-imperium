import type { JSX } from 'preact';
import type { ResourceType } from '../../game/core/commander';
import { RESOURCE_INFO } from '../../game/core/commander';
import goldStackIcon from '../../assets/ui/resources/gold-stack-icon.png';
import iunioresIcon from '../../assets/ui/resources/iuniores-icon-color.png';

const RESOURCE_ICON_SRC: Partial<Record<ResourceType, string>> = {
  gold: goldStackIcon,
  iuniores: iunioresIcon,
};

interface InlineImageIconProps {
  src: string;
  size?: number;
  title?: string;
  style?: JSX.CSSProperties;
}

export function InlineImageIcon({ src, size = 18, title, style }: InlineImageIconProps) {
  return (
    <img
      src={src}
      alt={title ?? ''}
      title={title}
      aria-hidden={title ? undefined : 'true'}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: '-0.25em',
        ...style,
      }}
    />
  );
}

interface ResourceIconProps {
  type: ResourceType;
  size?: number;
  title?: string;
  style?: JSX.CSSProperties;
}

export function ResourceIcon({ type, size = 18, title, style }: ResourceIconProps) {
  const src = RESOURCE_ICON_SRC[type];
  if (src) {
    return <InlineImageIcon src={src} size={size} title={title} style={style} />;
  }

  return (
    <span
      title={title}
      aria-hidden={title ? undefined : 'true'}
      style={{ color: RESOURCE_INFO[type].color, lineHeight: 1, ...style }}
    >
      {RESOURCE_INFO[type].icon}
    </span>
  );
}

interface ResourceAmountProps {
  type: ResourceType;
  amount: number | string;
  iconSize?: number;
  sign?: string;
  label?: boolean;
  style?: JSX.CSSProperties;
}

export function ResourceAmount({
  type,
  amount,
  iconSize = 18,
  sign = '',
  label = false,
  style,
}: ResourceAmountProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span>{sign}{amount}</span>
      <ResourceIcon type={type} size={iconSize} />
      {label && <span>{RESOURCE_INFO[type].label}</span>}
    </span>
  );
}

interface CostInlineProps {
  cost: Partial<Record<ResourceType, number>>;
  iconSize?: number;
}

export function CostInline({ cost, iconSize = 16 }: CostInlineProps) {
  const entries = (Object.entries(cost) as [ResourceType, number][])
    .filter(([, amt]) => amt > 0);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {entries.map(([type, amount], index) => (
        <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {index > 0 && <span style={{ opacity: 0.75 }}>+</span>}
          <ResourceAmount type={type} amount={amount} iconSize={iconSize} />
        </span>
      ))}
    </span>
  );
}
