# A & S Auto – aands-auto.com

[![Netlify Status](https://api.netlify.com/api/v1/badges/1b85b70d-ebed-4631-a41e-0f52b578401b/deploy-status)](https://app.netlify.com/projects/curious-kitsune-8bcf68/deploys)

Static site in `site/`, served by Netlify. Admin page: https://aands-auto.com/#admin

- Cars and business details are saved with Netlify Blobs (`/api/data`), photos at `/photo/<id>`.
- Admin password: set `ADMIN_PASSWORD` in Netlify → Site configuration → Environment variables, then redeploy.
- If nothing has been saved yet, the site uses the data built into `site/index.html`.
