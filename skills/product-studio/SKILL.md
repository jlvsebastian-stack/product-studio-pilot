---
name: product-studio
description: Launch, open, or start the locally installed Product Studio app in the user's browser. Use for requests such as "Launch Product Studio"; the interview itself happens inside that app.
---

<!-- product-studio-launcher:v1 -->

Read `~/.product-studio/install.json`. It records the installed `appRoot` and `nodePath`; require `kind` to be `product-studio-install` and check that the recorded app folder contains package `product-studio-local`.

Run the recorded Node executable with the single script argument `<appRoot>/scripts/launch.js`. Use separate arguments and the app folder as the working directory. The launcher starts the local server in the background or reuses its existing instance, then opens the actual local URL in the browser. Wait for its ready message; an error is not a successful launch. Do not add hosting, API keys, desktop controls, or another chatbot.

If no installation record exists, follow the repository's `INSTALL.md` at https://github.com/jlvsebastian-stack/product-studio-pilot. This requires an AI environment with permission to execute on the user's own computer. A cloud-only chat cannot install or run a localhost app on that computer.
