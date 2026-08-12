# Vendored Restty

Built from `trybotster/restty` commit `79f633189adc73b8cf5ed4f7c7be1be4a7da35bf` (full `build:wasm` + `build` after GHOSTSNP renderer work).

Minimum plan pin: `448497041a4d0e8617662c568ae73f246b3a805f` (GHOSTSNP import,
`readOnly` query mute, mouse/Kitty rehydrate). This vendor is at or after that
floor.

The fork package points at `dist/` but does not commit that directory or define an
npm `prepare` script, so this repo vendors the built distributable files together.
Keep `restty.js`, `xterm.js`, and every emitted `chunk-*.js` in this directory so
relative imports continue to resolve without a Vite alias.
