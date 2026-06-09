# ADR 0003 — Double-booking prevention strategy

- **Status:** Accepted
- **Date:** 2026-06-09

## Context
The core business rule of KiwiSlot: no two `CONFIRMED` bookings for the same `Service` may
overlap in time, and this must hold **under concurrency** (two requests booking overlapping
slots at the same instant). A naive "check for an overlap, then insert" is a classic race:
two concurrent transactions both read "no overlap" before either inserts, and both succeed.

Overlap is defined on half-open intervals `[start, end)`:
`overlap ⟺ startA < endB AND startB < endA`. Adjacent bookings (one ends exactly when the
next begins) therefore do **not** conflict.

## Decision
Use a **pessimistic lock**. Booking creation runs in a single transaction that first locks
the target `Service` row with `SELECT ... FOR UPDATE`, then performs the overlap check and
the insert:

1. `SELECT id, "durationMinutes" FROM "Service" WHERE id = $1 AND "businessId" = $2 FOR UPDATE`
   — serializes all concurrent booking attempts for that service and scopes to the tenant.
2. Verify the `customer` belongs to the same business (block cross-tenant foreign keys).
3. Derive `endTime = startTime + durationMinutes`.
4. Look for an overlapping `CONFIRMED` booking (`startTime < endB AND endTime > startB`).
5. If none, insert the booking. The lock is held until the transaction commits.

A second concurrent request blocks at step 1 until the first commits, then sees the new
booking at step 4 and is rejected with `409 Conflict`.

## Alternatives considered
- **PostgreSQL exclusion constraint** (`EXCLUDE USING gist (serviceId WITH =, tsrange(start,
  end) WITH &&) WHERE status = 'CONFIRMED'`, via `btree_gist`): correct-by-construction at
  the database, no application race possible — the strongest option. Rejected for now because
  it requires a hand-written SQL migration and an extension, and is Postgres-specific; the
  pessimistic lock keeps the logic in readable application code that's easy to explain.
- **Serializable isolation + retry:** let Postgres detect the conflict and abort one
  transaction, then retry. Elegant but adds retry/backoff complexity.

## Consequences
- + Race-free check-then-insert; verified with 8 concurrent identical requests yielding
  exactly one `201` and seven `409`, and a single `CONFIRMED` row in the database.
- + All logic lives in the service layer; no custom migration or DB extension.
- − Bookings for the *same* service are serialized (one at a time). Fine for small-business
  volumes; would need revisiting at high throughput.
- − Relies on the lock query being inside the same transaction as the check + insert; the
  guarantee is lost if that discipline is broken.

## Related
- Cancelling a booking sets `status = CANCELLED`; since only `CONFIRMED` bookings count toward
  the overlap check, cancelling frees the slot for re-booking.
- A `Service` with `CONFIRMED` bookings cannot be deleted (enforced in `ServicesService`),
  so live appointments are never silently cascade-deleted.
