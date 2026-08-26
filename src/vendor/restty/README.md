# Vendored Restty

Built from approved `trybotster/restty` commit
`cd1911d0f88606270b1457c6995a3c04cb497edf` with `bun run build:wasm`
and `bun run build`.

The WASM build used the Restty-pinned `trybotster/ghostty` commit
`eb72ec61304ea256be1d86ed8fa961c84e43ecbd`, Zig `0.16.0`, and the default
`ReleaseSafe` optimize mode.

The source fixture evidence states that regeneration from this Ghostty pin
produces the existing GHOSTSNP fixture bytes. The browser fixture remains
unchanged at SHA-256
`7aba861353b9d45cf28a128ba48e6e3ab0b0b87610d53e7136a591363cc4fd28`.

This build includes GHOSTSNP snapshot import, `appOptions.readOnly`, and
`suppressQueryReplies` for OSC 10/11/12, DA, and DSR replies. It also includes
mouse and Kitty mode rehydration and incremental snapshot reader support.

This revision adds stateful wheel batching: pixel accumulation across events,
live `getCellHeight` and `getRows` conversion, a row-bounded burst, and a
deferred remainder drain. The three Restty commits are
`90e411592` (accumulate and batch), `3d0847d60` (remainder and touch nits),
and `cd1911d0f` (pace bursts across frames).

The fork package points at `dist/` but does not commit that directory or define
an npm `prepare` script. This repository therefore vendors the complete built
distribution. Keep `restty.js`, `xterm.js`, and every emitted `chunk-*.js` in
this directory so relative imports resolve without a Vite alias.
