# Vendored Restty

Built from approved `trybotster/restty` commit
`59c640488f33b10296875471691e43da6890e074` with `bun run build:wasm`
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

The fork package points at `dist/` but does not commit that directory or define
an npm `prepare` script. This repository therefore vendors the complete built
distribution. Keep `restty.js`, `xterm.js`, and every emitted `chunk-*.js` in
this directory so relative imports resolve without a Vite alias.
