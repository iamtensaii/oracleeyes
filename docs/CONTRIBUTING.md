# Contributing to OracleEyes

> **Document ID:** **OE-DOC-010** — extended context: [OE-DOC-010-contributing-and-quality-gates.md](./OE-DOC-010-contributing-and-quality-gates.md). Documentation index: [README.md](./README.md).

This repo is the **oracleeyes** trading-lab root (`apps/web` + `services/ml-api` + Compose).

## Prerequisites

- **Node.js 22** (matches [`apps/web/Dockerfile`](../apps/web/Dockerfile) base image).
- **Docker** (optional, for full stack and parity with CI-style builds).

## Before you open a PR

From `apps/web`:

```bash
npm install
npx tsc --noEmit
npm run lint
npm run build
```

Optional full stack rebuild from repo root:

```bash
docker compose build web
```

## PR checklist

1. **Typecheck** passes (`npx tsc --noEmit` in `apps/web`).
2. **Lint** passes (`npm run lint`).
3. **Production build** succeeds (`npm run build`).
4. If you changed **FastAPI** schemas or routes, update [`apps/web/src/lib/ml-api.ts`](../apps/web/src/lib/ml-api.ts) and any callers (predict panel, chat tools).
5. If you changed **user-visible copy**, prefer [`apps/web/src/lib/product-copy.ts`](../apps/web/src/lib/product-copy.ts).
6. Document non-obvious behavior in the relevant **OE-DOC-NNN** guide (see [README.md](./README.md); bump `last_reviewed` in that file) when you add routes, services, or env vars.

## Architecture

See **[README.md](./README.md)** for the full catalog, **[OE-DOC-002-system-architecture.md](./OE-DOC-002-system-architecture.md)** for the stack, and **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the short entry path.

## Commits

Use clear, imperative subject lines (e.g. “Fix redirect for /agents”). Body text is welcome for context and breaking changes.
