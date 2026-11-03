# Kaya Ko Yan! Digital Product Creator

Created by Josh Sebastian.

A local app that interviews you about your knowledge and helps you create a useful, designed digital product. Watch your brief, outline and product pages develop in the workspace. It runs on your computer, in your browser, using your own ChatGPT or Claude subscription. This is a separate project from the KKY platform.

## Beta 0.3.21

Start with a small, trusted test group. Windows with a supported ChatGPT/Codex subscription is the tested path. Mac launch and live Claude generation still need independent testing. Creating native Canva, Google Docs or Google Sheets files currently requires the ChatGPT/Codex provider and the creator's own connected accounts; the Claude path offers local PDF/text output. No hosting or API key is needed. See [TESTER-START.md](TESTER-START.md) for the short test journey and [TESTED.md](TESTED.md) for proof and limits.

Design guidance adapts Anthropic's Apache-2.0 frontend-design, canvas-design and theme-factory skills to the creator's brief and our native-file workflow. Each format keeps its own visual rules; explicit preferences and the approved sample take priority over defaults. This does not change the selected AI model or guarantee a particular aesthetic result. Attribution and adaptation details are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Presentations use three art directions: **Quiet editorial**, **Signal studio**, and **Warm dimension**. Each slide gets a teaching purpose, visual idea, original artwork prompt and individual composition. Choose one template first, then generate and review three sample slides in that style before building the rest. The template previews are lightweight examples; only the selected style receives custom artwork. Illustrations run automatically by default, with an optional manual setting. Feedback can update one illustration without regenerating the other samples. New slides usually use fewer than 15 visible words, with the full source and explanations kept in presenter notes. Every slide retains at least40% empty space.

The original-artwork path currently uses your own connected Canva tools through ChatGPT/Codex. Planned image creation runs automatically after your template choice or illustration feedback; optional manual mode asks for each image. Existing unchanged artwork is saved locally and reused. Small local image previews are distinct from the original Canva MEDIA assets used in the editable presentation. Missing connections, failed generation or unconfirmed native notes remain unfinished; PDF and text are available as content fallbacks.

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

Bring what you know. Your AI creation partner helps turn it into a useful product for a specific audience, while you make the important decisions.

Keep the first product focused. Aim for a first draft in about an hour; the scope, AI response time and file creation can affect how long it takes.

### 1. Find a useful product idea

Start with something you know well or often help people do.

Together, you will:

- Choose a specific buyer and a problem worth solving.
- Compare existing offers and find ways to improve yours.
- Choose a format that suits the buyer: a guide, ebook, workbook, template kit, spreadsheet, presentation or course materials.

You do not need a competitor list or research experience. The AI handles the initial research, explains what it finds and keeps unverified claims clear. Existing offers help inform your direction; they do not guarantee sales.

### 2. Approve the plan and sample

Review three things before the full draft is built:

1. **Basic outline:** the main sections and their order.
2. **Expanded outline:** the whole product, including each section's purpose, examples and activities.
3. **Representative sample:** a real section or design that lets you check the approach early.

For presentations, choose one of the three visual directions first. Then review **three editable sample slides in Canva**, including their presenter notes, before approving the design.

You can request changes at these checkpoints. If you change the plan later, approve the updated plan before new content is written. Earlier drafts and artwork stay available.

### 3. Build the full draft

Select **Build full draft** to complete the remaining agreed sections. Review the whole product afterward, instead of approving every section separately.

The AI reuses your earlier answers and follows the approved plan, voice and design. It asks for missing details when they matter and explains how a necessary question will help your product.

Ask for a small correction whenever you need one. Targeted edits preserve the rest of your approved work, and previous-approved-version controls help you recover an earlier version.

### 4. Review, improve and finish

The chosen format's quality check runs during creation. It corrects obvious issues within the approved scope and offers **up to three useful improvements**, with a reason for each.

Open the actual finished file to check its content, layout and usability. You decide whether to apply further changes. Companion products and listing copy are optional.

### Work comfortably in the app

The conversation stays on the **left**. Your brief, outline, draft and next action appear on the **right**.

