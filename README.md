# Vinted Tracker

A mobile-friendly, inventory-first React app. It starts from a fresh empty inventory; subsequent edits are saved in this browser's local storage.

## Inventory

- All items are shown in a scrollable table. Search across every field and filter sold/in-stock items.
- **+ Nuovo articolo** opens the item form with predefined and custom fields.
- Click any cell to edit it; Enter or blur saves, Escape cancels. The pencil opens the full item form. Deletion requires confirmation.
- **Campi** shows/hides predefined columns and creates custom text, number or date columns. Custom columns can be renamed; columns and their values can be deleted with confirmation. Hidden columns are still included in CSV exports and item forms.
- **Importa CSV** adds a CSV into the current inventory after confirmation; export a backup first if you want to replace the current data. **Esporta CSV** downloads all items, including custom and hidden columns, regardless of active search/filter.
- **Metriche & grafici** is a separate tab, recalculated from the current inventory.

## CSV format and metrics

The first seven columns follow the original archive: quantity, ARTICOLO, purchase date, purchase cost, shop/publication, sale date, sale price. A header with ARTICOLO in the second column is required. Named extra columns become custom text fields on import. Values round-trip, but field types are not encoded in the CSV; custom fields reimport as text.

Both comma and semicolon delimiters are supported. Quoted commas, quotes, Unicode and multiline values are supported. Empty lines and legacy summary rows are excluded so totals are not counted twice. Repeated item names remain separate items.

Dates support ISO YYYY-MM-DD, legacy M/D/YYYY, and D/M/YY. A first component greater than 12 is interpreted as a day. Raw dates are retained so you can correct typos without silent rewrites. Ambiguous four-digit-year dates are interpreted as M/D/YYYY. Years before 2000 or after next year are excluded from monthly charts and time-to-sale. Negative sale intervals are excluded from time-to-sale.

Recorded sale prices mark items as sold, even when a sale date is missing. Missing purchase costs are treated as zero when computing margins. **Saldo di cassa** means all sales minus all purchases, including unsold stock; it is not realized profit. Monthly charts use each transaction's actual purchase/sale date, not the archive's manual section labels. Amounts are per row, not multiplied by the quantity column, matching the archive.

## Local data and privacy

There is no server, account, Vinted API connection or cross-device synchronization. Browser storage is device/origin-specific and can be cleared by the browser. CSV exports are the backup mechanism. A warning appears if local saving fails. Uploaded CSVs are processed locally.

## PWA

Production builds include a manifest, PNG and maskable icons, Apple touch icon and a Workbox service worker that caches the application shell. Open the production app online once and allow caching to complete; it can then reopen offline. Edits and analytics work locally while offline. Updates are offered via **Aggiorna app**, not forced while editing.

Deploy the contents of the generated dist directory on HTTPS with the app at the domain root. Localhost is also a secure context for testing. Install using **Installa app** or the browser menu on supported Android/desktop browsers. On iPhone use Safari → Share → Add to Home Screen. Installation prompts depend on browser/platform support. The development server does not enable the production service worker.

## Development and validation

- `npm install` — dependencies.
- `npm run dev` — development server.
- `npm run build` — type-check, build and generate offline cache.
- `npm run preview` — serve the production build.
- `npm run lint` — ESLint.
- `npm test` — CSV and metric regression tests.
- `npm run test:e2e` — browser flows and offline reload against a production build. Uses installed Microsoft Edge by default; set PLAYWRIGHT_CHANNEL to another installed supported channel if needed.
- `npm run icons` — regenerate PWA PNG icons.