// TypeScript 6 checks side-effect imports by default
// (noUncheckedSideEffectImports), and Next's own types only declare CSS
// modules. This covers the plain stylesheet import in app/layout.tsx.
declare module '*.css';
