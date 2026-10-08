# SMARTLOCK

A resident visitor-access app for creating, sharing, and managing temporary QR passes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (uses the workflow-provided `PORT`)
- `pnpm --filter @workspace/smartlock run dev` — run the SMARTLOCK web app
- `pnpm --filter @workspace/smartlock run typecheck` — typecheck SMARTLOCK
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-server run build` — build the API server
- `PORT=22578 BASE_PATH=/smartlock/ pnpm --filter @workspace/smartlock run build` — build SMARTLOCK locally (the artifact workflow supplies these values when managed)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Clerk sign-in is managed through the Replit authentication settings; never add Clerk keys to source control.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/smartlock/src/App.tsx` — resident overview, guest pass flow, and simulated lock verifier
- `artifacts/api-server/src/routes/passes.ts` — account-scoped pass API and public visitor link lookup
- `lib/db/src/schema/access-passes.ts` — persistent pass records
- `artifacts/smartlock/src/index.css` — SMARTLOCK responsive visual theme
- `artifacts/smartlock/package.json` — web app scripts and dependencies

## Architecture decisions

- Pass records are stored in PostgreSQL and every resident query is scoped to the authenticated Clerk user ID.
- Visitor share IDs are high-entropy bearer links. Public lookup returns only visitor-facing pass fields; keep links private.
- Browser localStorage is used only for a one-time import of valid legacy demo passes, then the local copy is removed.
- QR codes are rendered locally in the browser so pass tokens are not sent to a third-party QR service.
- The simulated reader verifies codes through the API and atomically enforces single-use status. It does not control door hardware.
- The browser camera scanner uses the device camera locally when BarcodeDetector is supported; manual code entry remains available.
- Standard and Premium are demonstration flows, not a live ad network or payment integration.

## Product

Residents can issue temporary QR passes, review or revoke them, and see recent pass activity. Visitors can open an unguessable share link across devices. A simulated reader can scan or accept a token and enforce expiration, revocation, and one-time use. Physical-lock control, live ads/payments, and notifications still need provider choices and integrations.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
