# ADR 0001 — ORM choice: Prisma (v6)

- **Status:** Accepted
- **Date:** 2026-06-09

## Context
KiwiSlot needs a relational data layer over PostgreSQL with type safety and managed
migrations. The author is moving off Supabase (a BaaS) specifically to own the database
layer, so the tool must make the schema and migrations explicit and reviewable.

## Decision
Use **Prisma** as the ORM, **pinned to the 6.x line**.

Prisma is schema-first: one `schema.prisma` declares the models, generates a fully typed
client, and drives versioned SQL migrations (`prisma migrate`). This gives compile-time
safety on queries and a clear migration history in `prisma/migrations/`.

We pin to **v6** rather than the latest **v7** because v7 makes driver adapters and a
`prisma.config.ts` mandatory and removes the `url` field from the `datasource` block. For a
learning project, v6's single `url = env("DATABASE_URL")` setup and the standard
`import { PrismaClient } from '@prisma/client'` path are simpler and far better documented.

## Alternatives considered
- **TypeORM** — decorator/Active-Record style, more boilerplate, historically rougher
  migrations; less type-safe than Prisma's generated client.
- **Knex / raw SQL** — maximum control but no type generation and manual migration plumbing;
  more to maintain, more error-prone.
- **Prisma v7** — current major, but the mandatory driver-adapter wiring adds setup that
  distracts from the learning goals. Revisit later if needed.

## Consequences
- + Strong type safety; queries fail at compile time, not runtime.
- + Readable schema + a clear migration trail to show in interviews.
- − Tied to Prisma's query model; very complex queries may need `queryRaw`.
- − On v6 while v7 is current; an upgrade path exists if the project outlives the tradeoff.
