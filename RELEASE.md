> v0.0.14 ~ "A login button that matches the console"

---
## Highlights

- **Login page button** — the Customer Portal button on the console login page now uses ember-ui's `btn-auth` style, matching the console's "Continue with …" buttons in light and dark, hover included. With an ember-ui older than 0.4.3 it falls back to a plain default button.
- **Fix: the order map said "API key required"**: the portal's order workspace map used CARTO tiles, which now need an API key. It uses OpenStreetMap's keyless tiles instead, as Fleet-Ops does, with OpenStreetMap's attribution shown.
- **Dependencies** — `@fleetbase/ember-ui` is upgraded to `^0.4.2` (from `^0.3.39`); `@fleetbase/ember-core` stays on `^0.3.24`, already the latest.

---
## Need help?
- [GitHub Discussions](https://github.com/fleetbase/fleetbase/discussions)
- [Discord](https://discord.gg/HnTqQ6zAVn)
