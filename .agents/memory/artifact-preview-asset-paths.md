---
name: Artifact preview asset paths
description: Avoiding duplicate prefixes for static assets in Vite artifacts served under a preview path.
---

For this workspace's Vite artifact preview, use relative links for manually authored static assets in `index.html` (for example, `href="favicon.svg"`). A `%BASE_URL%`-prefixed favicon URL produced a duplicated artifact prefix in the proxied HTML, while the relative URL resolved to the artifact's public asset path.

**Why:** The preview proxy and the Vite base path both contributed to the final absolute asset URL.

**How to apply:** When an artifact uses a non-root `previewPath`, verify static asset URLs through the proxied preview. Prefer relative links for assets referenced directly from `index.html` if the base-prefixed URL duplicates the path.