---
name: React version mismatch in Vite
description: Stale Vite dependency prebundles can report React version mismatches after package updates.
---

When a preview reports that `react` and `react-dom` versions differ, first verify the installed package versions and inspect Vite's optimized dependency metadata. The artifact-local `.vite` cache can still bundle the previous versions even after pnpm has updated the installed links.

**Why:** the browser runs the optimized prebundle, not the package links inspected by Node; a stale cache can therefore keep the mismatch alive after dependencies are aligned.

**How to apply:** if package links match but Vite metadata points to old versions, remove that artifact's generated `.vite` cache and restart its workflow before changing dependency versions again.
