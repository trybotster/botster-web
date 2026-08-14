# Web: consume independent terminal and Hub control protocol planes

## Target repository and target

- Repository: `trybotster/botster-web`
- `target_id`: `tgt_40abcf71ccf049f4ac0c99953a799869`
- Spawn target name: `booster-web` (Hub label); filesystem and GitHub identity are `botster-web`
- Assigned worktree: the Project Pipelines worktree for `ticket_1786661008_897067`
- Repository playbook: [[botster-web-playbook]]
- Botster layers: Ionic React client, WebRTC connection lifecycle, generated host DTO consumption, Restty renderer integration, packaged-browser and live-Hub conformance
- Runtime-teardown class: **yes**. This ticket changes WebRTC DataChannel Hello, terminal-frame delivery, subscription/generation attach recovery, and terminal-state vs live-runtime behavior.

Do not infer the repository from the ambient process directory. Routing used `list_spawn_targets` against ticket `target_id`.

## Plan Review response

| Finding | Response |
| --- | --- |
| `finding_1786724157_225337` Formalize publish prerequisites | Resolved. All five dependency edges are closed. |
| `finding_1786724157_411789` Do not defer slow-client proof | Resolved. Typed `daemon_event` close is required. |
| `finding_1786724157_149169` Sibling and timeout tests | Resolved. Live oracles are in Acceptance. |
| `finding_1786744503_854482` Rust-only host helper | Replace `for_webrtc_terminal_subscription_closed()` with a Web-owned literal `DaemonCompatibilityRequirement` built from published hub-test-support metadata plus explicit host feature strings. Do not import Rust helpers. |
| `finding_1786744503_480497` Stale pre-publication statements | Removed. One package state: `0.1.0` + `0.1.36`. |

## Playbooks and notes loaded

### Role and charter

- [[planner-playbook]]
- [[botster-planner-playbook]]
- [[botster-web-playbook]]
- [[botster-architecture]]
- [[cli-patterns]]
- [[spa-patterns]]
- [[botster runtime teardown lenses]]
- [[project-pipelines-playbook]] — workflow overlay. This visit registers blocking ticket dependencies and must not drop them to unfreeze Plan Review.

This ticket does not change Project Pipelines package or plugin implementation paths. The overlay applies because Plan Review finding `finding_1786724157_225337` is workflow-policy: durable dependency edges vs prose caveats.

This ticket is not a consumer of Hub session-type eligibility work. Parent is Hub WebRTC adapter admission, not session-type pins. Do not inject `list_session_types_for_target` / spawn Option A.

### Targeted atomic notes

Protocol planes and pins:

- [[public protocol versions host control and Core terminal planes independently]]
- [[Core terminal protocol separates Hub-safe envelopes from client semantic bodies]]
- [[botster terminal v1 starts at protocol 1 and conformance revision 1]]
- [[ready then history is a compatibility feature not an Attach field]]
- [[ready then history cutover uses Hub test support version 0.1.33]]
- [[proposed each protocol plane owns its compatibility descriptors]] — proposed only; do not treat as ratified. The ticket still forbids Hub-owned terminal feature definitions on Web.
- [[additive daemon capabilities do not raise the default client requirement]]
- [[closed dependency tickets signal merged source not a consumable release]]
- [[hub generated protocol changes are a four site release chain]]
- [[botster web generated protocol drift checks need explicit hub artifact paths]]
- [[botster web pinned hub test support claims span readme and architecture docs]]
- [[botster web dto field names must match authoritative rust serde structs]]
- [[generated typescript dtos must encode serde field optionality]]
- [[cross repo dependency registration must use dependency repo target]]
- [[plan review must verify unmerged unregistered ticket dependencies]]
- [[plan review must verify baseline test execution and register blocking dependencies]]
- [[project pipelines mcp create calls can time out after committing]]
- [[review dependency livelocks stop by asking human and submitting without advance]]

Handshake, attach, decoder:

