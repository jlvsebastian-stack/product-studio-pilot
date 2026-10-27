# Product Studio

A local app that interviews you about your knowledge and helps you create a useful digital product. It runs on your computer, in your browser, using your own ChatGPT or Claude subscription. PDF and text downloads work without optional Canva or Google Workspace connections.

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

The interview stays inside Product Studio. The conversation is on the left, with the brief and editable draft on the right. **Save project** retains the full interview; **Open project** resumes it.

PDF and text are default. Other editable formats and Canva-compatible pages are included in the file package. The app never opens Word or PowerPoint. Canva and Google Workspace are optional; setup instructions are inside the app. Their native-file route requires a supported connection and actual testing. A PDF of a calculator is not a functioning spreadsheet.

## Manual start, if wanted

Extract the source ZIP into a new folder. With Node.js 22+ installed, run **Start.cmd** on Windows or **Start.command** on Mac (`bash Start.command` if Finder will not execute it). First launch installs dependencies. You can also run `npm ci`, `node scripts/setup.js`, then `npm start`.

## Your data

The interview and draft are saved in this browser on this computer. Keep a project checkpoint before clearing browser data. Your messages go to the selected AI provider for processing. Generated downloads are held temporarily in local memory and can be regenerated from your draft. No credentials, private interviews, or generated customer files belong in this repository.

This project is separate from KKY. See [TESTED.md](TESTED.md) for actual checks and unverified items, including Mac execution, live Claude and native cloud-file creation.
