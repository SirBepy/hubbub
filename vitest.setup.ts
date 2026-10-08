// The apps set `__HUBBUB_DEV_LOADER__` through a bundler `define` (vite.sandbox-mode.ts); vitest
// has no bundler, so the identifier resolves as a global and the dev-loop value is the default.
// A global rather than a vitest `define` keeps it overridable per file: a test stubs it false with
// `vi.stubGlobal` before importing an app module to reach the sandbox branch.
(globalThis as { __HUBBUB_DEV_LOADER__?: boolean }).__HUBBUB_DEV_LOADER__ = true;
