---
name: calculator-craft
description: Create usable calculators with explicit input assumptions, correct calculation logic, meaningful outputs and invalid-input protection.
---

# Calculator Craft

## Planning Contract

For outline planning only, preserve the approved decision and calculation. Name required inputs and units, the calculation's meaning, output, hand-checkable example and important zero or percentage boundary. Do not draft cells, expand the model or claim a native calculator exists.

## Production Contract

Start with the decision or calculation the buyer needs. Specify every required input, its unit, valid range, default or intentionally blank state, calculation rule and output. Distinguish assumptions from measured inputs and explain the result in everyday language.

Provide a complete labeled numerical example and show how changing a meaningful input changes the result. Account for rounding, zero denominators, missing inputs and relevant distinctions such as margin versus markup. Withhold a misleading result when essential inputs are invalid and explain what needs correction.

In native production, use actual formulas referencing editable inputs. Verify the starting example, an input change and the relevant invalid case through calculated readback, then restore the useful starting values. Use the existing verified Google Sheets flow. Do not leave developer test matrices in the delivered file, promise financial outcomes or change approved logic without permission.

Make the dependency chain inspectable: input quantity and unit → calculation → named result and unit → what that result means. Define percentages explicitly, including the base to which each applies. Do not conflate cost, price, markup, margin or net profit. Show a labeled hand-calculated example that agrees with the native formula; illustrative prices are not market recommendations.

Put the main result close to the small set of inputs that change it. Explain what the calculator includes and excludes and which inputs the buyer must measure. Give blank, zero and negative values separate treatment according to meaning. Guard impossible percentages, mismatched units and division by zero before displaying an actionable answer. Do not silently clamp invalid data or disguise invalid inputs as a valid zero result.

Match count validation to the named unit. A number of whole finished items must reject fractional counts in its formula guard as well as input validation; a measured amount such as hours or kilograms may be fractional. Test one fractional-count case when the model uses whole items.

Keep precision during intermediate calculations and explain final rounding where it affects the decision. Check one representative case independently, then change an influential input and test the relevant boundary in native cells. Confirm all dependent outputs update and restore the starting example. Run these checks within the existing production step; do not extend the creator interview or add an approval gate.

## Reference Basis

Original adaptation of explicit metric denominators and calculation examples from [ai-boost's data_analyst prompt](https://github.com/ai-boost/awesome-prompts/blob/main/prompts/data_analyst.txt), input/reference constraints from [Excel Formula Sensei](https://github.com/ai-boost/awesome-prompts/blob/main/library/en/data.md), and traceable derived figures from [financial_operations_compliance_agent](https://github.com/ai-boost/awesome-prompts/blob/main/prompts/financial_operations_compliance_agent.txt). No text-only formula simulation, financial advice role or fund-accounting workflow is adopted.

## Visual Design

<!-- Modified 2026-11-02: design guidance adapted from Anthropic skills (Apache-2.0), pinned at ca45fc496a3436251f191354091d557da31c15b5. See THIRD_PARTY_NOTICES.md. -->

- Use the topic-appropriate shared design direction in Google Sheets: place the main result beside the few editable inputs that change it, with a clear heading, units and restrained emphasis.
- Distinguish editable inputs, formulas, assumptions and warnings using labels plus consistent formatting; never color alone. Keep precision and number formats appropriate to the decision.
- Check actual cell widths, wrapping and output visibility after an input change. A chart is useful only when supported values explain the calculation; decoration must not obscure invalid-input messages.

## Final Quality Review

- Verify the actual native result against a worked calculation, change a meaningful input, and check relevant blank, zero and boundary/invalid cases; inspect units and percentage bases.
- Check inputs and outputs are editable or calculated as intended, legible and clearly distinguished, with correction messages instead of misleading answers. Fix safe display formatting without changing approved calculation logic.
- Restore useful starting inputs. Report unverified calculations or substantive concerns honestly, with only grounded optional improvements under the shared review boundaries.
