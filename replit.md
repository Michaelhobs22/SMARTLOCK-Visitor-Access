# SMARTLOCK

A QR-based residential visitor access demo for issuing, managing, and simulating verification of temporary guest passes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/smartlock run dev` — run the SMARTLOCK web app
- `pnpm --filter @workspace/smartlock run typecheck` — typecheck SMARTLOCK
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/smartlock/src/App.tsx` — resident overview, guest pass flow, and simulated lock verifier
- `artifacts/smartlock/src/index.css` — SMARTLOCK responsive visual theme
- `artifacts/smartlock/package.json` — web app scripts and dependencies

## Architecture decisions

- Visitor passes are stored in browser localStorage for this demo; this is not a secure shared production store.
- QR codes are rendered locally in the browser so pass tokens are not sent to a third-party QR service.
- The lock screen verifies tokens in the browser only; it does not scan with a camera or control door hardware.
- Standard and Premium are demonstration flows, not a live ad network or payment integration.

## Product

Residents can issue temporary QR passes, review or revoke them, and see recent pass activity. Visitors can create Standard or Premium demo passes and share a QR code/token. A simulated lock can validate a token and enforce expiration, revocation, and one-time use.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
