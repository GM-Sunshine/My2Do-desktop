// Copy runtime assets that tsc doesn't handle into dist/ so they're packaged:
//   - the splash screen HTML  → dist/renderer/
//   - the app icon            → dist/icon.png  (build/ is not shipped at runtime)
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 1) renderer assets
const rendererSrc = join(root, 'src', 'renderer');
const rendererOut = join(root, 'dist', 'renderer');
mkdirSync(rendererOut, { recursive: true });
for (const file of readdirSync(rendererSrc)) {
  copyFileSync(join(rendererSrc, file), join(rendererOut, file));
}

// 2) app icon → dist/icon.png
mkdirSync(join(root, 'dist'), { recursive: true });
copyFileSync(join(root, 'build', 'icon.png'), join(root, 'dist', 'icon.png'));

console.log('postbuild: copied renderer assets + icon into dist/');
