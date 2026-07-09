local function payload_surface(_arguments)
  return {
    type = "panel",
    id = "payload-contract-panel",
    props = {
      title = "Payload Contract",
    },
    children = {
      {
        type = "empty_state",
        id = "payload-contract-empty",
        props = {
          title = "Payload-ready empty state",
          description = "Primary and secondary actions use core UiAction payload.",
          primary_action = {
            id = "payload.primary",
            payload = {
              workspace_id = "workspace-primary",
            },
          },
          secondary_action = {
            id = "payload.secondary",
            payload = {
              workspace_id = "workspace-secondary",
            },
          },
        },
      },
      {
        type = "list",
        id = "payload-contract-list",
        props = {
          aria_label = "Payload rows",
          selection = {
            mode = "single",
            selected = { "workspace-alpha" },
          },
        },
        children = {
          {
            type = "list_item",
            id = "payload-contract-list-alpha",
            props = {
              value = "workspace-alpha",
              activation = {
                id = "payload.list.activate",
                payload = {
                  workspace_id = "workspace-alpha",
                },
              },
              action = {
                id = "payload.list.open",
                payload = {
                  workspace_id = "workspace-alpha",
                },
              },
            },
            slots = {
              title = {
                {
                  type = "text",
                  id = "payload-contract-list-alpha-title",
                  props = {
                    text = "Workspace alpha",
                  },
                },
              },
            },
          },
        },
      },
      {
        type = "table",
        id = "payload-contract-table",
        props = {
          columns = {
            {
              id = "workspace",
              label = "Workspace",
            },
            {
              id = "state",
              label = "State",
            },
          },
          selection = {
            mode = "single",
            selected = { "payload-row-alpha" },
          },
          activation = {
            id = "payload.row.activate",
            payload = {
              workspace_id = "workspace-table",
            },
          },
          row_action = {
            id = "payload.row.default",
            payload = {
              workspace_id = "workspace-default",
            },
          },
          rows = {
            {
              id = "payload-row-alpha",
              cells = {
                workspace = "Alpha",
                state = "ready",
              },
              action = {
                id = "payload.row.open",
                payload = {
                  workspace_id = "workspace-alpha",
                },
              },
            },
            {
              id = "payload-row-beta",
              cells = {
                workspace = "Beta",
                state = "ready",
              },
            },
          },
        },
      },
    },
  }
end

local function payload_action(arguments)
  return {
    request_id = arguments.request_id or "plugin-payload-contract-action",
    surface_id = "payload.app",
    action_id = arguments.action_id or "payload.row.open",
    node_id = "payload-contract-table",
    state = "accepted",
    payload = arguments,
  }
end

return botster.register({
  handlers = {
    {
      id = "payload_app_surface",
      kind = "surface_route",
      descriptor_id = "payload.app",
      descriptor = {
        title = "Payload Contract",
        surface_id = "payload.app",
      },
      call = payload_surface,
    },
    {
      id = "payload_row_open",
      kind = "ui_action",
      descriptor_id = "payload.row.open",
      descriptor = {
        action_id = "payload.row.open",
        surface_id = "payload.app",
      },
      call = payload_action,
    },
    {
      id = "payload_row_default",
      kind = "ui_action",
      descriptor_id = "payload.row.default",
      descriptor = {
        action_id = "payload.row.default",
        surface_id = "payload.app",
      },
      call = payload_action,
    },
    {
      id = "payload_row_activate",
      kind = "ui_action",
      descriptor_id = "payload.row.activate",
      descriptor = {
        action_id = "payload.row.activate",
        surface_id = "payload.app",
      },
      call = payload_action,
    },
    {
      id = "payload_list_open",
      kind = "ui_action",
      descriptor_id = "payload.list.open",
      descriptor = {
        action_id = "payload.list.open",
        surface_id = "payload.app",
      },
      call = payload_action,
    },
    {
      id = "payload_list_activate",
      kind = "ui_action",
      descriptor_id = "payload.list.activate",
      descriptor = {
        action_id = "payload.list.activate",
        surface_id = "payload.app",
      },
      call = payload_action,
    },
    {
      id = "payload_primary",
      kind = "ui_action",
      descriptor_id = "payload.primary",
      descriptor = {
        action_id = "payload.primary",
        surface_id = "payload.app",
      },
      call = payload_action,
    },
    {
      id = "payload_secondary",
      kind = "ui_action",
      descriptor_id = "payload.secondary",
      descriptor = {
        action_id = "payload.secondary",
        surface_id = "payload.app",
      },
      call = payload_action,
    },
  },
})
