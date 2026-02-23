# movieboyz-site

Static GitHub Pages dashboard for the MovieBoyz Fantasy Box Office league.

`data.json` is automatically pushed here daily by the [movieboyz-fetcher](https://github.com/dthunder746/movieboyz-fetcher) container. `index.html` reads it and renders the dashboard.

## Local Development

### 1. Get latest data

```bash
git pull origin main
```

Or fetch directly from the live site:

```bash
curl https://movieboyz.marcus-hill.com/data.json -o data.json
```

### 2. Start a local server

```bash
python3 -m http.server 8080 --directory /path/to/movieboyz-site
```

Then open `http://localhost:8080`.

### 3. Branch workflow

- Work on the `dev` branch
- Test locally before merging to `main`
- GitHub Pages only deploys from `main`

```bash
# Switch to dev
git checkout dev

# When ready to go live
git checkout main
git merge dev
git push
```

---

## GitHub Pages Setup

1. Settings → Pages → Deploy from branch → `main` → `/ (root)`
2. Optionally add a `CNAME` file for a custom domain (e.g. `movieboyz.example.com`)
3. DNS: CNAME record pointing your subdomain → `dthunder746.github.io`
   - Proxy must be **disabled** (grey cloud on Cloudflare) for GitHub to issue its SSL cert