- [[WebRTC terminal admission requires an encrypted DataChannel Hello]]
- [[Unix Hello can reject terminal admission while host operations remain available]]
- [[incremental GHOSTSNP uses one decoder per subscription]]
- [[incomplete history status aborts the client decoder after READY]]
- [[Web paints GHOSTSNP READY while attach remains Attaching]]
- [[incremental GHOSTSNP clients defer resize and input until FINISH and attached]]
- [[botster web attach installs GHOSTSNP before buffered live bytes]]
- [[Web terminal drain awaits each event consumer]]
- [[botster terminal attach owns one size snapshot and live output transaction]]
- [[incremental browser attach proof uses the authentic Restty reader]]
- [[production incremental reader tests must cover the public handle swap path]]
- [[incremental READY handle swap must restore canvas pixel size]]
- [[incremental resize gating covers both the WASM grid and PTY sink]]
- [[GHOSTSNP READY terminal stays usable after a later history failure]]
- [[post READY history failure omits FINISH and still attaches]]
- [[pre READY attach failed ends client hydration]]
- [[canceling incremental attach aborts the decoder and sends Detach]]

Reconnect and teardown:

- [[a page reload is not a reconnect]]
- [[botster browser pull requests must retry after webrtc reconnect]]
- [[WebRTC DataChannel local close uses the peer close bound before cleanup]]
- [[terminal webrtc failure records do not prove peer runtime teardown]]
- [[webrtc peer cleanup removes every per peer owner together]]
- [[a ready WebRTC send must win over a queued DataChannel close]]
- [[Core terminal subscription ownership is session, subscription, and generation]]
- [[Core ClientWorker bind requires a live attach generation]]
- [[Core subscription hard-stop is synchronous close and drop on the host tick]]
- [[offline peer claims require the data channel to stay closed]]

Planning hygiene:

- [[pipeline vault checklists must cite exact resolvable note titles]]
- [[plan agents must author vault context as wikilinks not home paths]]
- [[vault example paths are not repository placement conventions]]
- [[botster orchestration should spawn agents with explicit target ids]]
- [[botster orchestration prompts must bind agents to explicit worktrees]]
- [[botster pipeline needs continuous product owner between agent steps]]
- [[live packaged harness failures are scoped to the active mode branch]]
- [[the shared hub browser driver is the live packaged protocol harness behind a shim]]
- [[botster web request caches belong in react query not zustand or hub session getters]]

## Context loaded

- Ticket: `ticket_1786661008_897067`, “Web: consume independent terminal and Hub control protocol planes.”
- Run: `run_1786722987_966285`; Plan revisit after Plan Review `changes_required` (`review_1786724157_143037`).
- Open findings addressed: `finding_1786724157_225337`, `finding_1786724157_411789`, `finding_1786724157_149169`.
- Project: Botster Terminal Transport North Star. Direct-merge. No PRs.
- Closed parent: `ticket_1786661008_247079` on Hub (`tgt_7e208a0c76a44980a83b63af976b1f22`), “Hub: bind content-blind WebRTC terminal adapters at admission.”
- Durable blocking dependencies, all **closed**:
  - `ticket_1786723347_177328` on Core (`tgt_1f7bce66eb304881980f9b4a2a5ae3fe`): published `@trybotster/terminal-protocol@0.1.0`.
  - `ticket_1786723348_522242` on Hub (`tgt_7e208a0c76a44980a83b63af976b1f22`): published adapter host DTOs.
  - `ticket_1786724303_284888` on Hub: WebRTC `TerminalSubscriptionClosed` emission.
  - `ticket_1786730686_674642` on Hub: published `@trybotster/hub-test-support@0.1.36` with negotiated `daemon_event` close delivery. Merged to Hub main at `279d828ca377d23e743ae3e724a1ac9ce81520e2`.
