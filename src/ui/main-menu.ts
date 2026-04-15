export interface MenuCallbacks {
  onNewGame: () => void;
  onContinue: () => void;
}

export class MainMenu {
  private menu: HTMLElement;
  private settingsOverlay: HTMLElement;

  constructor(callbacks: MenuCallbacks) {
    this.menu = document.getElementById('main-menu')!;
    this.settingsOverlay = document.getElementById('settings-overlay')!;

    // New Game
    document.getElementById('btn-new-game')!.addEventListener('click', () => {
      this.hide();
      callbacks.onNewGame();
    });

    // Continue (enabled when save exists)
    const continueBtn = document.getElementById('btn-continue') as HTMLButtonElement;
    if (localStorage.getItem('map2d-save')) {
      continueBtn.disabled = false;
    }
    continueBtn.addEventListener('click', () => {
      if (continueBtn.disabled) return;
      this.hide();
      callbacks.onContinue();
    });

    // Settings
    document.getElementById('btn-settings')!.addEventListener('click', () => {
      this.settingsOverlay.classList.add('active');
    });

    document.getElementById('btn-settings-back')!.addEventListener('click', () => {
      this.settingsOverlay.classList.remove('active');
      this.applySettings();
    });

    // Exit
    document.getElementById('btn-exit')!.addEventListener('click', () => {
      window.close();
      // Fallback: browsers may block window.close() for non-script-opened windows
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#d0c8a8;font-family:system-ui;font-size:20px;background:#0a0a14;">Thanks for playing!</div>';
    });

    // ESC to return from settings
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.settingsOverlay.classList.contains('active')) {
        this.settingsOverlay.classList.remove('active');
        this.applySettings();
      }
    });
  }

  private applySettings(): void {
    // Camera settings removed — no map renderer
  }

  show(): void {
    this.menu.classList.remove('hidden');
  }

  hide(): void {
    this.menu.classList.add('hidden');
  }

  get isVisible(): boolean {
    return !this.menu.classList.contains('hidden');
  }
}
