import { Component } from 'preact';
import type { ComponentChildren } from 'preact';

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ComponentChildren }, State> {
  state: State = { error: null };

  componentDidCatch(error: Error) {
    this.setState({ error });
  }

  private handleReturn = () => {
    this.setState({ error: null });
    window.location.hash = 'title';
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        fontFamily: 'var(--font-family)',
        background: 'var(--color-bg-primary)',
        color: 'rgba(220, 160, 100, 0.8)', gap: '16px',
      }}>
        <div style={{
          fontSize: 'var(--font-size-xl)', fontWeight: 600,
          letterSpacing: '2px', textTransform: 'uppercase',
        }}>
          Something went wrong
        </div>
        <div style={{
          fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)',
          maxWidth: '400px', textAlign: 'center', lineHeight: '1.5',
        }}>
          {this.state.error.message}
        </div>
        <button
          onClick={this.handleReturn}
          style={{
            marginTop: '8px', padding: '10px 24px',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border-default)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'inherit', fontSize: 'var(--font-size-md)',
            fontWeight: 600, letterSpacing: '1px',
            transition: 'all var(--duration-normal) var(--ease-default)',
          }}
        >
          Return to Title
        </button>
      </div>
    );
  }
}
