# Flow: User Registration & Verification (via better-auth)

## Correction from the previous version of this doc

`User` is **not our aggregate**. There is no `RegisterUserCommand`, no `passwordHash` field, no `emailConfirmedAt`/`phoneConfirmedAt` on anything we own. better-auth owns all of that — its own `user` table, its own `emailAndPassword` + `phoneNumber` plugins, its own token/OTP generation and verification endpoints. Our involvement is exactly two things:

1. **Supplying delivery functions** — better-auth generates the verification email token / phone OTP itself; it calls *our* callback to actually send it. We plug in `EmailAdapter`/`SmsAdapter` (already-designed `notification` module adapters) as the implementation of `sendVerificationEmail` and `sendOTP`.
2. **Reacting to user creation** — to spin up our own `Profile` once better-auth has created its user row.

## Actors

- **better-auth** — external identity system: signup, login, sessions, email/phone verification, password reset. Entirely out of our domain.
- **Anti-Corruption Layer** *(DDD pattern — see `patterns-index.md`)* — a thin adapter translating better-auth's lifecycle hooks into our own domain events, so nothing downstream ever depends on better-auth's shapes directly.
- **profile module** — owns `Profile`, reacts to the translated event.

## Configuration — where our code plugs into better-auth

```typescript
export const auth = betterAuth({
  emailAndPassword: {
    sendVerificationEmail: async ({ user, url, token }) => {
      await emailAdapter.send(user.email, 'verify-email', { url, token });
    },
  },
  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        await smsAdapter.send(phoneNumber, 'verify-phone-otp', { code });
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const countryCode = phoneCountryResolver.resolve(user.phoneNumber);
          const market = await marketRepository.findByCountryCode(countryCode);
          if (!market) throw new UnsupportedMarketError(countryCode); // aborts signup entirely
          return { data: { ...user, marketId: market.id } }; // additionalField, carried into `after`
        },
        after: async (user) => {
          await authIntegrationEventPublisher.publish(
            new AuthUserRegisteredEvent(user.id, user.email, user.phoneNumber, user.marketId, crypto.randomUUID()),
          );
        },
      },
    },
  },
});
```

**Confirmed against better-auth's own docs** (previously flagged as needing verification): `before` hooks can abort two ways — `return false`, or `throw new APIError(...)` (imported from `better-auth/api`). Either stops user creation entirely, so the market-enforcement design below is valid as written.

**New caveat, also confirmed**: `databaseHooks.user.create.after` does **not** run inside the same database transaction as the user creation itself. This means if `Party` creation in the `after` hook fails for some reason (validation error, transient DB issue), you'd be left with a `User` row and no corresponding `Party` — an orphaned account that can sign in but can't do anything. Mitigation: the `after` hook should be defensive (retry-safe, idempotent-checked — i.e. check whether a `Party` already exists for this `userId` before creating one), and a reconciliation job (`OrphanedUserSweepJob`) should periodically find `User`s with no `Party` and either retry creation or flag for support.

## Step-by-step sequence

1. Registrant signs up via better-auth's own `signUpEmail`/phone-based flow — all mechanics internal to better-auth, not our code
2. `before` hook resolves `Market` from the phone number, aborts if unsupported (see flag above)
3. better-auth persists its own `user` row: `email`, `phoneNumber`, `emailVerified: false`, `phoneNumberVerified: false`, `marketId` (our custom field, carried through)
4. `after` hook — our Anti-Corruption Layer — publishes `AuthUserRegistered { userId, email, phoneNumber, marketId, correlationId }` on **our own** internal `EventBus`, fresh `correlationId`. This is the ACL boundary: everything past this point only ever sees our own event, never better-auth's internal shape.
5. `@EventsHandler(AuthUserRegistered)` in `profile` module → creates `Profile { userId, marketId, capabilities: [CLIENT] }` → raises `ProfileCreated { profileId, userId, marketId, correlationId }` (same id) → stops, terminal

## Verification — entirely better-auth's mechanics from here

- better-auth calls our `sendVerificationEmail`/`sendOTP` callbacks whenever it needs to deliver a token/OTP — we never generate or store these ourselves
- Registrant verifies via better-auth's own client methods (`authClient.verifyEmail`, `authClient.phoneNumber.verify`) — flips `user.emailVerified`/`user.phoneNumberVerified` on better-auth's own table
- **`VerificationGatePolicy.isFullyVerified()` for `CLIENT` capability reads these two fields directly off better-auth's user record** (via `auth.api.getUser`/session lookup), not from any field we store ourselves — there is nothing to keep in sync, because we never duplicated this state in the first place

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `AuthUserRegistered` | Anti-Corruption Layer (`users` integration) | `{ userId, email, phoneNumber, marketId, correlationId }` | `profile` module |
| `ProfileCreated` | `profile` | `{ profileId, userId, marketId, correlationId }` | Notification |

## Algorithmic component

None.

## Open item

None remaining — `OrphanedUserSweepJob` (new, see the caveat above) handles the one real gap this uncovered.
