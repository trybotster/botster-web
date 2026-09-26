# Package-notice-reaction live fixture

Isolated Hub package named `package-notice-reaction` for botster-web live
proof of descriptor-driven transient notices.

The package declares one session-scoped notice reaction for `sample.notice`.
Matching emits set `payload.subject` to the production session `web-prod`.
Mismatching emits use a different subject. `emit_match` accepts an optional
`payload.notice` text, so a proof can tell its emissions apart. Web subscribes with the viewed
session subject and must not fall back to an empty subject set.

Durable rows live on `package-notice-reaction.item` and are committed before
`events.emit`. They are not the notice targeting mechanism.

This fixture enters the client through encoded Hub frames. Tests must not
inject a decoded `package_event` payload after protocol decoding.
