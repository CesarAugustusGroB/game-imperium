import type { ComponentChildren } from 'preact';
import type { JSX } from 'preact/jsx-runtime';

if (typeof document !== 'undefined' && !document.getElementById('btn-styles')) {
  const el = document.createElement('style');
  el.id = 'btn-styles';
  el.textContent = `
    .btn-primary,
    .btn-secondary,
    .btn-ghost {
      padding: 10px 20px;
      border-radius: var(--radius-sm);
      font-family: var(--font-family);
      font-size: var(--font-size-md);
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all var(--duration-normal) var(--ease-default);
      border-width: var(--border-width);
      border-style: solid;
    }

    .btn-primary:not(:disabled):hover,
    .btn-secondary:not(:disabled):hover,
    .btn-ghost:not(:disabled):hover {
      border-color: var(--color-border-strong);
      transform: scale(1.02);
      box-shadow: var(--shadow-md);
    }

    .btn-primary:not(:disabled):active,
    .btn-secondary:not(:disabled):active,
    .btn-ghost:not(:disabled):active {
      transform: scale(0.97);
      box-shadow: var(--shadow-sm);
    }

    .btn-primary:disabled,
    .btn-secondary:disabled,
    .btn-ghost:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .btn-primary:focus-visible,
    .btn-secondary:focus-visible,
    .btn-ghost:focus-visible {
      outline: 2px solid var(--color-gold-primary);
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(el);
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const variantStyles: Record<ButtonVariant, JSX.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.9))',
    borderColor: 'var(--color-border-strong)',
    color: 'var(--color-gold-primary)',
  },
  secondary: {
    background: 'linear-gradient(135deg, rgba(40, 36, 60, 0.9), rgba(28, 26, 48, 0.95))',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-gold-secondary)',
  },
  ghost: {
    background: 'transparent',
    borderColor: 'var(--color-border-subtle)',
    color: 'var(--color-text-muted)',
  },
};

interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  children: ComponentChildren;
  onClick?: JSX.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  style?: JSX.CSSProperties;
  type?: 'button' | 'submit';
}

export function Button({
  variant,
  children,
  onClick,
  disabled,
  className,
  style,
  type = 'button',
  ...rest
}: ButtonProps) {
  const combinedClass = [`btn-${variant}`, className].filter(Boolean).join(' ');
  const combinedStyle = { ...variantStyles[variant], ...style };

  return (
    <button
      type={type}
      class={combinedClass}
      onClick={onClick}
      disabled={disabled}
      style={combinedStyle}
      {...rest}
    >
      {children}
    </button>
  );
}
