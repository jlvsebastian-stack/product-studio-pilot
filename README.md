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

The guided conversation discovers your expertise, narrows a buyer problem, checks comparable offers and shapes a useful product. Approve the basic outline, expanded plan and representative sample, then build the remaining full draft for one whole-product review. Shared skills supply the method; your answers supply the personalization. A workbook is one possible output. Aim for a focused first draft in about an hour; scope, provider speed and native-file creation can change the time needed.

The chosen format's final quality check runs during existing creation requests. It fixes obvious authorized defects while preserving approved work, then offers up to three grounded improvements and explains their buyer benefits. Suggestions do not create extra products or add an approval step.

Approve the basic outline to generate an **expanded outline of the entire product**. Review its ordered sections, purposes, key points, examples and activities before approving it. After the sample design is approved, **Build full draft** completes the remaining agreed sections for one whole-product review. You can edit the plan; a changed plan needs approval again before new content is written. Earlier drafts and illustrations stay available. This applies to all formats, with slides and presenter notes planned together for webinars.

Start with a useful baseline and build from it. Earlier answers are reused; detailed personal anecdotes, exact remembered wording, mistakes and exceptions are optional rather than a discovery checklist. The AI proposes the next direction or draft when enough is known. A necessary question briefly explains what its answer helps create in your lesson, section, outline or offer. Missing details are gathered when they matter to the current work, and unknown claims remain unknown. Sample and section approvals still protect your decisions and finished text.

You do not need a competitor list or research experience. The AI handles the initial comparison, explains relevant examples in plain language and helps you choose an angle. Unknown prices, reviews or demand remain unknown rather than blocking useful inspected product facts. If the lookup cannot finish, it explains the problem and a way to retry; it does not assign link-gathering homework. The chat partner is encouraging and practical, while your product keeps its own chosen voice.

The interview stays inside the app. The conversation is on the left, with project progress, the brief, outline and current draft on the right. **Save project** retains the full interview; **Open project** resumes it. Exported-page previews are optional; the workspace shows what is being built and what needs the creator's next decision.

Press **Enter** to send and **Shift+Enter** for a new line. Use the attachment control, paste or drag files into the composer, or include a public link. The app reads supported documents locally and supplies their extracted content or image input to the AI when you send. References stay with the project and are kept separate from personal preferences and sale files. Source facts are not automatically treated as the creator's own experience. Unavailable, scanned, partial or unsupported sources are labeled honestly.

The current prototype accepts five project references, files up to 3 MiB each / 6 MiB per upload, and up to two PNG/JPEG images of 512 KiB each. It extracts at most 16,000 characters per source / 60,000 per project and labels incomplete excerpts. Supported document types are PDF, DOCX, PPTX, XLSX, TXT, Markdown, CSV, TSV and JSON; public links supply readable page text. These are conservative limits in this app, not ChatGPT website or subscription limits. The local interview uses the official provider helper and does not inherit the website's upload system. Original document binaries are not retained; the project backup retains extracted text, source details and attached image inputs.

If a reply fails, choose an available model if necessary and use **Retry last message** to resend the retained original message and references. The app never silently changes provider or model.

**New project** retains your previous project. Autosave and **Save project** update the private local project library on this computer; **Open project** lists those projects even when the local port changes. **Download a backup** is an optional portable JSON file for moving work to another computer. Normal saving creates no Downloads files.

**My preferences** remembers explicit voice, design and workflow instructions. Inferred preferences are offered for confirmation. You can edit, forget or pause learning. Preferences apply across your projects and selected providers inside this app; project-specific facts stay with their project. They are not automatically copied into the provider's account memory or included in product downloads.

Choose a provider, a selected model and a quality setting in the app. The app automatically checks that exact combination through the official local helper before enabling Send or Retry. Successful checks stay quiet; only checking or an actionable problem is shown. Your choice is preserved instead of substituting another model. A recommendation is a starting choice, not proof of account access. The small connection check uses your normal subscription allowance; successful checks are reused briefly. Subscription usage limits still apply.

