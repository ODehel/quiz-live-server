// Layers of src/, read from the real import graph (no specification states them).
// Run by `npm run layers` and by the CI. src/dependency-layers.test.ts proves that every rule below fires.
const COMMON = '^src/common/';
const INFRASTRUCTURE = '^src/infrastructure/';
const TESTS = '\\.test\\.ts$|^src/test-support/';

const production = (path) => ({ path, pathNot: TESTS });
const rule = (name, from, to) => ({ name, severity: 'error', from, to });

module.exports = {
  forbidden: [
    rule('common-imports-nothing-else', production(COMMON), { path: '^src/', pathNot: COMMON }),
    rule('infrastructure-imports-only-common', production(INFRASTRUCTURE), { path: '^src/', pathNot: [COMMON, INFRASTRUCTURE] }),
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Without it, an `import type` is dropped before the check and a layer can be crossed through a type unseen.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
