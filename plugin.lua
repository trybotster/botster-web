local function surface_panel(settings)
  return {
    type = "panel",
    id = settings and "botster-web-settings-panel" or "botster-web-dogfood-panel",
    props = {
      title = settings and "botster-web Settings" or "botster-web Dogfood",
    },
    children = {
      {
        type = "text",
        id = settings and "botster-web-settings-body" or "botster-web-dogfood-body",
        props = {
          text = settings
            and "Deterministic settings surface rendered by the botster-web dogfood package."
            or "Deterministic app surface rendered by the botster-web dogfood package.",
        },
      },
    },
  }
end

local function dogfood_surface(_arguments)
  return surface_panel(false)
end

local function settings_surface(_arguments)
  return surface_panel(true)
end

return botster.register({
  handlers = {
    {
      id = "dogfood_app_surface",
      kind = "surface_route",
      descriptor_id = "dogfood-app",
      descriptor = {
        title = "botster-web Dogfood",
        surface_id = "dogfood-app",
      },
      call = dogfood_surface,
    },
    {
      id = "dogfood_settings_surface",
      kind = "surface_route",
      descriptor_id = "dogfood-settings",
      descriptor = {
        title = "botster-web Settings",
        surface_id = "dogfood-settings",
      },
      call = settings_surface,
    },
  },
})
