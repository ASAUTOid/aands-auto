# A & S Auto – aands-auto.com

Static site in `site/`, served by Netlify. Admin page: https://aands-auto.com/#admin

- Cars and business details are saved with Netlify Blobs (`/api/data`), photos at `/photo/<id>`.
- Admin password: set `ADMIN_PASSWORD` in Netlify → Site configuration → Environment variables, then redeploy.
- If nothing has been saved yet, the site uses the data built into `site/index.html`.
