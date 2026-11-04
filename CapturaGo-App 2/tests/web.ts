// Where the website lives, for the tests that check the app does the same as the website and the server.
// In the repository the website folder sits next to the app; CG_WEB can point elsewhere.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const CANDIDATES = [process.env.CG_WEB || '', join(__dirname, '..', '..', 'CapturaGo-v8.13'), '/home/claude/cg9'].filter(Boolean);
export const WEB_DIR = CANDIDATES.find((d) => existsSync(join(d, 'site.js'))) || CANDIDATES[CANDIDATES.length - 1];
