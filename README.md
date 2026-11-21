# Uploader Template

A small Indonesian-language image uploader. The browser sends an image to a Cloudflare Worker; the Worker stores it in a GitHub repository using the GitHub Contents API. The GitHub token is kept as a Cloudflare Worker secret and is never sent to the browser.

## Features

- Mobile-friendly image selection and preview
- JPG, PNG, and WebP support
- 8 MB upload limit
- Optional SEO-friendly filename
- Upload to `public/images/` in the configured GitHub repository
- Returns a public `raw.githubusercontent.com` image URL

## Deploy to Cloudflare Workers

1. Install Wrangler and authenticate: `npx wrangler login`.
2. Create a fine-grained GitHub Personal Access Token for the target repository with **Contents: Read and write** permission. Do not put the token in this repository or in browser code.
3. From this repository, set the token as a Worker secret:

   ```sh
   npx wrangler secret put GITHUB_TOKEN
   ```

4. Review `wrangler.toml`. The defaults target `scfklaten/uploader-template`.
5. Deploy:

   ```sh
   npx wrangler deploy
   ```

6. Open the deployed Worker URL and test an image upload.

## Security and production notes

- Never expose `GITHUB_TOKEN` in frontend JavaScript, HTML, or public configuration.
- This first version is a functional prototype and does not yet include client login, per-client authorization, rate limiting, or abuse protection. Do not distribute the public URL widely until access controls are added.
- For production, add authentication (for example Cloudflare Access or an application login), rate limiting, and per-client repository/path authorization.
- Uploaded image files are stored in the repository, so large images and frequent uploads increase Git repository size.
- This version preserves the uploaded image format. Automatic image compression/WebP conversion is not implemented yet.

## Local development

```sh
npm install --save-dev wrangler
npx wrangler dev
```
