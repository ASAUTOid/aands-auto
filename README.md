# A & S Auto – aands-auto.com

[![Netlify Status](https://api.netlify.com/api/v1/badges/1b85b70d-ebed-4631-a41e-0f52b578401b/deploy-status)](https://app.netlify.com/projects/curious-kitsune-8bcf68/deploys)

Static site in `site/`, served by Netlify. Dealer dashboard: https://aands-auto.com/admin/ (inventory, leads, customers, deals, collections, reports, marketing feeds, settings).

- Cars and business details are saved with Netlify Blobs (`/api/data`), photos at `/photo/<id>`.
- Admin password: set `ADMIN_PASSWORD` in Netlify → Site configuration → Environment variables, then redeploy.
- If nothing has been saved yet, the site uses the data built into `site/index.html`.

## Third-party
- AI background removal in the photo studio loads `@imgly/background-removal` (AGPL-3.0) from jsDelivr in the browser. Source: https://github.com/imgly/background-removal-js

## Websites
- Main site template is chosen in Dashboard → Websites (`settings.mainTemplate`; `night` = original animated site in `site/index.html`).
- Extra websites live at `/w/<slug>` (rendered by `site/t/site.js`) or on their own domain once it is added as a domain alias in Netlify.