- **Send a message:** Enter sends; Shift+Enter starts a new line.
- **Add references:** attach or drag a supported file, paste an image, or include a public link.
- **Ask questions:** request an explanation or example whenever something is unclear.
- **Retry a failed reply:** use **Retry last message** to resend the original message and references.

References inform the work without becoming claims about your own experience. Partial, unavailable and unsupported sources are labeled honestly.

<details>
<summary>Supported references and current upload limits</summary>

Supported documents: PDF, DOCX, PPTX, XLSX, TXT, Markdown, CSV, TSV and JSON.

| Reference limit | Current allowance |
| --- | --- |
| Project references | Up to 5 |
| Ordinary files | 3 MiB each; 6 MiB per upload |
| PNG/JPEG images | Up to 2; 512 KiB each |
| Extracted text | 16,000 characters per source; 60,000 per project |

These are app limits, separate from the ChatGPT website's upload system. Documents supply extracted text; scanned or incomplete sources may need another format. Public links supply readable page text.

Original document files are not retained. A project backup keeps extracted text, source details and attached image inputs.

</details>

### Save your work and return later

| Button | What it does |
| --- | --- |
| **New project** | Starts fresh while retaining earlier projects. |
| **Save project** | Updates your private local project library. Autosave also runs as you work. |
| **Open project** | Resumes a saved project, even if the app's local address changes. |
| **Download a backup** | Downloads an optional JSON copy for moving work to another computer. |

Normal saving creates **no files in Downloads**.

### Make the product sound and look like you

Use **Your preferences** to remember explicit voice, design and workflow instructions. You can edit, forget or pause learning at any time.

The AI asks before saving an inferred preference. Preferences apply across your projects inside this app; project facts stay with their project. Your private profile is excluded from product downloads and is not automatically copied into your AI provider's account memory.

### Open your finished product

| Product | Where you review and edit it |
| --- | --- |
| Presentations and webinars | **Canva**, with editable slides and native presenter notes |
| Written products | **Google Docs** |
| Spreadsheets and calculators | **Google Sheets**, with working cells and formulas |

**Native Canva and Google delivery currently require ChatGPT/Codex and your own connected accounts.** Native delivery through Claude is not implemented; the app explains this without changing your provider.

Editor links appear after the actual file has been created and checked. Save/Open retains verified links; changed content or styling labels an older file as an earlier draft. An uncertain creation result is held for recovery rather than silently creating another copy.

PDF and Markdown/plain-text copies are local fallbacks. Presentation fallbacks use a different layout from the Canva design, and a calculator PDF is not a working spreadsheet. Microsoft Office is not required.

A webinar includes the presentation and slide-by-slide notes. Hosting, presenting and recording it happen separately.

### Choose your AI

Choose your provider, model and quality in the app. The app checks that exact selection before enabling Send or Retry and keeps successful checks quiet. It never silently substitutes another model.

Your subscription access and usage limits apply, including the small model-access check. Claude requires an eligible Claude Code account; live Claude generation remains unverified in this beta. See [TESTED.md](TESTED.md) for model checks and current limitations.

## Manual start, if wanted

Extract the source ZIP into a new folder. With Node.js 22+ installed, run **Start.cmd** on Windows or **Start.command** on Mac (`bash Start.command` if Finder will not execute it). First launch installs dependencies. You can also run `npm ci`, `node scripts/setup.js`, then `npm start`.

## Your data

Projects are autosaved to a private local project library on this computer. Save project updates that library; Open project restores work even when the local port changes. Browser state and personal preferences remain local, without automatic device sync. Only Download a backup deliberately downloads a portable JSON file. Your messages and relevant approved preferences go to the provider you select for processing. Generated downloads are held temporarily in local memory and can be regenerated from your draft. No credentials, private interviews, or generated customer files belong in this repository.

This project is separate from KKY. See [TESTED.md](TESTED.md) for actual checks and unverified items, including other people's installations, Mac execution and live Claude. Native Google Docs/Sheets have real acceptance evidence; controlled producer tests are identified separately from live file tests.
