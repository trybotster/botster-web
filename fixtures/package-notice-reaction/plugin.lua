-- Neutral package-notice-reaction producer for Web descriptor-driven notice proof.
-- Emits sample.notice with payload.subject. Durable rows stay on the item family.

local MATCH_SUBJECT = "web-prod"
local OTHER_SUBJECT = "other-session"

local item_seq = 0
local items = {}
local emit_count = 0

local function copy_items()
  local out = {}
  for _, item in ipairs(items) do
    out[#out + 1] = {
      id = item.id,
      notice = item.notice,
      subject = item.subject,
    }
  end
  return out
end

local function events_surface(_arguments)
  return {
    type = "form",
    id = "package-notice-reaction-form",
    children = {
      {
        type = "button",
        id = "package-notice-reaction-emit-match",
        props = {
          label = "Emit matching notice",
          action = { id = "package-notice-reaction.emit_match" },
        },
      },
      {
        type = "button",
        id = "package-notice-reaction-emit-mismatch",
        props = {
          label = "Emit mismatching notice",
          action = { id = "package-notice-reaction.emit_mismatch" },
        },
      },
      {
        type = "button",
        id = "package-notice-reaction-emit-burst",
        props = {
          label = "Emit burst",
          action = { id = "package-notice-reaction.emit_burst", payload = { count = 200 } },
        },
      },
    },
  }
end

local function commit_item(subject, notice)
  emit_count = emit_count + 1
  local item_id = "notice_fixture_" .. tostring(emit_count)
  items[#items + 1] = {
    id = item_id,
    notice = notice,
    subject = subject,
  }
  item_seq = item_seq + 1
  return item_id
end

local function emit_notice(subject, notice)
  local token = commit_item(subject, notice)
  local payload = {
    notice = notice,
    token = token,
  }
  if type(subject) == "string" and subject ~= "" then
    payload.subject = subject
  end
  pcall(function()
    events.emit("sample.notice", payload)
  end)
  return token
end

local function handle_action(request)
  local action_id = request.action_id
  local payload = request.payload or {}

  if action_id == "package-notice-reaction.emit_match" then
    local token = emit_notice(MATCH_SUBJECT, "Matching session notice")
    return {
      request_id = request.request_id,
      surface_id = request.surface_id,
      action_id = action_id,
      node_id = request.node_id,
      state = "accepted",
      payload = { token = token, subject = MATCH_SUBJECT },
    }
  end

  if action_id == "package-notice-reaction.emit_mismatch" then
    local token = emit_notice(OTHER_SUBJECT, "Mismatching session notice")
    return {
      request_id = request.request_id,
      surface_id = request.surface_id,
      action_id = action_id,
      node_id = request.node_id,
      state = "accepted",
      payload = { token = token, subject = OTHER_SUBJECT },
    }
  end

  if action_id == "package-notice-reaction.emit_burst" then
    local count = payload.count
    if type(count) ~= "number" or count < 1 then count = 200 end
    local first_id = commit_item(MATCH_SUBJECT, "Burst session notice")
    for _ = 1, count do
      pcall(function()
        events.emit("sample.notice", {
          notice = "Burst session notice",
          subject = MATCH_SUBJECT,
          token = first_id,
        })
      end)
    end
    return {
      request_id = request.request_id,
      surface_id = request.surface_id,
      action_id = action_id,
      node_id = request.node_id,
      state = "accepted",
      payload = { token = first_id, count = count },
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
      descriptor_id = "package-notice-reaction.events",
      call = events_surface,
    },
    {
      id = "items",
      kind = "entity_provider",
      descriptor_id = "package-notice-reaction.item",
      descriptor = { entity_type = "package-notice-reaction.item", id_field = "id" },
      call = function(request)
        return {
          type = "entity_snapshot",
          entity_type = "package-notice-reaction.item",
          snapshot_seq = item_seq,
          items = copy_items(),
          subscription_id = request.subscription_id,
        }
      end,
    },
    {
      id = "emit_match_action",
      kind = "ui_action",
      descriptor_id = "package-notice-reaction.emit_match",
      descriptor = {
        action_id = "package-notice-reaction.emit_match",
        surface_id = "package-notice-reaction.events",
      },
      call = handle_action,
    },
    {
      id = "emit_mismatch_action",
      kind = "ui_action",
      descriptor_id = "package-notice-reaction.emit_mismatch",
      descriptor = {
        action_id = "package-notice-reaction.emit_mismatch",
        surface_id = "package-notice-reaction.events",
      },
      call = handle_action,
    },
    {
      id = "emit_burst_action",
      kind = "ui_action",
      descriptor_id = "package-notice-reaction.emit_burst",
      descriptor = {
        action_id = "package-notice-reaction.emit_burst",
        surface_id = "package-notice-reaction.events",
      },
      call = handle_action,
    },
  },
})
