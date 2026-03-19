# ig-demo

Automatische Instagram-posting flow voor woningaanbod op basis van `kolibri-aanbod.json`.

## Wat dit doet
- Leest de **laatste woning** uit `aanbod/kolibri-aanbod.json`
- Rendert een IG-kaart (image)
- Uploadt de image naar Uploadcare
- Post met caption naar Instagram
- Logt elke post in `output/post-log.jsonl`
- Optioneel: watcher die automatisch post bij nieuwe listings

## Vereisten
- Node.js 18+ (node-fetch en ES modules)
- NPM dependencies ge?nstalleerd

```powershell
cd ig-demo
npm install
```

## Snel starten

### Handmatig posten
```powershell
cd ig-demo
npm run render-post
```

### Automatisch posten bij nieuwe woningen
```powershell
cd ig-demo
npm run watch-kolibri
```

## Belangrijkste scripts
- `npm run render-post` ? apply ? render ? upload ? post
- `npm run watch-kolibri` ? detecteert nieuwe listing(s) en post automatisch
- `npm run view-log` ? bekijk logs (filters via .env)

## Config (in `.env`)
Belangrijkste velden:

```
# Instagram Graph API
IG_USER_ID=
IG_ACCESS_TOKEN=

# Uploadcare
UPLOADCARE_PUBLIC_KEY=
UPLOADCARE_STORE=1
UPLOADCARE_CDN_BASE=https://ucarecdn.com
UPLOADCARE_TRANSFORM=-/format/jpg/

# JSON bron
JSON_SOURCE_PATH=./aanbod/kolibri-aanbod.json
LISTING_ID=
LISTING_QUERY=

# Watcher
WATCH_INTERVAL_SECONDS=10
SKIP_INITIAL_POST=1
RETRY_COOLDOWN_SECONDS=60
POST_DELAY_SECONDS=15
```

## Logs
Logs worden geschreven naar:

```
output/post-log.jsonl
```

Bekijk logs:
```powershell
npm run view-log
```

## Veelvoorkomende issues

**Caption te lang**
- Description wordt automatisch samengevat zodat het onder 2200 tekens blijft.

**IMAGE_URL niet geldig**
- Controleer of Uploadcare URL een shard gebruikt (`*.ucarecd.net`).
- Script volgt redirects en slaat de shard-URL automatisch op.

**Watcher post direct bij start**
- Zet `SKIP_INITIAL_POST=1` om dit te voorkomen.

---

Gemaakt voor automatische Instagram-posting van woningaanbod.
