/* Self-hosted fonts (@fontsource) — no CDN.
   - display: Bricolage Grotesque Variable (variable, wght 200–800)
   - body: Instrument Sans (400/500/600/700)
   - mono: JetBrains Mono (400/600/700) — tokens, eyebrows, metrics */
import '@fontsource-variable/bricolage-grotesque/index.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';

import './shell/tokens.css';
import './shell/base.css';
import './shell/shell.css';

import { startRouter } from './router';

startRouter();
