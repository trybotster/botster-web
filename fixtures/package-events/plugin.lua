-- Isolated project-pipelines producer for Web package-event live proof.
-- Producer path from Hub examples/event-plane-producer @ 7a09292.
-- question.opened contract from botster-project-pipelines @ beaba94.
-- run_step.agent_session_uuid shape from Project Pipelines 0.4.0 @ cd7c2f9.

local MATCH_RUN_ID = "run_fixture_match"
local OTHER_RUN_ID = "run_fixture_other"
local STEP_ID = "botster_stack_implement"
local MATCH_TICKET_ID = "ticket_fixture_match"
local OTHER_TICKET_ID = "ticket_fixture_other"
local BOUND_SESSION_ID = "web-prod"

local question_seq = 0
local run_seq = 1
local run_step_seq = 1
local questions = {}
local emit_count = 0

local function copy_questions()
  local out = {}
  for _, item in ipairs(questions) do
    out[#out + 1] = {
      id = item.id,
      notice = item.notice,
      status = item.status,
      run_id = item.run_id,
    }
  end
  return out
end

local function run_items()
  return {
    {
      id = MATCH_RUN_ID,
      ticket_id = MATCH_TICKET_ID,
      pipeline_definition_id = "delivery",
      current_step_id = STEP_ID,
      status = "active",
    },
    {
      id = OTHER_RUN_ID,
      ticket_id = OTHER_TICKET_ID,
      pipeline_definition_id = "delivery",
      current_step_id = STEP_ID,
      status = "active",
    },
  }
end

local function run_step_items()
  return {
    {
      id = "run-step-match",
      run_id = MATCH_RUN_ID,
      step_id = STEP_ID,
      status = "active",
      agent_session_uuid = BOUND_SESSION_ID,
    },
    {
      id = "run-step-unbound",
      run_id = OTHER_RUN_ID,
      step_id = STEP_ID,
      status = "active",
    },
  }
end

local function events_surface(_arguments)
  return {
    type = "form",
    id = "package-events-form",
    children = {
      {
        type = "button",
        id = "package-events-emit-match",
        props = {
          label = "Emit matching question",
          action = { id = "package-events.emit_match" },
        },
      },
      {
        type = "button",
        id = "package-events-emit-mismatch",
        props = {
          label = "Emit mismatching question",
          action = { id = "package-events.emit_mismatch" },
        },
      },
      {
        type = "button",
        id = "package-events-emit-burst",
        props = {
          label = "Emit burst",
          action = { id = "package-events.emit_burst", payload = { count = 200 } },
        },
      },
      {
        type = "button",
        id = "package-events-emit-gap-burst",
        props = {
          label = "Emit gap burst",
          action = { id = "package-events.emit_burst", payload = { count = 20 } },
        },
      },
    },
  }
end

local function commit_question(run_id, notice)
  emit_count = emit_count + 1
  local question_id = "question_fixture_" .. tostring(emit_count)
  questions[#questions + 1] = {
    id = question_id,
    notice = notice,
    status = "open",
    run_id = run_id,
  }
  question_seq = question_seq + 1
  return question_id
end

local function emit_opened(run_id, notice, ticket_id)
  local question_id = commit_question(run_id, notice)
  local payload = {
    question_id = question_id,
    kind = "human",
    notice = notice,
    blocking = true,
    run_id = run_id,
    step_id = STEP_ID,
    ticket_id = ticket_id,
  }
  pcall(function()
    events.emit("question.opened", payload)
  end)
  return question_id
end

local function handle_action(request)
  local action_id = request.action_id
  local payload = request.payload or {}

  if action_id == "package-events.emit_match" then
    local question_id = emit_opened(MATCH_RUN_ID, "Matching workflow question", MATCH_TICKET_ID)
    return {
      request_id = request.request_id,
      surface_id = request.surface_id,
      action_id = action_id,
      node_id = request.node_id,
      state = "accepted",
      payload = { question_id = question_id, run_id = MATCH_RUN_ID },
    }
  end

  if action_id == "package-events.emit_mismatch" then
    local question_id = emit_opened(OTHER_RUN_ID, "Mismatching workflow question", OTHER_TICKET_ID)
    return {
      request_id = request.request_id,
      surface_id = request.surface_id,
      action_id = action_id,
      node_id = request.node_id,
      state = "accepted",
      payload = { question_id = question_id, run_id = OTHER_RUN_ID },
    }
  end

  if action_id == "package-events.emit_burst" then
    local count = payload.count
    if type(count) ~= "number" or count < 1 then count = 200 end
    local first_id = commit_question(MATCH_RUN_ID, "Burst workflow question")
    for _ = 1, count do
      pcall(function()
        events.emit("question.opened", {
          question_id = first_id,
          kind = "human",
          notice = "Burst workflow question",
          blocking = false,
          run_id = MATCH_RUN_ID,
          step_id = STEP_ID,
          ticket_id = MATCH_TICKET_ID,
        })
      end)
    end
    return {
      request_id = request.request_id,
      surface_id = request.surface_id,
      action_id = action_id,
      node_id = request.node_id,
      state = "accepted",
      payload = { question_id = first_id, count = count },
    }
  end

  return {
    request_id = request.request_id,
    surface_id = request.surface_id,
    action_id = action_id,
    node_id = request.node_id,
    state = "rejected",
    error = "unknown action",
  }
end

return botster.register({
  handlers = {
    {
      id = "events_surface",
      kind = "surface_route",
      descriptor_id = "project-pipelines.events",
      call = events_surface,
    },
    {
      id = "questions",
      kind = "entity_provider",
      descriptor_id = "project-pipelines.question",
      descriptor = { entity_type = "project-pipelines.question", id_field = "id" },
      call = function(request)
        return {
          type = "entity_snapshot",
          entity_type = "project-pipelines.question",
          snapshot_seq = question_seq,
          items = copy_questions(),
          subscription_id = request.subscription_id,
        }
      end,
    },
    {
      id = "runs",
      kind = "entity_provider",
      descriptor_id = "project-pipelines.run",
      descriptor = { entity_type = "project-pipelines.run", id_field = "id" },
      call = function(request)
        return {
          type = "entity_snapshot",
          entity_type = "project-pipelines.run",
          snapshot_seq = run_seq,
          items = run_items(),
          subscription_id = request.subscription_id,
        }
      end,
    },
    {
      id = "run_steps",
      kind = "entity_provider",
      descriptor_id = "project-pipelines.run_step",
      descriptor = { entity_type = "project-pipelines.run_step", id_field = "id" },
      call = function(request)
        return {
          type = "entity_snapshot",
          entity_type = "project-pipelines.run_step",
          snapshot_seq = run_step_seq,
          items = run_step_items(),
          subscription_id = request.subscription_id,
        }
      end,
    },
    {
      id = "emit_match_action",
      kind = "ui_action",
      descriptor_id = "package-events.emit_match",
      descriptor = {
        action_id = "package-events.emit_match",
        surface_id = "project-pipelines.events",
      },
      call = handle_action,
    },
    {
      id = "emit_mismatch_action",
      kind = "ui_action",
      descriptor_id = "package-events.emit_mismatch",
      descriptor = {
        action_id = "package-events.emit_mismatch",
        surface_id = "project-pipelines.events",
      },
      call = handle_action,
    },
    {
      id = "emit_burst_action",
      kind = "ui_action",
      descriptor_id = "package-events.emit_burst",
      descriptor = {
        action_id = "package-events.emit_burst",
        surface_id = "project-pipelines.events",
      },
      call = handle_action,
    },
  },
})
