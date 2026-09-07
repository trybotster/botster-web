# Vendored Restty

Built from approved `trybotster/restty` commit
`71fbfeb9cbd356b112c922d101a94bab7413675d`.

The JavaScript distribution came from the reviewed source checkout with
`bun run build`. The build left `bun.lock` and `package.json` unchanged. The
lockfile pin is `text-shaper@0.1.18`. The build did not rebuild the WASM. The
blob embedded in the emitted chunk matches Restty's committed `src/wasm/embedded.ts`
SHA-256 `e84ec527a0d47d8cb869c15c965280f838e86578a52e9061a69dceac641cb527`
(680783 bytes).

The checkout had unrelated existing changes under `reference/ghostty` and in
`.env` and `mise.local.toml`. These changes did not enter the source commit or
the distribution inputs.

The Restty-pinned `trybotster/ghostty` commit remains
`eb72ec61304ea256be1d86ed8fa961c84e43ecbd`. The earlier WASM build used Zig
`0.16.0` and the default `ReleaseSafe` optimize mode.

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

Commit `71fbfeb9c` adds the read-only `getScreenText()` API. It returns a new
string for the visible terminal grid. It skips wide-cell tails, preserves
combined graphemes, and trims trailing spaces and tabs from each row.

The focused screen-text test, type check, lint, format check, and distribution
build passed. The full CI-safe test run passed 218 tests and failed eight
existing WASM graphics, scrollback, and search tests. Controlled six-file runs
at parent commit `cd1911d0f` and current commit `71fbfeb9c` each passed nine
tests and failed eight. Both runs had the same failure names and values, Bun
1.4.0, dependencies, and embedded WASM.

The fork package points at `dist/` but does not commit that directory or define
an npm `prepare` script. This repository therefore vendors the complete built
distribution. Keep `restty.js`, `xterm.js`, and every emitted `chunk-*.js` in
this directory so relative imports resolve without a Vite alias.
