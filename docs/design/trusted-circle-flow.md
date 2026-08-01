# Flow: Trusted Circle — Add, Share, Confirm/Decline

## Actors

- **Owner** — a `Profile` with `CLIENT` capability, maintaining exactly one `TrustedCircle`
- **Sharer** — an owner sharing one of their own confirmed members with another client
- **Target** — the client receiving a suggestion

## Design note — another type field retired

`TrustedCircleMember.memberType` (`PROVIDER | ORGANIZATION`) is gone. Now that both collapse into `Profile`, `memberId` alone is enough — same simplification that already happened to `Application.applicantType`, `Service.listedByType`, etc. once `Profile` unification landed.

```typescript
class TrustedCircle {
  id: string;
  ownerProfileId: string;   // unique — one circle per client
  createdAt: Date;
  updatedAt: Date;
}

class TrustedCircleMember {
  id: string;
  memberId: string;                    // a Profile id — no type needed
  status: 'CONFIRMED' | 'SUGGESTED';
  sharedFromProfileId: string | null;
  addedAt: Date | null;                // set only on confirm
}
```

## Direct add — the simple path

1. `AddTrustedMemberCommand { ownerProfileId, memberId }`
2. `TrustedCircle.addMember(memberId)` → new `TrustedCircleMember { status: CONFIRMED, addedAt: now }` — no gate, since the owner is adding on their own authority
3. Fresh `correlationId`. `TrustedCircleMemberAdded { circleId, memberId, correlationId }`
4. **`TrustedByCountSyncSaga`** (thin, single-hop — not a process manager, no compensation needed) → increments `Profile.trustedByCount` on the member. Same `correlationId`, stops there.

`RemoveTrustedMemberCommand` is the mirror image: `TrustedCircleMemberRemoved` → same saga decrements the count.

## Share — two-step, arbitrary delay between them

1. `ShareTrustedMemberCommand { sharerProfileId, memberId, targetProfileId }`
2. Handler loads the **sharer's own** circle, verifies the member's entry there is `CONFIRMED` (you can't share a suggestion you haven't confirmed yourself)
3. Loads (or creates) the **target's** circle, calls `receiveSuggestion(memberId, sharedFromProfileId: sharerProfileId)` — this only ever mutates the target's aggregate, never the sharer's
4. New `TrustedCircleMember { status: SUGGESTED, sharedFromProfileId: sharerProfileId, addedAt: null }` on the target's circle
5. Fresh `correlationId`. `TrustedCircleMemberShareSuggested { targetCircleId, memberId, sharedFromProfileId, correlationId }` → Notification: "X thinks you'd like this provider." Chain stops — **`trustedByCount` is not touched yet.**

**Real time passes.** The target may act minutes or weeks later — this is why steps below get their own fresh `correlationId`, linked back only via the persisted `sharedFromProfileId`/`memberEntryId`, never by `correlationId`. *(Same rule as the arbitrary-delay callout in `user-registration-flow.md` — this is the third time it's shown up; worth treating as a standing principle rather than a one-off.)*

- `ConfirmSharedMemberCommand { targetProfileId, memberEntryId }` → `confirmSuggestion()` → `status: CONFIRMED`, `addedAt: now` → `TrustedCircleMemberConfirmed { circleId, memberId, correlationId }` *(fresh id)* → **now** `TrustedByCountSyncSaga` increments the count
- `DeclineSharedMemberCommand { targetProfileId, memberEntryId }` → `declineSuggestion()` → `TrustedCircleMemberDeclined { circleId, memberId, correlationId }` *(fresh id)* → no count change, no further consequence

## Second-degree trust query

`CountMutualTrustQuery { viewingProfileId, targetProfileId }` — "how many people *I* already trust, also trust this profile." Computed as a set intersection, not N individual lookups:
- Set A = `viewingProfileId`'s own `CONFIRMED` member ids
- Set B = every `ownerProfileId` whose circle contains `targetProfileId` as `CONFIRMED` (a reverse lookup — `findOwnersWhoTrust(targetProfileId)`)
- `|A ∩ B|` = mutual trust count

This is the same hash-set intersection referenced in `patterns-index.md`'s algorithm table — O(n + m), no graph traversal needed unless you later want "trust distance" (shortest path through the trust graph) rather than a flat count, which would then need BFS (CLRS Ch. 22).

This query, plus `trustedByCount`/tier/rating ranking, is what feeds `SuggestReassignmentCandidatesQuery` in `errand-reassignment-flow.md` (pending).

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `TrustedCircleMemberAdded` | `trusted-circle` | `{ circleId, memberId, correlationId }` | `TrustedByCountSyncSaga` |
| `TrustedCircleMemberRemoved` | `trusted-circle` | `{ circleId, memberId, correlationId }` | `TrustedByCountSyncSaga` |
| `TrustedCircleMemberShareSuggested` | `trusted-circle` | `{ targetCircleId, memberId, sharedFromProfileId, correlationId }` | Notification |
| `TrustedCircleMemberConfirmed` | `trusted-circle` | `{ circleId, memberId, correlationId }` | `TrustedByCountSyncSaga` |
| `TrustedCircleMemberDeclined` | `trusted-circle` | `{ circleId, memberId, correlationId }` | — |

## Algorithmic component

Set intersection for mutual trust (see above) — O(n+m) via hash set, no dedicated CLRS chapter needed beyond general hashing (Ch. 11). If "trust distance" is ever wanted instead of a flat count, that becomes BFS over the trust graph — CLRS Ch. 22.
