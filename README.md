# Kaya Ko Yan! Digital Product Creator

Created by Josh Sebastian.

A local app that interviews you about your knowledge and helps you create a useful, designed digital product. Watch your brief, outline and product pages develop in the workspace. It runs on your computer, in your browser, using your own ChatGPT or Claude subscription. This is a separate project from the KKY platform.

## Install with one message

In **ChatGPT desktop with local work enabled, Codex, or Claude Code**, send:

> Install Product Studio from https://github.com/jlvsebastian-stack/product-studio-pilot on my computer, set up its launcher, and open it.

The assistant should follow [INSTALL.md](INSTALL.md), handle Node.js and dependencies, and install the small launch shortcut. You do not need to copy terminal commands. Your AI may request its normal permission to install software or open the browser.

Use a local-capable assistant. A regular ChatGPT or Claude website chat without local computer tools cannot install or launch software on your computer.

## Launch next time

Ask the same local assistant:

> Launch Product Studio.

In Codex or Claude Code you can also invoke the installed **product-studio** skill. Start a new chat if the assistant has not loaded the newly installed skill yet. It starts the local server in the background and opens your browser automatically. If the app is already running, it reuses that instance.

Choose ChatGPT or Claude in the app and complete the provider's official sign-in if needed. Your subscription access and usage limits apply; Product Studio never asks for your password or copies provider tokens. Claude requires an eligible Claude Code account. No hosted backend, shared AI account, or API key is required.

## Create together

The twelve stages discover your expertise; choose a useful problem, audience and niche; inspect market offers; improve the offer and solution; choose format; refine outline; set voice/design; create section by section; review; and deliver files. Shared skills supply the method; your answers supply the personalization. You explicitly approve moving on. A workbook is one possible output.

The interview stays inside the app. The conversation is on the left, with project progress, the brief, outline and current draft on the right. **Save project** retains the full interview; **Open project** resumes it. Exported-page previews are optional; the workspace shows what is being built and what needs the creator's next decision.

**New project** retains your previous project. Local autosave keeps work in this browser, while **Save project** downloads a portable backup. Keep a backup before clearing browser data or changing computers.

**My preferences** remembers explicit voice, design and workflow instructions. Inferred preferences are offered for confirmation. You can edit, forget or pause learning. Preferences apply across your projects and selected providers inside this app; project-specific facts stay with their project. They are not automatically copied into the provider's account memory or included in product downloads.

Choose a provider, a selected model and a quality setting in the app. Recommended models are starting choices, not proof of account access. The official local tool must accept the model; an unavailable model produces an error rather than a silent provider/model change. Subscription usage limits apply.

The pilot recommends **GPT-6 Astra · Medium**, verified with an actual subscribed interview. GPT-6.1 Sol is an alternative where the account supports it. Claude choices require an eligible Claude Code account; live Claude inference remains unverified here.

Download a clearly marked draft sample for review before approving it or expanding. Import its PPTX into Canva or open its DOCX with Google Docs to inspect the layout there, then give feedback in the app. These are editable file handoffs, not a claim that a native cloud file has already been created. Approved text is retained while new sections are drafted. Explicit revision and previous-approved-version controls let you correct work early. The final stage offers relevant companion products and grounded listing copy; creating an extra product remains your choice.

PDF and text are default. Designed previews and downloads use the same page layout. Other editable formats and Canva-compatible pages are included in the file package. Your private working-brief checkpoint is kept out of the product ZIP; use Save project for a personal backup. Useful built-in diagrams and optional creator-provided images support the product's content. The app never opens Word or PowerPoint. Canva and Google Workspace are optional; setup instructions are inside the app. Their native-file route and AI image generation require supported connections and actual testing. A PDF of a calculator is not a functioning spreadsheet.

## Manual start, if wanted

Extract the source ZIP into a new folder. With Node.js 22+ installed, run **Start.cmd** on Windows or **Start.command** on Mac (`bash Start.command` if Finder will not execute it). First launch installs dependencies. You can also run `npm ci`, `node scripts/setup.js`, then `npm start`.

## Your data

Projects and personal preferences are saved in this browser on this computer; this does not sync across browsers or devices. Your messages and relevant approved preferences go to the provider you select for processing. Generated downloads are held temporarily in local memory and can be regenerated from your draft. No credentials, private interviews, or generated customer files belong in this repository.

This project is separate from KKY. See [TESTED.md](TESTED.md) for actual checks and unverified items, including Mac execution, live Claude and native cloud-file creation.
