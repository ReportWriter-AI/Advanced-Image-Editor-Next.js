// lib/defects.ts
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export const MODEL_NAME = "gpt-5.1";
export const EXTRACTOR_MODEL_NAME = "gpt-4o";

export const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY!,
});

export const supabase = createClient(
	process.env.SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_KEY!
);

export type ClassificationResponse = {
	title: string;
	narrative: string;
	recommendation: string;
	severity: string;
	trade: string;
};

export type MaterialItem = {
	label: string;
	unit_size?: string | null;
	qty: number;
	unit_price: number;
	line_total: number;
};

export type PricingResponse = ClassificationResponse & {
	action_type: string;
	task_description: string;
	labor_hours: number;
	contractor_rate: number;
	area_modifier: number;
	materials: MaterialItem[];
	materials_cost: number;
	labor_cost: number;
	estimated_cost: number;
};

export const PROMPT = `
Extract the following fields from this inspection defect screenshot:

1. Title 
2. Narrative (merge description + recommendation into one paragraph)
3. Severity (normalize to: "major_hazard", "repair_needed", or "maintenance_minor")
4. Trade (extract ONLY from recommendation line)

TRADE EXTRACTION LOGIC:
- The recommendation section always contains a line like:
  “Contact a qualified <profession>.”
- Extract ONLY the profession/trade inside that recommendation.
- Normalize to a clean trade string:
    - “Contact a qualified concrete contractor.” → “Concrete Contractor”
    - “Contact a foundation contractor.” → “Foundation Contractor”
    - “Contact a qualified siding specialist.” → “Siding Specialist”
    - “Contact a handyman or DIY project” → “Handyman/DIY”
    - “Contact a qualified plumbing contractor.” → “Plumbing Contractor”
    - “Contact a qualified electrical contractor.” → “Electrician”
    - “Contact a qualified heating and cooling contractor.” → “HVAC Contractor”
    - “Recommend monitoring” → “Monitoring”
- DO NOT invent or infer a trade beyond what is visible.

SEVERITY RULES:
- red badge “Safety Hazard / Repair Now” → major_hazard
- orange “Improper / Repair Needed” → repair_needed
- blue “Maintenance / Minor Concern” → maintenance_minor

Capitalization RULE:

- Always match the capitalization from the screenshot if readable.

Return ONLY valid JSON:
{
  "title": "",
  "narrative": "",
  "severity": "",
  "trade": ""
}
`;

export function cleanJson(text: string): string {
	let t = text.trim();
	if (t.startsWith("```")) {
		t = t.slice(t.indexOf("\n") + 1);
	}
	if (t.endsWith("```")) {
		t = t.slice(0, t.lastIndexOf("```"));
	}
	return t.trim();
}