- Registry content check (this visit): `@trybotster/terminal-protocol@0.1.0` has `botster-terminal-v1`, `TerminalCompatibilityRequirement`, `TerminalEvent`, and `snapshot_delivery=ready_then_history`. `@trybotster/hub-test-support@0.1.36` is protocol 7 / conformance 41 and contains `daemon_terminal_frame`, `daemon_event`, `terminal_compatibility`, and `terminal_subscription_closed`. UI contract remains `0.3.2`.
- Sibling consumer, not this run: `ticket_1786661009_551067` (TUI). Do not edit TUI.
- Open Hub cold-cut, not this run: `ticket_1786661010_198387`. Web must accept the documented one-frame transitional `AttachState attaching` on the Attach response until that ticket removes it. Do not keep Drain translation as a production fallback.

### Measured baseline in this worktree

- `package.json` pins `@trybotster/ui-contract@0.3.2` and `@trybotster/hub-test-support@0.1.32`. There is no `@trybotster/terminal-protocol` dependency.
- Registry now has the consumable pins. This worktree still pins `@trybotster/hub-test-support@0.1.32` and has no `@trybotster/terminal-protocol` until Implement.
- Web never sends a DataChannel `DaemonHello`. `src/botster/webrtcDaemonClient.ts` `streamTerminal` still `attach` + timed `drain`. `parseDeliveryChunk` rejects any delivery kind other than `daemon_response` and `daemon_entity_frame`.
- `requiredDaemonFeatures` in `src/botster/connectionDiagnostics.ts` still lists Hub-owned terminal tokens: `terminal_streaming`, `resize`, and `snapshot_delivery=ready_then_history`.
- `src/botster/hubTerminalDataPlane.ts` already has one Restty reader per hydration/generation, READY paint while Attaching, PAGE/FINISH gates, degraded history, input/resize barriers, and surviving-document WebRTC recovery. It still consumes Hub-translated Drain `DaemonEvent`s, not Core `TerminalEvent` JSON from `daemon_terminal_frame`.
- Hub `docs/client-protocol.md` names this ticket: WebRTC clients that omit DataChannel Hello stay on Drain translation until the Web decoder ticket.

## Product decision ledger

| Class | Decision |
| --- | --- |
| Default | Adopt the WebRTC adapter path. Send encrypted DataChannel Hello. Decode Core terminal frames. Stop using Drain for terminal bodies. |
| Default | Pin published protocol package versions. Do not pin a Hub Git revision for terminal compatibility. |
| Default | Compose two handshakes from **published npm artifacts**, not Rust crate helpers. Host Hello must require both `webrtc_terminal_adapter` and `terminal_subscription_closed`. |
| Default | Consume `terminal_subscription_closed` only from `daemon_event` deliveries. Do not decode that event from Drain or `daemon_terminal_frame`. |
| Non-goal | Hub cold-cut of the transitional Attach `attaching` frame. |
| Non-goal | Unix mux, TUI, TUI Kit, Restty rewrite, or a runtime flag that keeps Drain translation. |
| Non-goal | Raising the default host requirement for all clients. `webrtc_terminal_adapter` is optional advertised support; only Web’s Hello requires it. |
| Follow-up-ok | None for slow-client. The typed WebRTC close oracle is a registered Hub dependency, not a later caveat. |
| Ask-human | None. Ticket + Hub client-protocol text resolve Drain vs adapter. |

## Scope

1. Pin the verified published coordinates:
   - `@trybotster/terminal-protocol@0.1.0` for Core terminal types, feature tokens, compatibility descriptors, and the ready-then-history event-order fixture.
   - `@trybotster/hub-test-support@0.1.36` for host DTOs (`DaemonHello.terminal_compatibility`, `daemon_terminal_frame`, `daemon_event`, `webrtc_terminal_adapter`, `terminal_subscription_closed`, conformance 41).
   - Keep `@trybotster/ui-contract@0.3.2`. A Core terminal capability change must not require a UI-contract or host-control repin after this cutover.
