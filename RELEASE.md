> v0.0.15 ~ "Safer sign-in and correct ticket links"

---
## Highlights

- **Security: two-factor sign-in now requires the password first** — the portal login screen used to call `two-fa/check` before the password was sent, which could start a two-factor session from an identity alone and revealed whether an account existed or had 2FA enabled. `two-fa/check` no longer looks identities up or starts sessions; the login screen posts `auth/login` first and only moves to the 2FA step after the password is accepted.
- **Fix: customer ticket links ignored the configured portal slug** — comment notification emails are queued, so there was no company in session and the links always used the default slug. They now read the slug from the issue's company.
- **Dependencies** — `fleetbase/core-api` is now constrained to `>=1.6.65`, which provides `Setting::lookupForCompany()`.

---
## Need help?
- [GitHub Discussions](https://github.com/fleetbase/fleetbase/discussions)
- [Discord](https://discord.gg/HnTqQ6zAVn)
