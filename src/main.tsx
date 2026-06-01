import './ui/design-tokens.css';
import './ui/globals.css';
import './ui/sound/music';
import { render } from 'preact';
import { App } from './ui/screens/App';

// Mount Preact UI
const appRoot = document.getElementById('app-root');
if (appRoot) render(<App />, appRoot);