2. Copy the published hub-test-support `daemon-protocol.ts` into `src/botster/generated/daemon-protocol.ts`. Do not hand-author host DTOs.
3. Split handshake composition. `@trybotster/hub-test-support@0.1.36` publishes DTO types, `metadata`, and fixtures only. It does **not** export `DaemonCompatibilityRequirement::for_webrtc_terminal_subscription_closed()` or host feature constants. Web must not call that Rust helper.

   Host Hello `compatibility` is this exact TypeScript object (plus the listed host-only features). Feature strings are literals that match `first-party-client-support-matrix.json` and Hub `docs/client-protocol.md`. Protocol identity comes from published hub-test-support `metadata`:

   ```ts
   import { metadata as hubMetadata } from "@trybotster/hub-test-support";
   import {
     PROTOCOL as TERMINAL_PROTOCOL,
     PROTOCOL_VERSION as TERMINAL_PROTOCOL_VERSION,
     CONFORMANCE_FIXTURE_REVISION as TERMINAL_CONFORMANCE,
     FEATURE_TERMINAL_STREAMING,
     FEATURE_RESIZE,
     FEATURE_SNAPSHOT_DELIVERY_READY_THEN_HISTORY
   } from "@trybotster/terminal-protocol";

   const hostCompatibility = {
     protocol: hubMetadata.protocol, // "botster-hub-daemon-v1"
     protocol_version: hubMetadata.protocol_version, // 7
     required_features: [
       "sessions",
       "terminal_readback",
       "plugin_surface_render",
       "plugin_surface_action",
       "mode_gated_input",
       "webrtc_terminal_adapter",
       "terminal_subscription_closed"
     ],
     minimum_conformance_fixture_revision: hubMetadata.conformance_fixture_revision, // 41
     client_name: "botster-web"
   };

   const terminalCompatibility = {
     protocol: TERMINAL_PROTOCOL,
     protocol_version: TERMINAL_PROTOCOL_VERSION,
     required_features: [
       FEATURE_TERMINAL_STREAMING,
       FEATURE_RESIZE,
       FEATURE_SNAPSHOT_DELIVERY_READY_THEN_HISTORY
     ],
     minimum_conformance_fixture_revision: TERMINAL_CONFORMANCE,
     client_name: "botster-web"
   };
   ```

   - Remove `snapshot_delivery=ready_then_history`, `terminal_streaming`, and `resize` from host `requiredDaemonFeatures` in `connectionDiagnostics.ts`.
   - Unnegotiated protocol-7 clients must never receive `daemon_event`. Web must list `terminal_subscription_closed` on the host Hello so Hub will send it.
   - Do not add a Hub ticket to export the Rust helper. The published metadata + literals are enough.
4. After AES-GCM is ready, send encrypted DataChannel `DaemonHello` before Attach. Treat `DaemonHelloAck.compatibility` and `DaemonHelloAck.terminal_compatibility` as independent results. A terminal mismatch is a typed diagnostic and must not take down host operations on the same peer.
5. Replace `streamTerminal` Drain translation:
   - `Attach` remains `{ session_id, subscription_id }`.
   - Accept the transitional Attach-response `attach_state=attaching` only.
   - Fail closed if that Attach response contains Snapshot, later AttachState, TerminalOutput, or ProcessExited.
   - Assemble `daemon_terminal_frame` chunks, decrypt, and parse JSON as Core `TerminalEvent`s.
   - Assemble `daemon_event` chunks the same way as entity frames (no pending request). Decrypt as host `DaemonEvent`. The only required variant for this ticket is `terminal_subscription_closed`.
   - Do not request Drain for terminal bodies. If a host-lifecycle Drain remains, it must reject any terminal-body event.
6. Keep one Restty incremental reader per subscription generation. READY, every PAGE, and FINISH must use that same reader. A lost PAGE, decode failure, or `attach_failed` before READY aborts that reader, detaches that generation, mints a new subscription id, and starts a fresh Attach. Never replay a terminal frame into a previous decoder.
7. Preserve current Restty behavior: READY paint while Attaching, PAGE order, degraded history keeps READY, input/resize gated until FINISH or `snapshot_history_incomplete` plus Attached, GHOSTSNP install before buffered live output, surviving-document reconnect, explicit Detach on cancel.
8. Consume `terminal_subscription_closed` only from `daemon_event` after Hello required `terminal_subscription_closed`. Do not invent a Web-only close heuristic and do not decode that event as a terminal body. Handle it by generation: close N must not destroy N+1. Slow-client proof uses `reason=core_adapter_closed` while the DataChannel stays readable. `host_adapter_closed` is host egress close, not the Core write-budget oracle.
9. Prove sibling isolation and bounded teardown on the production path (see Acceptance).
10. Update unit/component tests, incremental attach browser smoke, live packaged protocol harness, README, and `docs/architecture.md` so the production entry point is Hello + `daemon_terminal_frame`, not Drain.

