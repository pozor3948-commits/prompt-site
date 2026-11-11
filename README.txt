PROMPTFORGE — Cloudflare Workers Direct Upload

This repository contains the PromptForge frontend and the Worker API.

Files:
- _worker.js — Worker entrypoint; handles POST /api/prompt and serves static files through env.ASSETS.
- public/index.html, public/app.js, public/styles.css — public website files.
- wrangler.jsonc — configures Worker Static Assets and the ASSETS binding.

Deployment:
1. Deploy this repository as a Cloudflare Worker named prompt-site using Wrangler and wrangler.jsonc.
2. In Cloudflare Dashboard open Workers & Pages > prompt-site > Settings > Variables and Secrets.
3. Add a secret named OPENROUTER_API_KEY with your OpenRouter API key.
4. Redeploy after adding the secret if the dashboard requests it, then test the website.

Optional variable:
OPENROUTER_MODEL = nvidia/nemotron-3-ultra-550b-a55b:free

Never put the API key in public/index.html, public/app.js, public/styles.css, or any other public file.
