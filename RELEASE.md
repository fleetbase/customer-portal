> v0.0.16 ~ "Portal customers can no longer reach organization settings"

---
## Highlights

- **Security: portal customers could read and overwrite organization settings.** The admin settings routes (`settings/config` and `settings/validate-access-url`) required no permission. A portal customer's token could read the full portal configuration and replace it: the access slug, enabled order configs and service rates, and payment flags. A new `PortalAdminGuard` refuses portal customers. Other non-admin users need `fleet-ops view customer` to read and `fleet-ops update customer` to save. (#22)
- **Security: the portal account is scoped to the company.** A user with customer profiles in several companies could end up with another company's vendor as their portal account. The contact, vendor and personnel lookups now filter by the signed-in company. (#22)
- **Fix: creating the default access slug crashed when the company-name slug was taken.** Slugs now try `name-2`, `name-3` and so on. (#22)
- **CI runs this package's unit tests again.** (#22)

---
## Need help?
- [GitHub Discussions](https://github.com/fleetbase/fleetbase/discussions)
- [Discord](https://discord.gg/HnTqQ6zAVn)