## Non-scope

- Publishing npm packages from this Web run.
- Editing botster-core, botster-hub, botster-tui, botster-tui-kit, or botster-workspaces.
- Completing Hub cold-cut `ticket_1786661010_198387`.
- Adding Hub-owned terminal feature tokens, Hub Snapshot-phase branches, or a dual Drain/adapter runtime switch.
- Changing UiNode, plugin surfaces, React Query caches, or Workspaces proofs except where terminal handshake/reconnect forces shared-harness updates.
- Inventing a TypeScript `TerminalFrame.from_bytes` in Core. The published package is types-only; Web parses the documented JSON event tags with Core types.

## Repository ownership boundaries and cross-repo dependencies

| Owner | Owns | Does not own |
| --- | --- | --- |
| botster-web | Hello composition, `daemon_terminal_frame` and `daemon_event` assembly, Core event parse, one Restty decoder per subscription, hydration/reconnect, browser proof | Terminal protocol types, adapter bind, host policy, Restty engine truth |
| Core | `@trybotster/terminal-protocol`, feature tokens, Snapshot/AttachState/Output/Exit types, ClientWorker queue and slow-client | Browser Hello, WebRTC chunking, Ionic UI |
| Hub | Admission, grants, content-blind WebRTC adapter, `daemon_terminal_frame` writes, host `DaemonCompatibility`, `terminal_subscription_closed` | Snapshot body inspection, Restty decode, Web feature lists |
| UI contract | UiNode/action vocabulary | Terminal compatibility |

Cross-repo dependencies, registered on the owning targets:

| Ticket | Target | Why this run cannot absorb it |
| --- | --- | --- |
| `ticket_1786661008_247079` (closed) | Hub | Adapter bind exists in Hub source |
| `ticket_1786723347_177328` (closed) | Core | `@trybotster/terminal-protocol@0.1.0` is on npm |
| `ticket_1786723348_522242` (closed) | Hub | Adapter host DTO publish landed |
| `ticket_1786724303_284888` (closed) | Hub | WebRTC emits `TerminalSubscriptionClosed` |
| `ticket_1786730686_674642` (closed) | Hub | `@trybotster/hub-test-support@0.1.36` ships `daemon_event` close negotiation |

Implement must consume published registry artifacts `@trybotster/terminal-protocol@0.1.0` and `@trybotster/hub-test-support@0.1.36`. Sibling checkouts and `file:` pins are not default CI evidence.

## Assumptions and unknowns

- Assumption: Hub `docs/client-protocol.md` is the shipped adapter contract. This Web ticket is the decoder/Hello consumer named there.
- Assumption: `daemon_terminal_frame` plaintext is Core `TerminalFrame` JSON (`snapshot`, `terminal_output`, `process_exit`, `attach_state`) after AES-GCM decrypt.
- Assumption: Host `webrtc_terminal_adapter` is a transport-admission feature, not a Core terminal token. It stays on the host Hello.
- Assumption: The transitional Attach `attaching` event remains until Hub cold-cut. Web accepts that one control-plane exception and no others.
- Known: Hub sends `TerminalSubscriptionClosed` only as `daemon_event`, and only after Hello required `terminal_subscription_closed`. `host_adapter_closed` is not the Core write-budget oracle.
- Known: live Hub pin for this consumer is Hub main `279d828ca377d23e743ae3e724a1ac9ce81520e2` plus the two npm coordinates above.

## Affected surfaces and files

Expected Web-owned edits (exact set may shrink after published artifacts land):