Both **GPT-6.1 Sol · High** and **GPT-6 Astra · Medium** have worked through the normal subscribed helper in this pilot. The app includes official Codex0.164.0; its earlier0.157.1 helper rejected Sol, and updating that helper resolved the rejection without changing the account or model. Your explicit model and quality selection always takes precedence over the starting recommendation. Claude choices require an eligible Claude Code account; live Claude inference remains unverified here.

Review a sample before approving it or expanding. For presentations, **Review slide samples** opens the current selected slide artwork in Visual direction; the generic PDF fallback is not offered as that design sample. Presentations are intended for Canva, and written documents for Google Docs, using each creator's own verified connection. A native editor link is shown only for an actual created file. Guides and workbooks keep their PDF/text sample review. Presentation PDF and text packages are explicitly labeled content fallbacks with a different layout. Approved text is retained while new sections are drafted. Explicit revision and previous-approved-version controls let you correct work early. The final stage offers relevant companion products and grounded listing copy; creating an extra product remains your choice.

For presentations, compare **Quiet editorial**, **Signal studio** and **Warm dimension** using the same lesson. Each direction shows a cover, teaching page and demanding example when one is present. Choose a direction, approve its rendered sample, then select **Create selected design in Canva**. With Canva connected to your own Codex account, the app imports that composition with editable text and native presenter notes, asks for normal one-call approval, and checks the returned file before exposing its editor link. The saved project retains the verified link; changed content or style labels it an earlier draft. Native Canva delivery through Claude is not implemented.

For written products and calculators, **Create in Google Docs** or **Create in Google Sheets** uses the creator's own connected Google Drive tools through the selected ChatGPT helper. This action authorizes one new private file, its scoped edits and readback; it does not publish, share, delete or change account settings. The app checks the actual native content/structure, or native formulas and calculated values, before showing a current verified editor link. A saved project keeps that source-bound receipt independently of PDF downloads; changes retain the earlier file while requiring a current creation. An unknown accepted creation is held instead of silently duplicated. Native Google delivery through Claude is not implemented; the app preserves that selection and explains the limitation.

Microsoft Office applications and downloads are not part of the user flow. Local packages contain PDF and Markdown/plain text, plus listing text when supplied. The presentation concepts and Canva transfer share their composition; the legacy PDF/text fallback has a different layout and is labeled as a content fallback. Your private working-brief checkpoint is kept out of the product ZIP; use Save project for a personal backup. Native cloud connections and results must actually work for the chosen account; a local file or setup instruction is not a completed cloud product. A PDF of a calculator is not a functioning spreadsheet. See TESTED.md for the separate live acceptance boundary.

A webinar is a presentation with slide-by-slide presenter notes. Canva is its editor and presentation destination; verify the actual pages and native notes before treating cloud delivery as complete. The fallback PDF contains the audience-facing slides and Markdown retains the complete text and notes. Hosting, presenting and recording are separate from creating these files.

## Manual start, if wanted

Extract the source ZIP into a new folder. With Node.js 22+ installed, run **Start.cmd** on Windows or **Start.command** on Mac (`bash Start.command` if Finder will not execute it). First launch installs dependencies. You can also run `npm ci`, `node scripts/setup.js`, then `npm start`.

## Your data

Projects are autosaved to a private local project library on this computer. Save project updates that library; Open project restores work even when the local port changes. Browser state and personal preferences remain local, without automatic device sync. Only Download a backup deliberately downloads a portable JSON file. Your messages and relevant approved preferences go to the provider you select for processing. Generated downloads are held temporarily in local memory and can be regenerated from your draft. No credentials, private interviews, or generated customer files belong in this repository.

This project is separate from KKY. See [TESTED.md](TESTED.md) for actual checks and unverified items, including other people's installations, Mac execution and live Claude. Native Google Docs/Sheets have real acceptance evidence; controlled producer tests are identified separately from live file tests.
