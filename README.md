# PartnerTrack — Partnership Obligation Intelligence

Automated contract parsing and fulfillment tracking for sports partnership teams.

## What it does

- Upload partnership contracts (PDF or image)
- Claude AI extracts obligations directly from each document
- Track fulfillment progress per partner and obligation type
- Social listening via Meltwater or AI fallback
- End-of-season dashboard with rights-fee deduction visibility

---

## Quick start

### 1. Prerequisites
- Node.js 18+ (https://nodejs.org)
- A Claude API key (https://console.anthropic.com)
- Your Cloudflare Worker deployed (see `worker.js`)

### 2. Install and run locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

### 3. Build for production

```bash
npm run build
```

Output goes to `/dist` — deploy this folder to any static host.

---

## Deployment options

### Netlify (recommended — free tier)
1. Push this repo to GitHub
2. Connect repo in Netlify → Build command: `npm run build` → Publish dir: `dist`
3. Deploy

### Vercel
```bash
npx vercel --prod
```

### Cloudflare Pages
```bash
npx wrangler pages deploy dist
```

### Manual (any static host)
Upload the contents of `/dist` to your server or S3 bucket.

---

## Cloudflare Worker setup

The app routes all Claude API calls through `worker.js` to avoid CORS issues.

1. Go to https://workers.cloudflare.com
2. Create a new Worker
3. Paste the contents of `worker.js`
4. Deploy
5. Update the `PROXY` constant at the top of `src/App.jsx` with your Worker URL

---

## Project structure

```
partnertrack/
├── src/
│   ├── App.jsx          # Main application (all UI and logic)
│   ├── main.jsx         # React entry point
│   └── index.css        # Global reset
├── worker.js            # Cloudflare Worker proxy (deploy separately)
├── index.html           # HTML shell
├── vite.config.js       # Vite config
├── package.json
└── README.md
```

---

## Configuration

The only value to change before deploying:

In `src/App.jsx`, line 4:
```js
const PROXY = "https://your-worker.workers.dev/";
```

Replace with your own Cloudflare Worker URL.

---

## Usage

1. Open the app → **Settings** tab → paste your Claude API key → click **Test**
2. Go to **Contracts** tab → upload contract PDFs or images
3. Click **Extract obligations** — Claude reads each file
4. View results in **Obligations** tab — edit completion counts, add evidence links
5. **Dashboard** shows fulfillment by partner
6. **Social Listening** tab — configure Meltwater or use AI fallback

---

## Tech stack

- React 18 + Vite
- All styles inline (no CSS framework dependency)
- Cloudflare Workers (API proxy)
- Anthropic Claude API (contract parsing + AI analysis)
