import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Fails when a comment switches a duplication check off (contract: decision #108 of docs/decisions/DECISIONS.md).

const SWITCH_OFF = /jscpd:ignore/;

function switchedOff(folder) {
    return readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).flatMap((entry) => {
        const file = join(entry.parentPath, entry.name);
        return readFileSync(file, 'utf8').split('\n')
            .flatMap((text, index) => (SWITCH_OFF.test(text) ? [`${file}:${index + 1} switches a duplication check off`] : []));
    });
}

const problems = switchedOff('src');
if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
}
console.log('No duplication check is switched off.');
