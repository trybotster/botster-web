# Vendored Restty

Built from approved `trybotster/restty` main commit
`3d2c13efa8775210fbed493a274abf11095b0093` (full `build:wasm` + `build`).

This commit is at or after the plan floor
`448497041a4d0e8617662c568ae73f246b3a805f` and includes GHOSTSNP-only
`loadBinarySnapshot`, `appOptions.readOnly` query mute (WASM drain +
`suppressQueryReplies` for OSC 10/11/12 / DA / DSR), mouse/Kitty rehydrate,
and mounted browser grid restoration after GHOSTSNP import.

This revision also provides the shared `ResttySnapshotReader` API. The API
paints at READY, applies each PAGE in order, and reports FINISH only for
Ghostty `NO_VALUE`.

The fork package points at `dist/` but does not commit that directory or define an
npm `prepare` script, so this repo vendors the built distributable files together.
Keep `restty.js`, `xterm.js`, and every emitted `chunk-*.js` in this directory so
relative imports continue to resolve without a Vite alias.
