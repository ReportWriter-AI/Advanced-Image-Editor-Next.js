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

------------------------------
STRICT REPORT FORMATTING RULES
------------------------------

1. TITLE FORMAT:
Follow the examples for title formatting.
Keep them concise maximum 4 words!

2. NARRATIVE FORMAT:
- Conversational and direct tone.
- NEVER use: "observed", "exhibited", "ponding".
- Replace 'mold' with “possible microbial growth”.
- Short & to the point (≈200–400 chars depending on complexity).
- Honor any user context: ${contextText}.

Structure:
1. State the defect.
2. State why it’s an issue.
3. What needs to be done & by who (with some variation in wording).

3. TRADE RULES:
Choose a simple trade ONLY from this list:
Handyman/DIY, Architect, Structural Engineer, Excavator/Heavy Equipment Operator, Concrete Contractor, Framer (Carpenter), 
Masonry Contractor, Roofing Contractor, Plumber, HVAC Contractor, Insulation Contractor, Drywall Contractor, Painter, 
Flooring Contractor, Finish Carpenter, Tile Setter, Countertop Installer, Window and Door Installer, Landscaper, 
Security System Installer, Technology/Smart Home Installer, General Contractor, Electrician, Siding Specialist, Foundation Specialist.

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

USER CONTEXT: ${contextText} OVERRIDES EXAMPLES.

(Use the same rules as narrative-only, plus:)

PRICING LOGIC:

- If defect is a simple repair (leak, missing item, damaged part, loose component):
  - action_type = "contractor_repair"
- Only use "specialist_evaluation" for structural, possible microbial growth, major roof structure, hidden components, or very ambiguous defects.

You must output:

- action_type: "contractor_repair" | "specialist_evaluation"
- labor_hours: estimated hours
- contractor_rate: hourly rate (numeric)
- area_modifier: percentage integer (-, 0, +)
- task_description: short scope-of-work sentence, no prices.

MATERIALS (for contractor_repair):
- Array "materials": 1–10 items, each:
  - label (specific item),
  - unit_size,
  - qty,
  - unit_price,
  - line_total (qty * unit_price).
- For specialist_evaluation → materials: [].

Do NOT mention any dollar amounts or prices in narrative or task_description, only inside numeric JSON fields.

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
