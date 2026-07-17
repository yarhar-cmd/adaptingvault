import { readdir, readFile } from 'node:fs/promises';

const assetsDirectory = new URL('../apps/frontend/dist/assets/', import.meta.url);
const forbiddenDevelopmentText = [
  'Awakening Chamber Editor',
  'mirrorvault:awakening-editor-drafts:v1',
  'Spawn Rat',
  'Defeat All Enemies',
  'Freeze Enemy AI',
  'Enemy framework',
  'Version metadata',
];

const files = (await readdir(assetsDirectory)).filter((file) => file.endsWith('.js'));
const bundles = await Promise.all(
  files.map(async (file) => ({
    file,
    source: await readFile(new URL(file, assetsDirectory), 'utf8'),
  })),
);
const exposed = forbiddenDevelopmentText.flatMap((text) =>
  bundles.filter(({ source }) => source.includes(text)).map(({ file }) => `${text} (${file})`),
);
if (exposed.length > 0) {
  throw new Error(`Development-only UI leaked into the production bundle: ${exposed.join(', ')}`);
}
console.log(`Production safety check passed across ${files.length} JavaScript bundle(s).`);
