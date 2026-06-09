# KiwiSlot — a multi-tenant booking API for small businesses (NestJS · PostgreSQL · Prisma · Docker)

[![CI](https://github.com/jacobnko/kiwiSlot/actions/workflows/ci.yml/badge.svg)](https://github.com/jacobnko/kiwiSlot/actions/workflows/ci.yml)

KiwiSlot is a booking/reservation backend for small businesses such as cafés and salons.
It is **multi-tenant**: many independent businesses share one deployment, each with its
data fully isolated from the others. The project is built to demonstrate ownership of a
real backend — authentication, relational modeling, role-based authorization, a
non-trivial business rule under concurrency (double-booking prevention), testing, and
containerized deployment.

> Status: 🚧 In active development. See the roadmap below.

## Architecture overview
_TBD — module structure (Auth, Business, Service, Customer, Booking), guards, and the
Prisma data layer will be documented here._

## Data model (ER diagram)

KiwiSlot is multi-tenant: every tenant-owned row carries a `businessId`, so isolation is a
simple `where: { businessId }` on every query. A `Booking` also stores `businessId`
directly (denormalized) so tenant filtering never needs a join.

```mermaid
erDiagram
    Business ||--o{ User     : "has"
    Business ||--o{ Service  : "offers"
    Business ||--o{ Customer : "has"
    Business ||--o{ Booking  : "has"
    Service  ||--o{ Booking  : "booked in"
    Customer ||--o{ Booking  : "books"

    Business {
        uuid     id PK
        string   name
        datetime createdAt
        datetime updatedAt
    }
    User {
        uuid     id PK
        string   email UK "global login key"
        string   passwordHash
        string   name
        Role     role "OWNER | STAFF"
        uuid     businessId FK
    }
    Service {
        uuid     id PK
        string   name
        int      durationMinutes
        decimal  price "Decimal(10,2)"
        uuid     businessId FK
    }
    Customer {
        uuid     id PK
        string   name
        string   email
        string   phone
        uuid     businessId FK
    }
    Booking {
        uuid          id PK
        datetime      startTime
        datetime      endTime
        BookingStatus status "CONFIRMED | CANCELLED"
        uuid          businessId FK
        uuid          serviceId FK
        uuid          customerId FK
    }
```

## Tech stack
- **NestJS** (TypeScript) — modular backend (modules / controllers / services / DI)
- **PostgreSQL** + **Prisma** ORM
- **JWT** access tokens + **bcrypt** password hashing
- **class-validator / class-transformer** for DTO validation
- **Jest** for unit + e2e tests
- **Docker** — production multi-stage `Dockerfile`; `docker-compose` for local Postgres
- **GitHub Actions** for CI (lint + test)
- **Deploy:** Neon (Postgres) + Render (web service). The container also runs unchanged on
  AWS ECS / GCP Cloud Run.

## Roadmap
- [ ] Phase 0 — Setup (Docker, local Postgres, NestJS scaffold)
- [x] Phase 1 — Data model (Prisma schema + migration + ERD)
- [x] Phase 2 — Auth (register, login, JWT, bcrypt)
- [x] Phase 3 — Authorization & multi-tenancy
- [x] Phase 4 — Services (CRUD)
- [x] Phase 5 — Customers (create / list)
- [x] Phase 6 — Bookings (double-booking prevention)
- [x] Phase 7 — Tests
- [x] Phase 8 — Containerize & CI
- [x] Phase 9 — Deploy (Neon + Render)

## Running locally

Prerequisites: Node 22+, Docker Desktop.

```bash
# 1. Start the local PostgreSQL
docker compose up -d

# 2. Configure env
cp .env.example .env        # then edit secrets if you like

# 3. Install deps + apply the schema
npm ci
npx prisma migrate deploy   # or `npx prisma migrate dev` while developing

# 4. Run the API (defaults to http://localhost:3333)
npm run start:dev
```

The API is served under `/api/v1` (e.g. `POST /api/v1/auth/register`).

### Tests

```bash
npm test           # unit tests (mocked Prisma)
npm run test:e2e   # e2e tests — requires the compose Postgres to be running
```

### Run the production image

```bash
docker build -t kiwislot-api:local .
docker run --rm \
  --network kiwislot-backend_default \
  -e DATABASE_URL='postgresql://kiwislot:kiwislot_local_pw@postgres:5432/kiwislot?schema=public' \
  -e JWT_SECRET='change_me' -e PORT=3333 -p 3334:3333 \
  kiwislot-api:local
```

The container runs `prisma migrate deploy` then starts the server, so it migrates the database
on boot. Because it's a self-contained image, it runs unchanged on AWS ECS / GCP Cloud Run as
well — the host is just a detail.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR: it boots a `postgres:16`
service container, then runs lint, unit tests, and e2e tests (including the concurrency
double-booking test) against it.

## Deployment (free stack: Neon + Render)

The app deploys as a Docker container with a managed Postgres — no paid hosting required.

**1. Database — Neon (free Postgres):**
1. Create a project at [neon.tech](https://neon.tech) and a database.
2. Copy the connection string and append `?sslmode=require`, e.g.
   `postgresql://USER:PASSWORD@ep-xxx.neon.tech/kiwislot?sslmode=require`.

**2. API — Render (free web service):**
- **With the Blueprint:** push this repo (it contains `render.yaml`), then in Render choose
  **New → Blueprint** and point it at the repo. It provisions a free Docker web service with a
  health check at `/api/v1/health`, generates `JWT_SECRET`, and leaves `DATABASE_URL` for you
  to fill in with the Neon string.
- **Manual:** New → Web Service → connect the repo → runtime **Docker** → plan **Free** →
  set env vars `DATABASE_URL` (Neon), `JWT_SECRET`, `JWT_EXPIRES_IN=1d`.

On boot the container runs `prisma migrate deploy` against Neon, then starts the server.
Render injects `PORT`, which the app honors.

> **Free-tier caveat:** Render free web services spin down after ~15 minutes of inactivity,
> so the first request after idle is slow (cold start). Fine for a portfolio demo.

Because this is a self-contained image, the same container runs unchanged on **AWS ECS** or
**GCP Cloud Run** — the credibility comes from Docker + CI/CD, not the host.

## Key decisions & what I learned

- **ORM = Prisma (v6).** Type-safe schema-first ORM with managed migrations. Pinned to v6
  because v7 mandates driver adapters + `prisma.config.ts`; v6's single `url` datasource is
  simpler and far better documented for a learning project. See `docs/adr/0001-orm-choice.md`.
- **Tenant isolation = `businessId` on every tenant-owned table** (including `Booking`,
  denormalized). Makes isolation a uniform `where: { businessId }` and avoids joins on the
  hot path. See `docs/adr/0002-tenant-isolation.md`.
- **UUID primary keys** — avoid leaking row counts / enabling ID enumeration on a public,
  multi-tenant API.
- **Money as `Decimal(10,2)`** — exact currency math in Postgres, no floating-point error.
- **Cascade deletes from `Business`** keep tenant teardown clean; the "don't delete a
  booked service" rule lives in the service layer, not the FK.
- **Double-booking prevented with a pessimistic lock** (`SELECT ... FOR UPDATE` on the
  service inside a transaction). Verified race-free: 8 concurrent identical requests →
  exactly one success. See `docs/adr/0003-double-booking-prevention.md`.