- `package.json`, `package-lock.json` — pin published protocol packages
- `src/botster/generated/daemon-protocol.ts` — copy published host artifact
- `src/botster/connectionDiagnostics.ts` — split host vs terminal compatibility; host feature list uses the literals above, not Rust helpers
- `src/botster/webrtcDaemonClient.ts` — Hello, `daemon_terminal_frame` assembly, stop terminal Drain
- `src/botster/hubTransport.ts` — stream handle contract
- `src/botster/hubTerminalDataPlane.ts` — Core `TerminalEvent` consume, lost-page fresh attach, generation-tagged close
- `src/botster/realHubDaemonDto.ts` — re-export published host types only
- `src/App.test.mjs` — handshake literals (`webrtc_terminal_adapter`, `terminal_subscription_closed`), delivery-kind, no-replay, no import of a Rust helper name
- `src/botster/incrementalGhostsnpAttachSmoke.ts` and `scripts/incremental-ghostsnp-attach-browser-smoke.mjs` — Core fixture/types; authentic Restty reader
- `scripts/check-daemon-protocol-drift.mjs` — still compares vendored host protocol to published hub-test-support
- `scripts/live-packaged-protocol-harness.mjs` — live adapter proof; reconnect remains `closeDataChannel`, not reload
- `README.md`, `docs/architecture.md` — production path is Hello + terminal frames, not Drain
- This plan file

Do not add Hub-specific Snapshot-phase switches outside Core event tags and Restty reader progress.

## Implementation sequence

1. Confirm both publish tickets are closed and the registry tarballs contain the required tokens. Fail closed otherwise.
2. Install the published pins. Copy host `daemon-protocol.ts`. Keep UI contract `0.3.2`.
3. Add a dedicated encrypted Hello send/ack path. First encrypted send after crypto must be Hello, not Attach. Reuse the pending-response assembly so HelloAck is a `daemon_response` bound to that Hello, not an orphan chunk.
4. Validate host and terminal compatibility independently. Surface a compatibility diagnostic on terminal mismatch. Keep entity subscribe, status, and other host RPCs available.
5. Change `parseDeliveryChunk` to accept `daemon_terminal_frame` and `daemon_event`. Assemble both like entity frames: no pending request, generation-tagged, bounded, ordered chunks.
6. Dispatch completed terminal frames through the existing serial `hubTerminalDataPlane` queue. Await each consumer before the next frame ([[Web terminal drain awaits each event consumer]] still applies to the new delivery path).
7. Bind one `createBinarySnapshotReader` per subscription generation. Lost PAGE / unknown progress / pre-READY `attach_failed` → cancel reader, Detach that generation, new subscription id, new reader, Attach. Prove no replay.
8. Keep transport-loss recovery: abandon the dead channel without Detach, wait for `encrypted-stream-ready`, then Hello again and fresh Attach. Document-surviving reconnect only ([[a page reload is not a reconnect]]). Replay React Query / entity pulls as today.
9. Update tests and live harness. Ablate the new Hello or `daemon_terminal_frame` handler and show the live proof goes red.

## Runtime-teardown answers

