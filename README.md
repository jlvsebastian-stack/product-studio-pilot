# Product Studio — local pilot

Download from GitHub, launch on your computer, and complete the whole interview inside Product Studio. Each person uses their own ChatGPT subscription through official Codex, or their own Claude subscription through official Claude Code. This is independent of KKY and needs no hosted backend or shared AI account.

## Start on Windows or Mac

1. Download with **Code → Download ZIP**, then extract. A private repository requires repository access.
2. Install **Node.js 22 or newer** from https://nodejs.org once, if needed.
3. Windows: double-click **Start.cmd**. Mac: run **Start.command**; if Finder will not execute it, open Terminal in the extracted folder and run `bash Start.command`.
4. The first launch installs the app and official AI helpers. Internet is required. Your browser then opens your own local address, normally `http://127.0.0.1:8767`.
5. Choose **ChatGPT** or **Claude**, then complete the provider's own browser sign-in if needed. Existing eligible sign-ins can be reused. Product Studio never asks for your password or reads provider tokens. Your subscription access and usage limits apply; no API key is required.
6. Keep the launcher open while working. Closing it stops the local app. The interface runs in your browser; the selected AI provider processes the interview remotely through its official local tool.

## Create together

The twelve stages discover your actual expertise; choose a useful problem, audience and niche; inspect market offers; improve the solution and offer; choose format; refine outline; set voice/design; create section by section; review; and deliver actual files. A workbook is one possible output. Shared skills supply the method; your answers supply the personalization. You explicitly approve moving on.

The conversation is on the left and your working brief/editable product on the right. **Save project** retains the full interview; **Open project** resumes it. A product-file checkpoint can reopen the brief/draft but does not contain the original chat.

Written-product downloads include designed PDF, editable Word, native-text PowerPoint for Canva import, Markdown, a brief checkpoint and ZIP. This app downloads files in the browser; it never opens Word or PowerPoint. Review the text before export and inspect a Canva import before sale. A document specification is not a real Google Sheet.

Canva and Google Workspace need separate, supported account connections and real-file testing. An AI subscription sign-in does not automatically expose every connection from the provider's website in this local app. Native file creation must be verified before claiming it works.

## Your data

The interview/draft is saved in this browser on this computer. Keep a project checkpoint before clearing browser data. There is no project database. Generated downloads remain temporarily in local memory, expire after an hour and disappear when the server stops; regenerate from your saved draft. Your messages go to the selected AI provider. Provider data policies and usage limits apply.

No credentials, private interviews or generated customer files belong in Git. One tester's work/account is never used to serve another.

## Development

`npm ci` installs pinned dependencies; `npm start` starts locally. Set `STUDIO_OPEN_BROWSER=1` to open the browser automatically. `npm test` runs focused local-server/provider checks. Lato fonts are retrieved from a pinned source with SHA-256 verification and the included OFL license.

See TESTED.md for actual checks and UNRUN items. A Windows source check does not prove Mac execution; a simulated provider does not prove a live Claude reply; native cloud outputs need their own acceptance.
