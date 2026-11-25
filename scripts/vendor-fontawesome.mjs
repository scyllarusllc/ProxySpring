// Copies Font Awesome Free (CSS and web fonts) into the site's static folder so no CDN is needed.
import {cpSync, mkdirSync, rmSync} from 'node:fs';
const from = 'node_modules/@fortawesome/fontawesome-free', to = 'app/static/vendor/fontawesome';
rmSync(to, {recursive: true, force: true});
mkdirSync(`${to}/css`, {recursive: true});
cpSync(`${from}/css/all.min.css`, `${to}/css/all.min.css`);
cpSync(`${from}/webfonts`, `${to}/webfonts`, {recursive: true});
cpSync(`${from}/LICENSE.txt`, `${to}/LICENSE.txt`);
