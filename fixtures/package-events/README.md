# Package-events live fixture

Isolated Hub package named `project-pipelines` for botster-web live proof of
transient `question.opened` consumption.

## Source commits

- Producer path: `botster-hub` `examples/event-plane-producer` at `7a09292`
  (manifest `events.emitted` plus a handler that calls `events.emit(name, payload)`
  in the plugin worker VM).
- Event contract: `botster-project-pipelines` `question.opened` payload schema
  from `beaba94`, carried verbatim in this package manifest.
- Identity join: Project Pipelines **0.4.0** at `cd7c2f9` publishes optional
  `run_step.agent_session_uuid`. This fixture mirrors that `run_step` / `run`
  record shape. A `run_step` without the field resolves no identity.

## Bindings

The matching `project-pipelines.run_step` record binds `agent_session_uuid` to
the harness production session `web-prod`. The mismatch emit uses a different
`run_id` and `ticket_id` with the same `step_id`. The production filter must
reject that conflict because step IDs repeat across runs.

Durable question rows live on `project-pipelines.question` and are committed
before `events.emit`.

The forced-gap lane sets `BOTSTER_HUB_TEST_CLIENT_EVENT_QUEUE_MAX` on the
isolated hub child. Hub applies that limit only when `BOTSTER_ENV=test`; the
harness sets that variable on the hub process, not on the browser.
