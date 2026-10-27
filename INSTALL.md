# Agent-assisted installation

Use these instructions when the user asks you to install this GitHub link. Complete the installation and launch; do not merely explain commands to the user.

1. Confirm you have local file and process tools on the user's computer. ChatGPT desktop local Work, local Codex and Claude Code are suitable when their local tools are enabled. If you only have a cloud/browser chat, explain that limitation and ask the user to continue in a local-capable assistant. Never claim a cloud-container installation is installed on their computer.
2. Choose a per-user installation folder. The default is `~/.product-studio/app`; an existing user-selected folder is also fine. Download or clone `https://github.com/jlvsebastian-stack/product-studio-pilot`. If the folder already contains files, inspect and preserve them; never delete it to force installation. Reuse a valid existing Product Studio checkout or choose an empty folder. Read its README, AGENTS.md and package.json.
3. Find Node.js 22 or newer. Reuse an available local/bundled runtime when appropriate. If missing, install the official Node.js LTS from nodejs.org using the normal supported installer/package manager and the user's existing permissions. Do not disable system protections or invent a privileged workaround. Handle a genuine OS approval prompt normally.
4. In the app folder run `npm ci --no-audit --no-fund`. This installs the pinned official Codex/Claude Code helpers and document libraries. If it fails, report the specific cause; do not pretend setup succeeded.
5. Run `node scripts/setup.js`. This records the app/runtime location and installs the minimal launcher skill for supported local agents. It must preserve unrelated existing skills. Do not copy the creator-interview skills into unrelated global AI behavior.
6. Run `node scripts/launch.js`. Wait for its confirmed local URL; it starts the app in the background and opens the browser. If already running, reuse it. Do not use desktop automation or take over an existing browser tab.
7. Tell the user it is ready and that next time they can say **Launch Product Studio**. They choose their own AI account and complete provider sign-in themselves. Never ask for account passwords, session tokens, or API keys.

No hosting, Vercel, public MCP service, extra database or account platform is part of this installation. Canva and Workspace are optional; PDF/text downloads are the default. Any local tool approval still applies.