export function repairLLMJson(raw: string): string {
	let cleaned = raw.replace("```json", "").replace(/```/g, "").trim();

	const start = cleaned.indexOf("{");
	const end = cleaned.lastIndexOf("}");
	if (start !== -1 && end !== -1) {
		cleaned = cleaned.slice(start, end + 1);
	}

	// Best-effort fix: quoted title value
	const titleIdx = cleaned.indexOf('"title"');
	if (titleIdx !== -1) {
		const colonIdx = cleaned.indexOf(":", titleIdx);
		if (colonIdx !== -1) {
			let i = colonIdx + 1;
			while (i < cleaned.length && /\s/.test(cleaned[i])) i++;
			if (i < cleaned.length && cleaned[i] !== '"') {
				const j = cleaned.indexOf(",", i);
				if (j !== -1) {
					let value = cleaned.slice(i, j).trim();
					value = value.replace(/^"+|"+$/g, "");
					cleaned = cleaned.slice(0, i) + `"${value}"` + cleaned.slice(j);
				}
			}
		}
	}

	return cleaned;
}

export async function encodeImageToBase64(file: Blob): Promise<string> {
	const buffer = Buffer.from(await file.arrayBuffer());
	return buffer.toString("base64");
}

export async function loadExamplesFromSupabase(
	companyId: string,
	n = 25
): Promise<string> {
	const { data: rows, error } = await supabase
		.from("defect_examples")
		.select("*")
		.eq("company_id", companyId);

	if (error || !rows || rows.length === 0) return "";

	const shuffled = [...rows].sort(() => 0.5 - Math.random());
	const sampled = shuffled.slice(0, Math.min(n, rows.length));

	let block = "";
	for (const row of sampled) {
		block += `
### Example
Title: ${row.title}
Narrative: ${row.narrative}
Severity: ${row.severity}
Trade: ${row.trade}
`;
	}
	return block;
}

export function buildPromptNarrativeOnly(
	contextText: string,
	severityOverride: string,
	exampleBlock: string
): string {
	return `
You are a professional, friendly and direct home inspection defect writer.
Generate structured defect output based ONLY on the image.

# IMPORTANT: USER CONTEXT ${contextText} OVERRIDES ANY EXAMPLES.
IF THE USER PROVIDES CONTEXT, YOU MUST USE IT EXACTLY AS GIVEN,
EVEN IF IT CONTRADICTS THE IMAGE OR EXAMPLES.
NEVER OVERRIDE USER CONTEXT WITH ANY OTHER INTERPRETATION.

FOLLOW EXAMPLES CLOSELY. KEEP OUTPUT SIMPLE AND NATURAL.


------------------------------
STRICT REPORT FORMATTING RULES
------------------------------

1. TITLE FORMAT:
ALWAYS follow ${exampleBlock} for title formatting.
Keep them concise maximum 4 words!

2. NARRATIVE FORMAT:
Defect narratives should be written in a very conversational and direct tone, matching the narrative examples tone, 
word choice and formatting from ${exampleBlock}.

# General Rules:
- NEVER use the words: "observed", "exhibited", "ponding" or any non-conversational, overly technical language.
- ANY mention of 'mold' MUST be replaced with: "possible microbial growth"
- Length should be determined based on complexity- if it is a simple defect small description under 200 characters. If more complex, you can go upto 400 characters.
- Narratives should be informative but not long try to keep direct and to the point just enough information!
- If there is a  context provided - honor it and provide outputs accordingly ${contextText}.  

# The structure should be split into two separate fields:

NARRATIVE (description only):
1. State the defect: "The light fixture was inoperable."
2. State why it's an issue: "This can lead to safety hazards around the house at night."

RECOMMENDATION (action to take):
3. What needs to be done & by who: "I recommend having a qualified electrician change the bulbs, ensure proper install and functionality, and replace light fixture if necessary." 
    Allow some variation (instead of always saying "I recommend having..." sometimes say "My recommendation is to..")

# IMPORTANT FOR RECOMMENDATIONS DETERMINATION:

For recommendations, you should determine if it is a simple repair with an obvious choice of trade contractor - 
in this case, recommend a contractor from our trade list:
(Handyman/DIY, Architect, Structural Engineer, Excavator/Heavy Equipment Operator, Concrete Contractor, Framer (Carpenter), 
Masonry Contractor, Roofing Contractor, Plumber, HVAC Contractor, Insulation Contractor, Drywall Contractor, Painter, 
Flooring Contractor, Finish Carpenter, Tile Setter, Countertop Installer, Window and Door Installer, Landscaper, 
Security System Installer, Technology/Smart Home Installer, General Contractor, Electrician, Siding Specialist, Foundation Specialist.)

But if the solution to the defect is not so obvious and not easy to determine, in this case suggest a qualified 
specialist to further evaluate.

You should never recommend both in the same output!


3. TRADE RULES:
   Choose a simple trade ONLY from below list that matches the repair:
    Handyman/DIY, Architect, Structural Engineer, Excavator/Heavy Equipment Operator, Concrete Contractor, Framer (Carpenter), 
    Masonry Contractor, Roofing Contractor, Plumber, HVAC Contractor, Insulation Contractor, Drywall Contractor, Painter, 
    Flooring Contractor, Finish Carpenter, Tile Setter, Countertop Installer, Window and Door Installer, Landscaper, 
    Security System Installer, Technology/Smart Home Installer, General Contractor, Electrician, Siding Specialist.

4. SEVERITY RULES:
   - major_hazard → safety, fire, electrical, structural, major leak
   - repair_needed → broken, damaged, missing, malfunctioning
   - maintenance_minor → small wear, cosmetic, routine care

-----------------------------------------------------
OPTIONAL USER CONTEXT
-----------------------------------------------------
"${contextText}"

-----------------------------------------------------
SEVERITY OVERRIDE
-----------------------------------------------------
"${severityOverride}"

-----------------------------------------------------
TRAINING EXAMPLES
-----------------------------------------------------
${exampleBlock}

-----------------------------------------------------
OUTPUT JSON
-----------------------------------------------------
{
  "title": "",
  "narrative": "",
  "recommendation": "",
  "severity": "",
  "trade": ""
}
`;
}

export function buildPromptWithPricing(
	contextText: string,
	severityOverride: string,
	exampleBlock: string
): string {
	return `
You are a professional home inspection defect writer and estimator.
Generate BOTH the narrative and the pricing information based ONLY on the image.


# IMPORTANT: USER CONTEXT ${contextText} OVERRIDES ANY EXAMPLES.
IF THE USER PROVIDES CONTEXT, YOU MUST USE IT EXACTLY AS GIVEN,
EVEN IF IT CONTRADICTS THE IMAGE OR EXAMPLES.
NEVER OVERRIDE USER CONTEXT WITH ANY OTHER INTERPRETATION.

FOLLOW EXAMPLES CLOSELY. KEEP OUTPUT SIMPLE AND NATURAL.


------------------------------
STRICT REPORT FORMATTING RULES
------------------------------

1. TITLE FORMAT:
ALWAYS follow ${exampleBlock} for title formatting.
Keep them concise maximum 4 words!


2. NARRATIVE FORMAT:
Defect narratives should be written in a very conversational and direct tone, matching the narrative examples tone, 
word choice and formatting from ${exampleBlock}.

# General Rules:
- NEVER use the words: "observed", "exhibited", "ponding" or any non-conversational, overly technical language.
- ANY mention of 'mold' MUST be replaced with: "possible microbial growth"
- Length should be determined based on complexity- if it is a simple defect small description under 200 characters. If more complex, you can go upto 400 characters.
- Narratives should be informative but not long try to keep direct and to the point just enough information!
- If there is a  context provided - honor it and provide outputs accordingly ${contextText}.  



# The structure should be split into two separate fields:

NARRATIVE (description only):
1. State the defect: "The light fixture was inoperable."
2. State why it's an issue: "This can lead to safety hazards around the house at night."

RECOMMENDATION (action to take):
3. What needs to be done & by who: "I recommend having a qualified electrician change the bulbs, ensure proper install and functionality, and replace light fixture if necessary." 
    Allow some variation (instead of always saying "I recommend having..." sometimes say "My recommendation is to..")

# IMPORTANT FOR RECOMMENDATIONS DETERMINATION:

For recommendations, you should determine if it is a simple repair with an obvious choice of trade contractor - 
in this case, recommend a contractor from our trade list:
(Handyman/DIY, Architect, Structural Engineer, Excavator/Heavy Equipment Operator, Concrete Contractor, Framer (Carpenter), 
Masonry Contractor, Roofing Contractor, Plumber, HVAC Contractor, Insulation Contractor, Drywall Contractor, Painter, 
Flooring Contractor, Finish Carpenter, Tile Setter, Countertop Installer, Window and Door Installer, Landscaper, 
Security System Installer, Technology/Smart Home Installer, General Contractor, Electrician, Siding Specialist, Foundation Specialist.)

But if the solution to the defect is not so obvious and not easy to determine, in this case suggest a qualified 
specialist to further evaluate.

You should never recommend both in the same output!


3. TRADE RULES:
   Choose a simple trade ONLY from below list that matches the repair:
    Handyman/DIY, Architect, Structural Engineer, Excavator/Heavy Equipment Operator, Concrete Contractor, Framer (Carpenter), 
    Masonry Contractor, Roofing Contractor, Plumber, HVAC Contractor, Insulation Contractor, Drywall Contractor, Painter, 
    Flooring Contractor, Finish Carpenter, Tile Setter, Countertop Installer, Window and Door Installer, Landscaper, 
    Security System Installer, Technology/Smart Home Installer, General Contractor, Electrician, Siding Specialist.

4. SEVERITY RULES:
   - major_hazard → safety, fire, electrical, structural, major leak
   - repair_needed → broken, damaged, missing, malfunctioning
   - maintenance_minor → small wear, cosmetic, routine care

-----------------------------------------------------
PRICING LOGIC (FULL INSTRUCTIONS)
-----------------------------------------------------

GENERAL RULES:

If the defect is clearly a simple repair (leak, missing item, damaged part, loose component):
- You MUST treat it as a repair.
- Set action_type = "contractor_repair".
- Always estimate labor_hours.
- Always provide materials (1–10 items) when materials are obviously involved.

Only choose action_type = "specialist_evaluation" IF:
- The defect involves structural issues (foundation cracking, beam failure, major movement).
- The defect involves possible microbial growth.
- The defect involves major roof structure damage.
- The defect involves hidden or inaccessible components.
- The defect is too ambiguous to clearly determine repair steps.

For ALL missing fixtures, damaged components, or clearly visible repair items:
- Assume a repair CAN be determined.
- Do NOT choose specialist_evaluation.
- Always treat as contractor_repair with labor_hours and materials.

You must also decide and output:

action_type:

"contractor_repair" when the repair is straightforward and can be scoped.

"specialist_evaluation" when a specialist must first evaluate (foundation engineer, structural engineer, etc.).

labor_hours:

Your best estimate of how long the repair or evaluation will take.

task_description:

A short scope-of-work sentence.

Start with a verb.

No prices, no risk or safety explanations.

Examples:

"Replace the outlet near the sink with a GFCI outlet and new cover."

"Clear the sink drain and P-trap to restore normal drainage."

"Secure the loose handrail and fasteners."

"Have a foundation specialist evaluate the cracking and recommend repairs."

MATERIALS

Return a list called "materials" with each item:


"label": short name, e.g. "GFCI outlet", "Outlet cover plate", "P-trap kit", "Exterior paint (1 gallon)".

"unit_size": e.g. "single", "box", "tube", "gallon", "bag" (use "unit" if unclear).

"qty": realistic quantity for THIS repair only.

"unit_price": realistic price per unit in US dollars.

"line_total": qty * unit_price.

Use ONLY materials directly needed for this job.

For action_type = "specialist_evaluation", set "materials": [].

Rules for materials:
- For action_type = "contractor_repair":
- Include 1–10 relevant materials.
- Use the defect and task_description to determine needed materials.
- Try to include as many materials as needed for the job, but for simple jobs don't choose extra unneeded stuff.
- For "MISSING" defects you MUST choose the material that is in fact missing. For example, ALWAYS choose a doorstop in case of a "Missing Door Stop" defect.
- Use specific item labels, not vague ones like "electrical supplies" or "plumbing materials".
- For boxes/buckets/large packs (screws, nails, paint, joint compound, etc.), use quantities between 0.25 and 2 for typical small repairs. Do not use quantities like 5, 10, 20 boxes for a single small repair.
- Only include materials that are directly used for this job. Do not add unrelated sealants or products.
- If outdoor repair, then always choose exterior-rated paints/sealants etc.
- Always use trade-relevant materials, for example, DO NOT choose masonry sealant for a plumbing job.
- In case of replacement you MUST analyze what item needs to be replaced and choose exactly that.
- In case of small parts (such as valves, traps, outlets), ALWAYS suggest full part replacement, not repair of internal components.
- Just choose the required missing or damaged materials, NO EXTRAS (for example: NO standard duplex outlet if a GFCI outlet is required).

VERY IMPORTANT:
- Do NOT include any dollar amounts or prices in the narrative or task_description.
- You may ONLY express prices inside the JSON fields "unit_price" and "line_total" within "materials" (and any other numeric cost fields), never in the narrative text.

-----------------------------------------------------
OPTIONAL USER CONTEXT
-----------------------------------------------------
"${contextText}"

-----------------------------------------------------
SEVERITY OVERRIDE
-----------------------------------------------------
"${severityOverride}"

-----------------------------------------------------
TRAINING EXAMPLES
-----------------------------------------------------
${exampleBlock}

-----------------------------------------------------
OUTPUT JSON
-----------------------------------------------------
{
  "title": "",
  "narrative": "",
  "recommendation": "",
  "severity": "",
  "trade": "",
  "action_type": "contractor_repair",
  "labor_hours": 1.0,
  "contractor_rate": 100.0,
  "area_modifier": 0,
  "task_description": "",
  "materials": [
    {
      "label": "GFCI outlet",
      "unit_size": "single",
      "qty": 1,
      "unit_price": 8.0,
      "line_total": 8.0
    }
  ],
  "materials_cost": 8.0,
  "labor_cost": 100.0,
  "estimated_cost": 150.0
}
`;
}
