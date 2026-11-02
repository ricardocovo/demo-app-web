# Touchline - Little League Soccer

A responsive React + TypeScript frontend for [demo-app-api](https://github.com/ricardocovo/demo-app-api). Manage championships, teams, players, games and player stats, with rosters, team schedules, game stat lines and championship-filtered player totals.

**Trusted/local use only.** Neither this frontend nor the existing API adds authentication or authorization. Do not expose this as a public administration portal. Production access controls and TLS must be provided by your hosting environment. No backend or database schema changes are required.

## Run locally

Requires Node.js 22.12+ (or a supported newer LTS), npm, and the .NET 8 soccer API.

1. Start the API separately, following its own README. Its default address is `http://localhost:5249`.
2. In this repository, run:

   ```powershell
   npm ci
   Copy-Item .env.example .env.local
   npm run dev
   ```

3. Open the Vite URL printed in your terminal (normally `http://127.0.0.1:5173`).

Set `API_PROXY_TARGET` in `.env.local` if the API runs elsewhere, then restart Vite:

```dotenv
API_PROXY_TARGET=http://localhost:5249
```

The browser always requests same-origin `/api/...`. Vite forwards those requests to `API_PROXY_TARGET` and strips `/api`; no backend CORS changes are necessary. Never put secrets in frontend environment variables. `.env.local` is ignored.

If your machine defaults npm to a private registry, configure an approved public npm mirror for this project or pass `--registry=<approved-registry>` to `npm ci`. Do not disable TLS verification.

## Workflows

- Use the five navigation entries to search, filter, create, edit and delete records. Counts come from the API, not sample data.
- Open a record for championship teams, team rosters/games, player totals or game stats. Related names are links. Hash routes survive refresh and need no static-server fallback.
- Create championships before teams, teams before players/games, and players/games before player stats. Games require two different teams from the same championship; stats require an eligible player.
- Names are trimmed, required and limited to 100 characters. Years: 1900-2100; player ages: 3-18; minutes: 0-120; goals/assists: nonnegative 32-bit integers. Positions match the API string enum.
- Existing foreign keys are preserved on edit. If a changed parent makes a selection invalid, the form retains it with an explicit warning until you choose a valid value. List filters, by contrast, clear dependent filters when a parent changes.
- Confirm every deletion. The API's `409` explanations are shown without cascading deletes: teams with games cannot move championship; games with stats cannot change teams; stats cannot be duplicated for a player/game.
- Date-only values stay `YYYY-MM-DD` in requests and are displayed without local-time conversion.
- Retry failed loads or use **Refresh league** to refetch data. Mutations refetch related data and counts. Superseded loads are aborted and late results ignored.

## Verify

```powershell
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

Unit/component tests cover API errors/204/abort, field constraints, preserved relationships, server errors and stale responses. Browser tests use an isolated deterministic API double, not your database, to exercise all five CRUD flows, related views, filters, refresh, loading/empty/error states, validation, conflicts and keyboard focus at desktop/mobile sizes. Screenshot outputs are in ignored `test-results`.

An optional real API smoke test is **opt-in**. Run a separate API copy with a **disposable SQLite database**, start a frontend against that copy, and set:

```powershell
$env:LIVE_WEB_URL = 'http://127.0.0.1:5180'
npx playwright test tests\live.spec.ts
Remove-Item Env:LIVE_WEB_URL
```

This creates, updates and removes disposable records through the proxy, checks real `400`/`404`/`409` responses, and opens related views. Never point it at a primary checkout/database or shared/production data. It attempts dependency-ordered cleanup even on failure. The default browser run skips these real-API tests.

## Production hosting

```powershell
npm run build
```

Serve `dist` as static files. **Vite's development proxy is not included in the static build**, and `vite preview` is a local build preview, not production hosting. Provide a same-origin reverse proxy for `/api/` to the API, removing the prefix. For example, an Nginx server behind appropriate TLS and access controls:

```nginx
location /api/ {
    proxy_pass http://soccer-api:5249/;
    proxy_set_header Host $host;
}

location / {
    root /srv/touchline/dist;
    try_files $uri $uri/ =404;
}
```

The trailing slash on `proxy_pass` removes `/api/`. Deploy at the origin root (not an arbitrary subpath). Do not cache API responses as static assets. Restrict access to both frontend and API; the application itself intentionally has no login.

## Structure and design

`src/api.ts` is the typed HTTP boundary. `useLoad.ts` owns cancellable query lifecycles. `App.tsx` provides routing, lists and filters; `Detail.tsx` loads relationship endpoints; `ResourceForm.tsx` handles accessible forms/deletion. Shared contract types and validation live in `types.ts` and `validation.ts`.

Touchline is an original soccer identity informed by the supplied [Airbnb design analysis](https://getdesign.md/airbnb/design-md) and its [public design source](https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/airbnb/DESIGN.md): a white canvas, ink text, coral accents, generous spacing, soft cards and pill filters. System fonts and Lucide icons are used; no Airbnb logo, proprietary font, external image download or analytics is included. Colors are centralized in CSS theme variables; `?clawpilotTheme=light` or `?clawpilotTheme=dark` explicitly selects a theme.