# Flow Documentation Index

Each flow is documented as a standalone file: narrative walkthrough, actors, step-by-step sequence, event table (publisher/consumers), correlation-id scope, enterprise integration patterns used (see `patterns-index.md` for the full cross-reference), and any algorithmic components with a pointer to where to read up on them.

## Status

| Flow | File | Status |
|---|---|---|
| Application accept (charge → escrow) | `application-accept-flow.md` | ✅ written |
| User registration & verification (via better-auth) | `user-registration-flow.md` | ✅ written (corrected) |
| Errand discovery (nearby + recent, for workers) | `errand-discovery-flow.md` | ✅ written |
| Errand creation (all 3 sourcing paths) | `errand-creation-flow.md` | ✅ written |
| Errand reassignment (declined direct offer → suggestion list) | `errand-reassignment-flow.md` | ✅ written |
| Add / share / confirm trusted circle member | `trusted-circle-flow.md` | ✅ written |
| Verification (tiered, per worker type) | `verification-flow.md` | ✅ written |
| Errand completion (multi-worker confirm + escrow release) | `errand-completion-flow.md` | ✅ written |
| Withdrawal (debit-first, compensating credit) | `withdrawal-flow.md` | ✅ written |
| Dispute resolution | `dispute-flow.md` | ✅ written |
| Rating (client-facing + internal org/member) | `rating-flow.md` | ✅ written |

See `patterns-index.md` for which EIP/DDD patterns show up where.
