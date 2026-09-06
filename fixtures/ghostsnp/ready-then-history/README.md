# GHOSTSNP ready-then-history pages

Raw GHOSTSNP bytes of one incremental export: the READY frame followed by the history pages.
The last history page carries the GHOSTSNP finish record. The visible screen text at READY is
`history-before-live`.

These bytes were extracted from the `history_then_live` scenario of
`@trybotster/hub-test-support@0.1.43` (`late-attach-history-conformance-fixture.json`,
conformance fixture revision 48). Only the GHOSTSNP
payload bytes were kept; the retired JSON envelope was not.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `00-ready.bin` | 2838 | `fbcdda31d682a61420251eed68f72e413485f057e3f374c57582955b0316bb6d` |
| `01-history.bin` | 3365 | `b1b65d9d205f10a2cce4384ea15f0b6b20ee07bb3fda8e3bbdb8bd81dffb071f` |
| `02-history.bin` | 10 | `6e0bfa87315d3225b0dedaa88387eb37c5cb31922b7891741445114bf19a3085` |

These bytes remain valid only while the GHOSTSNP snapshot format is current. Hub's v9
test-support fixture update must confirm that provenance; replace the pages if the format changed.
