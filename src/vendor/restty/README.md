# Vendored Restty

Built from `trybotster/restty` commit `e9742252312ee616d8f186b697d70349cf329250`.

The fork package points at `dist/` but does not commit that directory or define an
npm `prepare` script, so this repo vendors the built distributable files together.
Keep `restty.js`, `xterm.js`, and every emitted `chunk-*.js` in this directory so
relative imports continue to resolve without a Vite alias.
