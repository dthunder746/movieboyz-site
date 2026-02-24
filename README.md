# movieboyz-site

Static GitHub Pages dashboard for the MovieBoyz Fantasy Box Office league.

`data.json` is stored on the `data` branch and auto-updated daily by [movieboyz-fetcher](https://github.com/dthunder746/movieboyz-fetcher). `index.html` fetches it at runtime from `raw.githubusercontent.com`.

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production — built and deployed by GitHub Actions |
| `dev`  | Development — test here before merging to `main` |
| `data` | Data only — contains `data.json`, never merged into code branches |

## Local Development

### 1. Install dependencies (first time only)

```bash
nvm use        # switches to the pinned Node version (.nvmrc)
npm install
```

### 2. Get latest data

`data.json` is gitignored — fetch the latest from the `data` branch before testing:

```bash
curl https://raw.githubusercontent.com/dthunder746/movieboyz-site/data/data.json -o data.json
```

### 3. Start the dev server

```bash
npm run dev
```

Then open the URL printed in the terminal (default `http://localhost:5173`).

### 4. Branch workflow

```bash
# Make sure you're on dev
git checkout dev
git pull origin dev

# ... edit, test locally ...

git add <files>
git commit -m "feat: ..."
git push origin dev

# Deploy to production
git checkout main
git merge dev
git push          # triggers GitHub Actions build → Pages deploy
git checkout dev
```

---

## GitHub Pages Setup

1. Settings → Pages → Source → **GitHub Actions**
2. CNAME file (`public/CNAME`) carries the custom domain through the build automatically
3. DNS: CNAME record pointing your subdomain → `dthunder746.github.io`
   - Proxy must be **disabled** (grey cloud on Cloudflare) for GitHub to issue its SSL cert
