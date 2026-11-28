import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The SonarQube Cloud analysis (decision #114) is informative: what it reports must never be silenced from the repository.
// A comment that tells Sonar to ignore a line, or an exclusion that hides code from its issues, its coverage or its duplication,
// is to Sonar what `eslint-disable` and `jscpd:ignore` are to the guards of the repository. The one exclusion admitted
// only separates the tests from the sources (they share `src`): it must name what `sonar.test.inclusions` names.

const ROOT = resolve(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
// Built at run time: this file is in `src`, where the guard looks for the marker.
const MARKER_NAME = ['NO', 'SONAR'].join('');
const MARKER = new RegExp(MARKER_NAME, 'i');

// The `key=value` lines of a properties file, without comments and blank lines.
function settingsOf(properties: string): Map<string, string> {
    const lines = properties.split('\n').map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('#'));
    return new Map(lines.map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]));
}

// The settings that hide code from Sonar: any exclusion for the coverage or the duplication, and a plain exclusion that is not the separation.
function hidingSettings(properties: string): string[] {
    const settings = settingsOf(properties);
    const separation = settings.get('sonar.exclusions') === settings.get('sonar.test.inclusions');
    return ['sonar.exclusions', 'sonar.coverage.exclusions', 'sonar.cpd.exclusions'].filter((key) => settings.has(key) && (key !== 'sonar.exclusions' || !separation));
}

// `file:line` of every line that carries the marker.
function silencingLines(files: Record<string, string>): string[] {
    return Object.entries(files).flatMap(([file, text]) => text.split('\n').flatMap((line, index) => (MARKER.test(line) ? [`${file}:${index + 1}`] : [])));
}

function sourcesOf(directory: string): Record<string, string> {
    const files = readdirSync(join(ROOT, directory), { recursive: true, encoding: 'utf8' }).filter((file) => /\.(ts|mjs)$/.test(file));
    return Object.fromEntries(files.map((file) => [`${directory}/${file}`, read(`${directory}/${file}`)]));
}

describe('what silences Sonar', () => {
    it('is found in a line, with its file and line number', () => {
        expect(silencingLines({ 'src/a.ts': `const a = 1;\n// ${MARKER_NAME.toLowerCase()}`, 'src/b.ts': 'const b = 2;' })).toEqual(['src/a.ts:2']);
    });

    it('is not in `src`', () => {
        expect(silencingLines(sourcesOf('src'))).toEqual([]);
    });

    it.each(['sonar.exclusions=src/**/*.ts', 'sonar.coverage.exclusions=src/index.ts', 'sonar.cpd.exclusions=src/index.ts'])('is refused in the properties: %s', (setting) => {
        expect(hidingSettings(`sonar.test.inclusions=**/*.test.ts\n${setting}`)).toEqual([setting.split('=')[0]]);
    });

    it('lets through the exclusion that only separates the tests from the sources', () => {
        expect(hidingSettings('# the tests are not sources\nsonar.test.inclusions=**/*.test.ts\nsonar.exclusions=**/*.test.ts')).toEqual([]);
    });
});
