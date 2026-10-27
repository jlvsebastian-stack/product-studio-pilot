# Product Studio — private ChatGPT pilot

A conversation with an expert, supportive interviewer that helps a creator turn their own knowledge, judgment, and experience into a useful digital product. A workbook is one possible output; it is not the creation process.

This is an independent project. It has no KKY code, accounts, database, deployment, or runtime connection.

## What testers use

Testers connect a private HTTPS MCP invite link to **their own ChatGPT account**. Their ChatGPT conducts the interview, writes with them, and uses its available research tools. They do not install this source code, share passwords, supply an API key, or use the project owner's AI account. Their account must allow custom MCP connections; account and workspace policies and usage limits apply.

The MCP service provides three tools and one interface: start the interview with the versioned skills, update the working product panel, and render reviewed files. The panel contains the brief, editable manuscript, stage approval, checkpoints, and downloads. Continue the conversation in ChatGPT's usual composer.

The twelve stages are expertise discovery; useful problem; audience; specific niche; actual market research; better offer and solution; format; refined outline; voice and design; creation one section at a time; review and improvement; packaging and real files. The creator chooses when to advance. The model receives the skills and instructions; they guide its behavior rather than guaranteeing that a language model can never skip a step.

## Files

The deterministic exporter renders the actual manuscript as a designed A4 PDF, editable Word document, editable PowerPoint pages for Canva import, Markdown, and a project checkpoint. The cover and body share a layout between PDF and PowerPoint; PowerPoint contains native editable text. Canva import must be checked for each product. This pilot does not create native Canva designs, illustrations, audio, or video.

There are three restrained color themes: clay, sage, and ink. The first pilot uses Lato's supported characters, including English and Tagalog. An unsupported symbol produces an actionable error rather than a silently broken PDF. This is a text-document production prototype, not a full design editor.

## Run locally

Use Node 22 or newer:

```sh
npm ci
```

Set `STUDIO_INVITE_TOKEN` to a cryptographically random string of at least 32 characters, then run:

```sh
npm start
```

The endpoint is `http://127.0.0.1:8788/mcp/YOUR-TOKEN`. Localhost is for development; external testers need the hosted HTTPS endpoint. `.env.example` documents the variable; this server reads environment variables, not a `.env` file automatically. Do not put the real invite into Git, screenshots, or issue comments.

`npm ci` retrieves two OFL-licensed Lato fonts from a pinned Google Fonts commit and checks SHA-256. Their license is included in `fonts/OFL.txt`. Font files, dependencies, private environment files, and test outputs are excluded from Git.

## Hosting and sharing

GitHub stores the private source and offers **Code → Download ZIP** to authorized repository collaborators. It does not run this server. Deploy this repository as a **new Vercel project**, with framework set to Other, using `vercel.json`. The install command is `npm ci`; no frontend build is required. Configure `STUDIO_INVITE_TOKEN` as a sensitive server environment variable before deployment. Use the new project's normal production endpoint for the pilot; a Vercel sign-in wall on that endpoint prevents ChatGPT from connecting.

Give the invite URL privately to a small trusted group. Anyone holding it can use the service; this is shared invite access, not individual identity verification. Rotate the environment value and redeploy to revoke the old link for everyone. The URL may appear in the hosting provider's request records. Do not put it in this README or publish it in the repository.

See [TESTER-START.md](TESTER-START.md) for installation and a short first test. No marketplace listing is needed for the custom MCP pilot. A future public release and any Claude installation need their own acceptance checks.

## Data handling

The service receives the brief and manuscript submitted in tool calls to render the panel and files. It keeps no project database, user accounts, saved transcripts, or server-side file library. Export bytes are generated in memory and returned only in the tool result's `_meta`; the model sees file names and page count. The UI asks the host to download each file using `ui/download-file`. If that host does not advertise download support, the panel explains the limitation and retains the draft. It must not claim a download completed merely because a file was prepared.

The chat, tool arguments, model context updates, and optional widget state follow ChatGPT's data handling. Hosting-provider infrastructure records still apply. A creator should save a checkpoint; do not assume the service can recover a project from a database. Imported checkpoints are validated before replacing visible work, and edits clear the old review and file exports.

## Verification

```sh
npm test
npm run test:panel
```

The automated suite uses an actual HTTP MCP client, not mocked tool return values. The panel harness at `http://127.0.0.1:8789` uses the same MCP tools and simulates the host bridge, with a labeled illustrative manuscript. It is a local test harness, **not proof of installation or download support in ChatGPT**. It is not deployed as a public endpoint. See [TESTED.md](TESTED.md) for evidence and unrun acceptance checks.
