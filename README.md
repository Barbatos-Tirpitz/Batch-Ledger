# Batch Ledger

A small, local-first app for tracking how much of each ingredient a product consumes.

Log what you produce → the app derives ingredient consumption from each product's recipe → the dashboard updates instantly. No server, no database to manage — everything lives in your browser's local storage on this device.

## Concept

- **Ingredients** — your raw materials (name, unit, optional cost/unit)
- **Products** — a recipe: which ingredients, and how much of each, go into one unit of the product
- **Production Log** — what you actually produced, and when
- **Dashboard** — consumption per product and in aggregate, computed automatically as `recipe quantity x units produced`

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. To build a static production bundle:

```bash
npm run build
```

The output goes to `dist/` — this is a static site, so you can host it anywhere or run it fully offline.

## Data & storage

All data is stored in your browser's `localStorage`, scoped to this app, on this device. There's no backend and nothing is sent anywhere. Because of that:

- Clearing your browser's site data will erase it — use the CSV export regularly as a backup.
- Data won't sync across devices or browsers by design (see "Notes" below if you outgrow this).

## CSV import/export formats

**Ingredients** (`ingredients.csv`)
```
name,unit,cost
Cocoa butter,kg,8.50
Sugar,kg,1.20
```

**Products / recipes** (`products.csv`) — one row per ingredient used in a product:
```
product,ingredient,qty_per_unit
Dark chocolate bar 100g,Cocoa butter,0.045
Dark chocolate bar 100g,Sugar,0.02
```

**Production log** (`production_log.csv`)
```
date,product,qty_produced
2026-07-01,Dark chocolate bar 100g,500
```

Import matches ingredients/products by name (case-insensitive) and creates new ones automatically if they don't exist yet.

## Stack

- React + Vite
- Tailwind CSS
- Papaparse (CSV import/export)
- Recharts (dashboard chart)
- lucide-react (icons)

## Notes / possible next steps

- Swap `localStorage` for a local SQLite file (e.g. via a lightweight backend or Tauri/Electron wrapper) if you want a real file you can back up or move between machines.
- Add multi-device sync if more than one person/device needs to use this.
- Add per-ingredient stock levels and low-stock alerts.
