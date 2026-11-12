# Recomp Tracker

A 4-day upper/lower recomp program that logs every set of every workout and keeps the history between sessions.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # static build in dist/ — host anywhere (Netlify, GitHub Pages, Vercel)
```

`src/App.jsx` is self-contained, so you can also paste it into a Claude artifact.

## How it works

- **Start a workout** on a day tab. Each exercise gets a row per set with weight, reps and a ✓ button.
- The **Last** column and the placeholders show what you did last time. Tapping ✓ on an empty row fills it with those numbers.
- Checking a set starts a **rest timer** based on that exercise's prescribed rest.
- **★** marks a set that beats your best for that lift (estimated 1RM, or reps for bodyweight).
- **↑ add weight** shows when you hit the top of the rep range on every set last time.
- **Finish & save** stores the session. A workout in progress also survives closing the tab.
- The **History** tab lists every session, and you can edit or delete sets there.

## Storage

Everything is stored under one key (`recomp:v2`), in `localStorage` or in `window.storage` when it runs as a Claude artifact.
Logs from the old version (`pl:*` keys) are imported automatically the first time it runs.
Data stays in one browser on one device. Use **Backup / Restore** to download a JSON file and move it somewhere else.

## Hosting

Every push to `main` builds the app and publishes it to GitHub Pages through `.github/workflows/deploy.yml`:
https://concall02.github.io/Recomp-Tracker/

On your phone, open that link and use **Add to Home Screen**. It then opens like an app, and your log stays saved in that browser.
