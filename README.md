# DawaFind

A medicine-access marketplace MVP for Kenya. Patients search a medicine, compare **verified**
pharmacies (price, stock status, how fresh that information is, distance, delivery fee and estimated
total), confirm stock, reserve, and collect or get delivery. Pharmacies manage inventory with a
minimum-price floor; platform admins verify pharmacies and oversee the platform.

DawaFind does not diagnose, prescribe, recommend or substitute medicines, and it never shows a hidden
"best pharmacy" ranking. Results are sorted only by the option the user picks (price, total, distance,
freshness) with a neutral alphabetical tie-break.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL · Vitest

## Quick start

```bash
npm install
npm run db:start      # local Postgres cluster in ./.pgdata (port 5433)
npm run db:push       # create the schema
npm run db:seed       # demo data (development only)
npm run dev           # http://localhost:3000
```

`.env.example` lists the variables. `.env` is already generated for local use.
Without `SMTP_URL`, emails are printed to the server console.

### Demo accounts (password `Password123`)

| Account | Role |
| --- | --- |
| admin@dawafind.test | Platform admin |
| patient@dawafind.test, patient2@dawafind.test | Patients |
| abc@dawafind.test | Pharmacy admin (ABC Pharmacy) |
| abc.staff@dawafind.test | Pharmacy staff (ABC Pharmacy) |
| xyz@, health@, karen@, eastleigh@, nyali@, lakeside@dawafind.test | Other pharmacy admins |
| newlife@dawafind.test | Pharmacy admin awaiting verification |

Try searching "amoxicillin 500mg" to see varied prices, a stale listing and an out-of-stock pharmacy.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Run the app |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm test` | Unit tests (pricing, freshness, medicine matching, hours) |
| `npm run db:reset` | Drop, recreate, push schema and reseed the local database |
| `npm run smoke` | End-to-end checks against a running dev server (needs a freshly seeded DB) |

## Prescription scanning

The home page can read a photo of a prescription and suggest catalogue matches. OCR (Tesseract.js, English
model) runs **in the browser**: the photo is never uploaded or stored, and the engine is self-hosted from
`public/ocr` (copied by `npm run ocr:assets`, which `dev` and `build` run automatically). Only the reviewed
text is sent to `/api/scan/match`, which fuzzy-matches names against the catalogue. Printed text reads well;
doctors' handwriting is unreliable, so the text is always editable and matches are suggestions only.

## Key behaviours

- **Price protection:** a promo or discount can never go below a medicine's minimum price.
- **Freshness:** HIGH ≤ 1 h, MEDIUM ≤ 6 h, LOW ≤ 24 h, otherwise STALE. Stale stock is never shown as available.
- **Total cost:** unit price × quantity + delivery fee (if delivering) + a flat service fee (admin-configurable).
- **Holds:** confirmed reservations hold stock; collection decrements it; expiry is swept lazily and via
  `/api/cron/sweep` (bearer `CRON_SECRET`).
- **Prescriptions:** AES-256-GCM encrypted at rest outside `/public`, opaque references, uploaded only with
  consent, readable only by the owning patient and the pharmacy it was shared with (not platform admins),
  every access audited, securely deleted after the retention period.
- **Security:** RBAC on every route, session tokens hashed in the database, same-origin CSRF check in
  `src/proxy.ts`, rate limiting, bcrypt password hashing, audit log.

## Known limitations

- No payment integration: patients pay the pharmacy directly; pharmacy plans are billed manually.
- Refund/dispute handling is display-only.
- Rate limiter is in-memory (use a shared store when running multiple instances).
- Prescription upload checks file type and active PDF content, which is not a substitute for antivirus.
- `npm audit` reports a dev-only advisory in the Prisma CLI dependency chain.
