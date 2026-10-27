import { freshProject } from '../../src/product.js';
export function designProject({long=false}={}){
  const project=freshProject();project.stage=11;project.stageReady=true;
  Object.assign(project.brief,{title:'A clearer client handoff',author:'Illustrative author',format:'Field guide and worksheet',theme:'sage',outcome:'Help a freelance designer prepare a usable handoff for a café owner.',designPlan:JSON.stringify({sections:[{heading:'A handoff in three steps',layout:'steps',purpose:'Follow the order of the handoff'},{heading:'Worked example',layout:'example',purpose:'See the judgment in a concrete example'},{heading:'Your handoff worksheet',layout:'exercise',purpose:'Apply the method to your next handoff'},{heading:'Ready to send checklist',layout:'checklist',purpose:'Check the package before sending'},{heading:'The next useful action',layout:'summary',purpose:'Choose a clear next step'}]}),productDraft:manuscript+(long?'\n\n## A longer troubleshooting reference\n\n'+Array.from({length:18},(_,i)=>'Reference '+(i+1)+': If the café owner cannot find the right file, ask which task they are trying to finish. Read the folder together, remove ambiguity from the instructions, and repeat the check. A missing supplier specification remains an open question. Do not invent a production requirement or treat a sent attachment as proof that the work is usable. Preserve the exact filename client_name_final.pdf and the link https://example.com/hand-off/reference-'+(i+1)+'.').join('\n\n'):'')+'\n'});return project;
}
const manuscript=`# A clearer client handoff

This is a labeled illustrative teaching product. The café, designer and situations below are fictional examples for practice. They are not customer results, a production specification, or market validation.

## What a usable handoff means

A handoff is usable when the recipient can find the right file for a real next task, understand what to do with it, and identify an unanswered question. Before attaching a folder, ask the café owner what they will do with the files this week. A menu update and an outdoor sign can require different files. Record the actual use, the person doing the work, and any supplier requirements already confirmed.

Separate the editable source from the file prepared for a particular use. Explain the difference in the client's own language. If a production requirement is unknown, write it as a question for the supplier. Do not present a preference as a technical rule. Kung hindi pa malinaw, magtanong muna.

## A handoff in three steps

1. Identify the next task. Ask what the owner needs to change, publish or send this week. Write down the action and who will perform it.
2. Prepare the relevant files. Include only the approved versions needed for that task. Add plain usage notes and identify the software required for editing.
3. Check understanding. Ask the owner to find the right file and explain what they will do next. Improve the instructions if the task remains unclear.

These steps form a sequence because the file choice depends on the next task, and the final check tests whether the chosen package supports that task. A folder with many files is not automatically a better handoff.

## Worked example

The café owner needs to change opening hours on a menu tomorrow. The designer supplies an editable menu, a reference PDF of the approved design, and a short note naming the text field to change. The owner changes one line while the designer watches. If they cannot find the field, the designer updates the note before adding more assets.

An illustrative usage note could read: Open café_menu_editable in the agreed design tool. Change the opening-hours text only. Save a copy with the date. Ask the print supplier for its export specification before preparing a print file. Keep the reference PDF available to compare spacing after the change.

The useful observation is whether the owner found the file and made the intended change. “Looks great” is encouraging feedback but does not establish that the package is usable. No revenue, customer satisfaction score or time saving is assumed in this example.

## Your handoff worksheet

Write one specific next task for the recipient: ______________________________

List the approved file that supports it: ____________________________________

Name the person who will use that file and the software they need: ___________

Record an unanswered supplier question and who will answer it: ______________

Describe the small action you will ask the recipient to perform: _____________

After the check, record what happened. If the recipient could not complete the action, improve the package or the instructions and repeat the same check. Leave an unknown answer visible rather than filling it with an assumption.

## Ready to send checklist

- [ ] The package contains the final versions the client approved.
- [ ] Filenames describe the purpose, for example client_name_final.pdf.
- [ ] The usage note explains which file supports the next task.
- [ ] Source files are included only when the agreed scope requires them.
- [ ] Software requirements and any supplier questions are visible.
- [ ] The recipient can find the right file and explain the next action.

A checked box records your review. It does not replace the actual agreement or an observable check with the recipient. Keep unresolved questions open until the appropriate person answers them.

## The next useful action

Choose the next handoff you are already preparing. Ask the recipient about one immediate task, then assemble the smallest complete package for that use. Review the agreement before sending and identify any unanswered supplier question.

Keep this three-part record: the task, the file, and the recipient's demonstrated next action. That record gives you a concrete basis for improving the next handoff without inventing outcomes.`;
