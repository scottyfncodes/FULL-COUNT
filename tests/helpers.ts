import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Fixtures are real MLB Stats API responses captured via the app's proxy (see tests/fixtures/README.md).
export function fixture(name: string) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'));
}

export const clone = <T>(v: T): T => structuredClone(v);
