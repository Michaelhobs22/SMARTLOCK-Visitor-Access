---
name: Wouter route state preservation
description: Avoiding state loss when route pages receive updated pass data.
---

Render stateful pages as route children rather than constructing a fresh inline function for Wouter's `component` prop on every parent render. A changing wrapper identity remounts the route page and resets its local state.

**Why:** Updating a pass after successful lock verification recreated the inline route wrapper, which cleared the lock screen result before it could be shown.

**How to apply:** When pass state changes in the router, keep page component types stable so local inputs, dialogs, and verification results remain visible.
