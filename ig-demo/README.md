# Instagram woning-autopost

Productieflow voor het automatisch publiceren van nieuwe woningen op Instagram.

## Flow

1. Leest een woning uit `aanbod/kolibri-aanbod.json`.
2. Maakt een IG-card van `1080x1350`.
3. Maakt maximaal acht fotocollages en een CTA-slide.
4. Uploadt de afbeeldingen naar Uploadcare.
5. Publiceert een Instagram-carousel met maximaal tien slides.
6. Registreert de woning als gepubliceerd om dubbele posts te voorkomen.

## Installatie

Vereist Node.js 18 of nieuwer.

```powershell
cd ig-demo
npm ci
Copy-Item .env.example .env
```

Vul daarna minimaal deze waarden in:

```dotenv
IG_USER_ID=
IG_ACCESS_TOKEN=
UPLOADCARE_PUBLIC_KEY=
UPLOADCARE_SECRET_KEY=
UPLOADCARE_SIGNED_UPLOADS=1
JSON_SOURCE_PATH=./aanbod/kolibri-aanbod.json
LISTING_BASE_URL=https://remaxdenhaag.nl
```

`.env` en `output/` worden niet door Git gevolgd. Secrets horen alleen in de
secret manager of omgevingsvariabelen van de productieserver.

## Controleren

Controleer de configuratie en Instagram-token:

```powershell
npm run validate-production
```

Render alles zonder upload of Instagram-publicatie:

```powershell
npm run dry-run
```

## Een woning publiceren

Publiceer een specifieke woning:

```powershell
npm run post-listing -- 7687623
```

Dezelfde woning wordt niet tweemaal geplaatst. Alleen voor een bewuste repost:

```powershell
$env:FORCE_POST="1"
npm run post-listing -- 7687623
Remove-Item Env:FORCE_POST
```

## Koppeling met de makelaarswebsite

Laat de website na het opslaan van een nieuwe woning een achtergrondtaak
starten met:

```text
npm run post-listing -- <woning-id>
```

Voer dit niet uit binnen de webrequest zelf. Gebruik een job queue, worker,
scheduled task of apart proces. De productie-run gebruikt een lock zodat nooit
twee publicaties tegelijk dezelfde runtimebestanden kunnen gebruiken.

De website moet de woning eerst aan de JSON-bron toevoegen. Voor een directe
JSON-import is beschikbaar:

```powershell
node scripts/import-listing-file.js <pad-naar-woning-json>
```

## Automatische watcher

Voor een server die de JSON-bron lokaal bijwerkt:

```powershell
npm run watch-kolibri
```

De watcher verwerkt nieuwe woningen op volgorde. `SKIP_INITIAL_POST=1` zorgt
dat bestaande woningen bij de eerste start niet alsnog worden gepubliceerd.

## Runtime en herstel

- `output/runtime-config.json`: tijdelijke woningdata en geuploade URL's.
- `output/published-listings.json`: register tegen dubbele publicaties.
- `output/posting.lock`: voorkomt gelijktijdige runs.
- `output/post-log.jsonl`: publicatie- en foutlog.

Bewaar `output/published-listings.json` op persistente opslag. Verlies van dit
bestand kan dubbele posts veroorzaken. Gebruik bij containers of serverless
hosting daarom een database of persistent volume.

## Instagram-token

De productiecontrole valideert de token voor iedere run. Bij een verlopen token
stopt de flow voordat afbeeldingen worden gerenderd of geupload. Vervang tokens
via de secret manager; zet ze nooit in Git.

Wissel een nieuwe kortlevende token eenmalig om voor een beheerde long-lived
token:

```powershell
npm run exchange-token
```

Hiervoor zijn `IG_ACCESS_TOKEN` en `IG_APP_SECRET` nodig. De long-lived token
wordt in `output/instagram-token.json` opgeslagen en zeven dagen voor verloop
automatisch vernieuwd. Bewaar dit bestand op persistente, afgeschermde opslag.

## Carousel

- De eerste vier unieke foto's worden voor de IG-card gereserveerd.
- Gewone slides bevatten maximaal drie foto's.
- Layouts wisselen tussen groot-boven en groot-onder.
- De laatste slide is een CTA met het vaste kantoornummer en e-mailadres.
- Een woning kan optioneel `carouselLastSlideImages`,
  `carouselLastSlideLayout` en `carouselLastSlideHeroImage` bevatten.

Instagram ondersteunt maximaal tien slides per carousel.
