# ig-demo

Automatische Instagram-posting flow voor woningaanbod op basis van `kolibri-aanbod.json`.

## Wat dit doet
- Leest de **laatste woning** uit `aanbod/kolibri-aanbod.json`
- Rendert een IG-kaart (image)
- Rendert optioneel extra woningfoto's als carousel-slides
- Uploadt de image naar Uploadcare
- Post met caption naar Instagram als carousel: IG-kaart eerst, daarna woningfoto's
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

# Instagram carousel
CAROUSEL_ENABLED=1
CAROUSEL_EXTRA_PHOTOS=9
CAROUSEL_OUTPUT_DIR=./output/carousel
CAROUSEL_IMAGE_URLS=

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

**Carousel in plaats van enkele foto**
- Met `CAROUSEL_ENABLED=1` wordt de IG-kaart de eerste slide.
- Daarna worden maximaal `CAROUSEL_EXTRA_PHOTOS` collage-slides toegevoegd.
- Elke collage-slide bevat maximaal drie woningfoto's en heeft hetzelfde formaat als de IG-kaart (`1080x1350`).
- De slides wisselen tussen twee indelingen: groot boven met twee foto's onder, en twee foto's boven met een groot beeld onder.
- Foto's vullen hun vak zonder vervaagde achtergrond; de uitsnede gebruikt aandachtspunt-detectie.
- De eerste vier unieke foto's uit de makelaarsfeed worden voor de IG-kaart gereserveerd en niet opnieuw in de carousel gebruikt.
- Bij minder beschikbare foto's wordt het aantal slides automatisch verlaagd en krijgt de laatste slide een passende layout.
- De laatste slide is een vaste call-to-action met woningadres, telefoonnummer en `city@remax.nl`.
- Met `carouselLastSlideImages` in een woningrecord kunnen maximaal drie belangrijke foto's bewust op de laatste fotocollage worden geplaatst.
- Met `carouselLastSlideLayout: "two-top-one-bottom"` kan die fotoset twee beelden boven en een breed beeld onder gebruiken.
- Met `carouselLastSlideHeroImage` wordt het belangrijkste overzichtsbeeld automatisch in het grote vak geplaatst, onafhankelijk van de bronvolgorde.
- Instagram ondersteunt maximaal 10 slides, dus 1 kaart + maximaal 9 extra foto's.
- Zet `CAROUSEL_ENABLED=0` om terug te gaan naar een enkele IG-card post.

**Caption te lang**
- Description wordt automatisch samengevat zodat het onder 2200 tekens blijft.

**IMAGE_URL niet geldig**
- Controleer of Uploadcare URL een shard gebruikt (`*.ucarecd.net`).
- Script volgt redirects en slaat de shard-URL automatisch op.

**Watcher post direct bij start**
- Zet `SKIP_INITIAL_POST=1` om dit te voorkomen.

---

Gemaakt voor automatische Instagram-posting van woningaanbod.
