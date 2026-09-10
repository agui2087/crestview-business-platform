import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

test('shipped UI sources do not contain emoji-presentation characters', async () => {
  async function inspect(directory: URL): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'design-preview') continue;
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) await inspect(path);
      else if (/\.(tsx|css)$/.test(entry.name)) {
        const source = await readFile(path, 'utf8');
        assert.equal(/[\p{Emoji_Presentation}\uFE0F]/u.test(source), false, `${path.pathname}: use a decorative SVG, not an emoji`);
      }
    }
  }
  await inspect(new URL('../components/', import.meta.url));
  await inspect(new URL('../app/', import.meta.url));
});
