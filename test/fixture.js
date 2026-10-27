import { freshProject } from '../src/product.js';
export function exampleProject(){
  const p=freshProject();p.stage=11;p.stageReady=true;p.summary='Illustrative export fixture; no market validation or customer results are claimed.';
  Object.assign(p.brief,{
    title:'A clearer client handoff',topic:'Planning a small client handoff',buyer:'A freelance designer handing over a first brand project',
    niche:'A first-time freelance designer handing over a small brand identity to a café owner',
    outcome:'Give a client the right files, clear usage notes, and an agreed next step.',format:'Practical guide',author:'Example author',tone:'Plain English with a few Tagalog notes',theme:'clay',
    productDraft:`# A clearer client handoff

## Decide what the client needs next

This is an illustrative teaching sample, not a claim about a real client. Before attaching a folder, ask the client what they will do with the files this week. A café owner preparing a menu has different immediate needs from an owner ordering an outdoor sign. Record the actual use, who will prepare it, and which constraints the supplier has given them. Kung hindi pa malinaw, magtanong muna. Do not guess a printer's production requirements.

The practical judgment is to separate the editable source from the file ready for a particular use. Explain the difference in the client's own language. Keep the original source protected and identify which deliverable they should send to the next person. If a requirement is unknown, label it as a question for the supplier rather than presenting your preference as a production rule.

## Prepare one useful folder

- Add the final files the client approved, with readable names such as café_menu_final.pdf.
- Include a short guide that says what each file is for and when it should be used.
- Retain the agreed source files and list the software needed to edit them.
- Use a file name like client_name rather than removing the underscore automatically.

Illustrative example: the owner needs to update opening hours tomorrow. Give them an editable version, show the exact text field to change, and ask them to perform one small change while you watch. If they cannot do it, improve the instructions before adding more assets. Do not count sending a file as evidence that the handoff succeeded.

## Check understanding before closing

Ask the client to find the file for their next task, explain which version they will use, and identify whom to contact if the supplier asks a technical question. A useful check is observable: they found the correct file and can explain the next action. “Looks great” is encouraging feedback, but it does not establish that the package is usable.

Write the next action here: ________________________

If the next action depends on a supplier, record the unanswered question and who will answer it. Agree on a date for the response and keep the unresolved item visible. This guide does not replace a production specification or an agreed scope of work. Review the final package against the actual agreement before sending it.
`});return p;
}
