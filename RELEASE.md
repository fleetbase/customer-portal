> v0.0.13 ~ "Dispatcher-created orders are visible in the portal again"

---
## Highlights
A customer could not see orders that a dispatcher had created for them. The portal matched orders on both the customer UUID **and** the polymorphic customer type, and Fleet-Ops persists that type differently depending on which path created the order — so a perfectly valid order was filtered out of the customer's own list.

Orders are now matched on the customer UUID alone, which is canonical. Company scoping is unchanged, so tenant isolation is preserved: this widens what a customer can see of *their own* orders, not whose orders they can see.

---
## Bug Fixes
- Orders created by a dispatcher no longer disappear from the customer portal because of how their `customer_type` was recorded.

---
## Under the hood
- `PortalOrderService` replaces the per-filter `uuid` + `type` pair matching with a single `whereIn` on the customer UUID, removing the `1 = 0` short-circuit that produced an empty list whenever no filter could be built.
- Added `PortalOrderServiceTest` covering the resolution paths.

---
## Need help?
- [GitHub Discussions](https://github.com/fleetbase/fleetbase/discussions)
- [Discord](https://discord.gg/HnTqQ6zAVn)
