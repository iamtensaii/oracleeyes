---
document_id: OE-DOC-010
title: Contributing and quality gates
status: current
last_reviewed: "2026-04-18"
---

# Contributing and quality gates

## Canonical PR checklist

The short, copy-paste checklist lives in **[CONTRIBUTING.md](./CONTRIBUTING.md)**. Keep it updated when quality gates change.

Summary from `apps/web`:

```bash
npm install
npx tsc --noEmit
npm run lint
npm run build
```

Optional: `docker compose build web` from the repository root for image parity.

## Design principles for contributors

1. **Contract first** — ML schema changes require synchronized updates in `services/ml-api` and `apps/web/src/lib/ml-api.ts`.
2. **Copy centralization** — Prefer `product-copy.ts` for user-visible strings.
3. **Small diffs** — Prefer focused changes over drive-by refactors unless agreed.

## Where to document behavior

- **User-visible or architectural** — Add or update the relevant **OE-DOC-*** file and bump `last_reviewed` when materially changed.
- **Index** — Register new top-level guides in **docs/README.md** with a new **OE-DOC-NNN** ID (do not reuse retired IDs).

## Related documents

| ID | Topic |
|----|--------|
| OE-DOC-007 | FAQ |
| OE-DOC-008 | Glossary |
