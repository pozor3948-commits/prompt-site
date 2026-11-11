PROMPTFORGE — Cloudflare Pages Direct Upload

Upload this ZIP through Cloudflare Pages > Direct Upload. The ZIP top level contains index.html, app.js, styles.css and _worker.js.

After the first deployment, open your Pages project:
Settings -> Variables and Secrets -> Production -> Add secret
Name: OPENROUTER_API_KEY
Value: your OpenRouter key
Save, then create a new deployment by uploading this ZIP again so the Worker receives the secret.

Optional variable:
OPENROUTER_MODEL = nvidia/nemotron-3-ultra-550b-a55b:free
The Worker uses this as its default model, so this variable is not required.

Never put the API key in index.html, app.js, or any other public file.
