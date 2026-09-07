# GHOSTSNP ready-then-history pages

Raw GHOSTSNP bytes of one incremental export: the READY frame followed by the history pages.
The last history page carries the GHOSTSNP finish record. The visible screen text at READY is
`history-before-live`.

These bytes are the GHOSTSNP payloads of the `history_then_live` sequence in
`@trybotster/hub-test-support@0.1.45` (`late-attach-history-conformance-fixture.json`,
conformance fixture revision 49, Hub 3fd9905, vendored at `test-support/hub-test-support`).
Hub copies them unchanged from the Core-owned v2 `.ghostsnp` goldens at Core a931125 with
Ghostty eb72ec6 provenance. Only the GHOSTSNP bytes were kept; the scheme 2 body header was not.
They were first extracted from revision 48 of the same fixture; the revision 49 bytes are identical.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `00-ready.bin` | 2838 | `fbcdda31d682a61420251eed68f72e413485f057e3f374c57582955b0316bb6d` |
| `01-history.bin` | 3365 | `b1b65d9d205f10a2cce4384ea15f0b6b20ee07bb3fda8e3bbdb8bd81dffb071f` |
| `02-history.bin` | 10 | `6e0bfa87315d3225b0dedaa88387eb37c5cb31922b7891741445114bf19a3085` |
