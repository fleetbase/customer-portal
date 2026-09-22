> v0.0.14 ~ "The Customer Portal in English and Russian, and a login button that matches the console"

---
## Highlights

- **Internationalization** — every part of the portal now reads its text from translations instead of hardcoded strings: orders (workspace, creation forms, details), settings and team members, the dashboard and its widgets, support tickets, billing and invoices, the address book, documents, notifications, and sign-in and verification. Runtime text — validation errors, notifications, modal options — is translated too. Ships with complete English (en-us) and Russian (ru-ru) translations, 590+ keys each. Thanks to @spanchenko.
- **Login page button** — the Customer Portal button on the console login page now uses ember-ui's `btn-auth` style, matching the console's "Continue with …" buttons in light and dark, hover included. With an ember-ui older than 0.4.3 it falls back to a plain default button.

---
## Need help?
- [GitHub Discussions](https://github.com/fleetbase/fleetbase/discussions)
- [Discord](https://discord.gg/HnTqQ6zAVn)