| Field | Answer |
| --- | --- |
| `teardown_class_applies` | Yes. WebRTC Hello/peer lifecycle, subscription/generation attach, decoder vs live runtime, reconnect, slow-client, and ProcessExited are in scope. |
| `teardown_isolation` | One terminal subscription generation owns one Restty reader, one attach barrier, and one inbound frame listener. Peer loss closes every terminal subscription on that peer together with entity subscriptions on that peer. A failed terminal subscription must not close a sibling session subscription on the same live peer. Host operations stay up after terminal compatibility rejection. |
| `teardown_bounds` | Web request/assembly already times out and fails the peer generation. Hello, Attach, and terminal-frame assembly must use the same bounded wait. Do not add an unbounded Drain poll. On timeout, abandon the generation, cancel the reader, and fail closed. Hub’s `LOCAL_WEBRTC_PEER_CLOSE_BOUND` remains Hub-owned; Web must not wait on Hub close. |
| `late_message_matrix` | See table below. |
| `production_path_proof` | Live packaged browser path: grant → crypto → Hello (requires `webrtc_terminal_adapter` + `terminal_subscription_closed`) → HelloAck → Attach → transitional attaching → `daemon_terminal_frame` READY/PAGE/FINISH → Attached → live output → `daemon_event` `terminal_subscription_closed` or Detach. Reconnect proof closes the real DataChannel in place. Slow-client proof observes `daemon_event` with `reason=core_adapter_closed`. Timeout proof induces a hung Hello/Attach/`daemon_terminal_frame`/`daemon_event` assembly and shows the production timeout handler abandon that generation. |
| `ownership_identity` | `(session_id, subscription_id, attachmentGeneration)` on Web, matching Core `(session_id, subscription_id, generation)` when the host event carries generation. Reused subscription ids after teardown increment generation. Close for N must not delete N+1. |
| `sibling_fail_closed_policy` | Successful close or Core write-budget close of one subscription: siblings keep receiving frames. Ultimate peer close/failure: all subscriptions on that peer die; a new peer generation Hello/Attach recovers. No silent sibling sacrifice. |

### Late-message admission matrix

| Message | Grant / owner tag | Reject after terminal failure | Residual sweep if it races PeerClosed |
| --- | --- | --- | --- |
| DataChannel `DaemonHello` | Current peer generation after pairing, grant, origin, AES-GCM | Ignore Hello for a closed generation; do not bind routes | Drop in-flight HelloAck; no route created (Hello never creates a route) |
| `Attach` | `session_id` + new `subscription_id` after successful Hello with `webrtc_terminal_adapter` | Reject/ignore if peer dead, Hello missing/rejected, or generation stale | Detach only if this generation still owns the route; otherwise abandon |
| `Detach` | Same session + subscription + live generation | Best-effort; detach rejections must not throw | No new decoder or attach |
| `send_input` / `resize` / `mode_gated_input` | Live generation after FINISH/incomplete + Attached | Drop if generation stale or barrier incomplete | Do not apply to a replacement generation |
| `daemon_terminal_frame` | Assembled under current `peerGeneration` and subscription id | Drop if generation stale, subscription replaced, or reader cancelled | Never feed a replacement decoder |
| `daemon_event` / `terminal_subscription_closed` | Hello required `terminal_subscription_closed`; tag is session + subscription + generation | Ignore if generation ≠ live owner | Must not delete a newer live generation |
| Transitional Attach `attaching` | Attach response for that subscription | Any other terminal body on Attach is fail-closed | No replay |
| `terminal_subscription_closed` | `session_id`, `subscription_id`, `generation` | Ignore if generation ≠ live owner | Must not delete a newer live generation |
| `subscribe_entities` / entity frames | Entity subscription id + peer generation | Existing entity reject/resync rules | Existing peer-reset sweep |
| Drain (if kept) | Host lifecycle only | Fail closed on Snapshot / AttachState / TerminalOutput / ProcessExited | Do not recreate terminal ownership |

## Risks

- Implement vendors a sibling Hub tree instead of `@trybotster/hub-test-support@0.1.36` / `@trybotster/terminal-protocol@0.1.0`. Reject that.
- Keeping the Drain loop “just in case” recreates Hub-translated terminal logic and will break at Hub cold-cut.
- Host Hello still requiring `snapshot_delivery=ready_then_history` leaves Core capability changes coupled to Hub control pins.
- `parseDeliveryChunk` rejecting `daemon_terminal_frame` or `daemon_event` will fail the peer as soon as Hub binds the adapter or emits a close.
- Lost-page recovery that reuses the same Restty reader or replays buffered frames violates the Core no-replay rule.
- Reconnect tests that reload the document will miss missing Hello-on-recover.
- Slow-client “proof” that only shows output stopping is residual, not live.
- README/architecture pin claims must stay paired if they name exact package versions ([[botster web pinned hub test support claims span readme and architecture docs]] is dormant unless those claims return; if they return, update both docs).

## Acceptance checks and tests

Repository gates:

