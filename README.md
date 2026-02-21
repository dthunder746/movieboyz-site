# movieboyz-site

Static GitHub Pages dashboard for the MovieBoyz Fantasy Box Office league.

`data.json` is automatically pushed here daily by the [movieboyz-fetcher](https://github.com/dthunder746/movieboyz-fetcher) container. `index.html` reads it and renders the dashboard.

## GitHub Pages Setup

1. Settings → Pages → Deploy from branch → `main` → `/ (root)`
2. Optionally add a `CNAME` file for a custom domain (e.g. `movieboyz.example.com`)
3. DNS: CNAME record pointing your subdomain → `dthunder746.github.io`
   - Proxy must be **disabled** (grey cloud on Cloudflare) for GitHub to issue its SSL cert
