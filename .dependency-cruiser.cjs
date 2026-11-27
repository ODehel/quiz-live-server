// Layers of src/, read from the real import graph (no specification states them).
// Run by `npm run layers` and by the CI. src/dependency-layers.test.ts proves that every rule below fires.
const COMPOSITION = '^src/(index|seed|quiz-server|quiz-server-configuration\\.interface)\\.ts$';
const COMMON = '^src/common/';
const INFRASTRUCTURE = '^src/infrastructure/';
const FEATURES = '^src/(authentication|questions|themes|users|websocket|routes)/';
// Concrete files: an adapter (sqlite-*), a default implementation (default-*), a service, a route.
const ROUTE = '-route\\.ts$|^src/routes/';
const SERVICE = '/(default-[^/]+|[^/]+-service)\\.ts$';
const CONCRETE = '^src/[^/]+/(sqlite-[^/]+|default-[^/]+|[^/]+-service|[^/]+-route)\\.ts$';
const TESTS = '\\.test\\.ts$|^src/test-support/';

const production = (path) => ({ path, pathNot: TESTS });
const rule = (name, from, to) => ({ name, severity: 'error', from, to });

module.exports = {
  forbidden: [
    rule('common-imports-nothing-else', production(COMMON), { path: '^src/', pathNot: COMMON }),
    rule('infrastructure-imports-only-common', production(INFRASTRUCTURE), { path: '^src/', pathNot: [COMMON, INFRASTRUCTURE] }),
    rule('only-composition-imports-composition', { path: '^src/', pathNot: [COMPOSITION, TESTS] }, { path: COMPOSITION }),
    rule('feature-does-not-import-infrastructure', production(FEATURES), { path: INFRASTRUCTURE }),
    rule('route-or-service-does-not-import-sqlite', production(ROUTE + '|' + SERVICE), { path: '/sqlite-[^/]+$' }),
    rule('route-does-not-import-concrete-service', production(ROUTE), { path: SERVICE }),
    rule('service-does-not-import-route', production(SERVICE), { path: '-route(-configuration\\.interface)?\\.ts$|^src/routes/' }),
    rule('feature-does-not-import-concrete-of-another-feature', production('^src/([^/]+)/'), { path: CONCRETE, pathNot: '^src/$1/' }),
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Without it, an `import type` is dropped before the check and a layer can be crossed through a type unseen.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