- `npm test` including `scripts/check-daemon-protocol-drift.mjs` against the **published** hub-test-support artifact, not a skipped sibling override.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run smoke:incremental-ghostsnp-attach` through `createBinarySnapshotReader` with authentic READY/PAGE/FINISH. READY must paint before FINISH.
- `npm run smoke:browser-runtime`
- `npm run smoke:live-packaged-protocol` against a Hub binary that includes the closed WebRTC adapter work **and** `ticket_1786724303_284888`.

Live / authentic browser proof required by the ticket:

- READY before FINISH, PAGE order, live output, detach, in-place reconnect, degraded history, ProcessExited, slow-client failure.
- Lost snapshot page starts a fresh Attach and never replays a terminal frame into the previous decoder.
- A Core terminal token/fixture change would require only the `@trybotster/terminal-protocol` pin, not `@trybotster/ui-contract` or a Hub Git revision. Prove by source: terminal tokens imported from the Core package; host Hello no longer lists those tokens.
- Reconnect: stamp `globalThis`, `closeDataChannel()`, observe a new peer generation Hello + Attach, and ablate the recovery listener so the new assertion is the first failure.
- Request-race / SPA request-state: overlapping attach/recover/detach still correlate by generation; stale input/resize/HelloAck cannot attach a dead generation.
- Negative: after adapter Hello, Drain (if present) returns no terminal bodies.
- Negative: omitting Hello keeps current Drain only in old binaries; this branch must not ship a dual production path. New Web requires Hello.
- Independent Plan Review base re-verification: Review reruns typecheck/test/drift against published artifacts on the worktree, not planner summaries.

Runtime-teardown live oracles (required; not follow-up):

- **Slow-client:** On one live WebRTC peer, attach sessions A and B. Induce Core write-budget hard-stop on A without stopping the DataChannel reader. Production Web must observe a `daemon_event` `terminal_subscription_closed` with `reason=core_adapter_closed`, `session_id`/`subscription_id`/`generation` matching A. Cancel A's reader. Do not treat “A went quiet” or `host_adapter_closed` as the Core oracle.
- **Sibling isolation:** While A closes, B continues to receive `daemon_terminal_frame` and remains attached. No A frame enters B's decoder. Host operations on the same peer stay available.
- **Stale-generation close:** After A is replaced by A′ (new subscription/generation), a delayed close or late `daemon_terminal_frame` tagged with generation N is dropped. A′ stays attached.
- **Bounded Hello/Attach/frame-assembly hang:** Harness holds HelloAck assembly, Attach response assembly, or `daemon_terminal_frame` assembly past the production request timeout. The production handler (`failPeerGeneration` / generation abandon / reader cancel) must fire. Control-plane work on that peer must not hang unbounded.
- **Timeout ablation:** Remove or skip the production timeout cleanup call site. The timeout assertion must become the first failure. Identical nonzero exits with and without the cleanup do not count.

Downstream charter proof:

- Production entry points are `createWebrtcDaemonClient` Hello and `HubTerminalDataPlane` consuming `daemon_terminal_frame`. Incremental smoke and live harness must drive those paths.
- Do not treat unit presence of types as done.

## Vault gaps worth capturing

- Optional later capture: WebRTC close is a negotiated host `daemon_event`, not Drain, and Web builds host Hello from published metadata plus feature literals because hub-test-support does not export Rust helpers.

No inbox capture this visit. Package state is `@trybotster/terminal-protocol@0.1.0` and `@trybotster/hub-test-support@0.1.36`.

## Worktree hygiene

- Tracked `.gitignore` has content; do not truncate or rewrite it.
- Worktree path has no `:`. No `CARGO_TARGET_DIR` override is required for this npm repo.

## Implement block

All formal dependencies are closed and the registry artifacts exist. Implement may start after this plan is approved.

Implement pins:

- `@trybotster/terminal-protocol@0.1.0`
- `@trybotster/hub-test-support@0.1.36`
- live Hub ≥ `279d828ca377d23e743ae3e724a1ac9ce81520e2`

Then implement only in the routed botster-web worktree and merge directly to main. Do not create a PR.
