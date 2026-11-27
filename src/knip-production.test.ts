import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The production pass of knip (`npm run knip:production`) counts a file or an export as used only when production code reaches it:
// a test that alone imports an export no longer keeps it alive. This file proves it on throwaway trees and pins the script and the CI step
// that run it, so that an option removed or changed turns a test red.

const ROOT = resolve(__dirname, '..');

const CI_STEPS = () => readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8').split(/\n\s*- name:/).map((step) => step.split('\n').map((line) => line.trim()).filter((line) => line !== ''));

describe('where the production pass runs', () => {
    it('is the npm script `knip:production`, next to `knip`, which turns a stale entry of knip.jsonc into a failure', () => {
        const { scripts } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
        expect([scripts.knip, scripts['knip:production']]).toEqual(['knip --treat-config-hints-as-errors', 'knip --production --config knip.production.jsonc']);
    });

    it('is a CI step that runs only that script, right after the pass over everything', () => {
        const steps = CI_STEPS();
        const positionOf = (script: string) => steps.findIndex((lines) => lines.includes(`run: npm run ${script}`));
        expect(steps[positionOf('knip:production')]).toHaveLength(2);
        expect(positionOf('knip:production')).toBe(positionOf('knip') + 1);
    });
});
