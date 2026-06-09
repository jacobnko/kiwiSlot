# ADR 0002 — Tenant isolation strategy

- **Status:** Accepted
- **Date:** 2026-06-09

## Context
KiwiSlot is multi-tenant: many independent businesses share one database, and a user must
**never** read or write another business's data. We need a model that makes that isolation
simple to enforce consistently and hard to get wrong.

## Decision
Store a **`businessId` foreign key on every tenant-owned table** — `User`, `Service`,
`Customer`, and `Booking` — including `Booking`, where the business could otherwise be
derived via its `Service` or `Customer` (a deliberate denormalization).

Isolation is then enforced as a uniform rule: every query the app issues for tenant data
includes `where: { businessId: <current user's businessId> }`. The current `businessId` will
come from the authenticated JWT (Phase 2/3), not from client input.

## Alternatives considered
- **Derive `Booking`'s tenant via `Service`/`Customer`** (no `businessId` on `Booking`):
  more normalized, but every tenant check on bookings needs a join, and the isolation rule
  becomes non-uniform across tables — easier to forget and leak.
- **Database-per-tenant** or **Postgres Row-Level Security (RLS)**: stronger isolation, but
  heavyweight for this scope and harder to demonstrate/explain in a small portfolio project.

## Consequences
- + Isolation is one uniform predicate (`where: { businessId }`) on every table.
- + No joins needed to scope bookings to a tenant (faster, simpler guards).
- − `Booking.businessId` is denormalized: it must always agree with the booking's
  `Service.businessId` and `Customer.businessId`. The booking-creation logic (Phase 6) is
  responsible for setting it correctly and rejecting cross-tenant references.

## Where it could still leak (to watch)
- Any query that forgets the `businessId` predicate.
- Trusting a `businessId` from the request body instead of the JWT.
- A booking created with a `serviceId`/`customerId` from another tenant — validate that
  both belong to the caller's business before insert.
