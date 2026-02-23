# movieboyz-site

Static GitHub Pages dashboard for the MovieBoyz Fantasy Box Office league.

`data.json` is stored on the `data` branch and auto-updated daily by [movieboyz-fetcher](https://github.com/dthunder746/movieboyz-fetcher). `index.html` fetches it at runtime from `raw.githubusercontent.com`.

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production — deployed by GitHub Pages |
| `dev`  | Development — test here before merging to `main` |
| `data` | Data only — contains `data.json`, never merged into code branches |

## Local Development

### 1. Get latest data

`data.json` is gitignored — fetch it from the live site before testing:

```bash
curl https://movieboyz.marcus-hill.com/data.json -o data.json
```

### 2. Start a local server

```bash
python3 -m http.server 8080 --directory /path/to/movieboyz-site
```

Then open `http://localhost:8080`.

> Note: `file://` won't work — the page uses `fetch()` which requires HTTP.

### 3. Branch workflow

```bash
# Make sure you're on dev
git checkout dev
git pull origin dev

# ... edit, test locally ...

# Commit (never add data.json)
git add index.html README.md   # name files explicitly
git commit -m "feat: ..."
git push origin dev

# Deploy to production
git checkout main
git merge dev
git push
git checkout dev
```

---

## GitHub Pages Setup

1. Settings → Pages → Deploy from branch → `main` → `/ (root)`
2. Optionally add a `CNAME` file for a custom domain (e.g. `movieboyz.example.com`)
3. DNS: CNAME record pointing your subdomain → `dthunder746.github.io`
   - Proxy must be **disabled** (grey cloud on Cloudflare) for GitHub to issue its SSL cert
