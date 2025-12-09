// app/api/classify/route.ts
import { NextRequest } from "next/server";
import {
	MODEL_NAME,
	openai,
	supabase,
	encodeImageToBase64,
	repairLLMJson,
	buildPromptNarrativeOnly,
	buildPromptWithPricing,
	loadExamplesFromSupabase,
	ClassificationResponse,
	PricingResponse,
	MaterialItem,
} from "@/lib/defects";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	try {
		const formData = await req.formData();

		const file = formData.get("file");
		const companyId = formData.get("company_id")?.toString() || "";
		const context = formData.get("context")?.toString() || "";
		const includePricing =
			formData.get("include_pricing")?.toString() === "true";
		const zipCode = formData.get("zip_code")?.toString() || "";
		const overheadProfitFactor = parseFloat(
			formData.get("overhead_profit_factor")?.toString() || "1.0"
		);
		const severityOverride =
			formData.get("severity_override")?.toString() || "";
		const state = formData.get("state")?.toString() || "";
		const city = formData.get("city")?.toString() || "";

		if (!file || !(file instanceof Blob) || !companyId) {
			return new Response(
				"Missing required fields: file and company_id are required",
				{ status: 400 }
			);
		}

		// Encode image
		const b64Img = await encodeImageToBase64(file);

		// Load examples from Supabase
		const exampleBlock = await loadExamplesFromSupabase(companyId);

		// Build prompt
		const prompt = includePricing
			? buildPromptWithPricing(context, severityOverride, exampleBlock)
			: buildPromptNarrativeOnly(context, severityOverride, exampleBlock);

		// Call OpenAI
		const response = await openai.responses.create({
			model: MODEL_NAME,
			input: [
				{
					role: "user",
					content: [
						{
							type: "input_text",
							text: `USER CONTEXT (OVERRIDES IMAGE + EXAMPLES): ${context}`,
						},
						{
							type: "input_image",
							image_url: `data:image/png;base64,${b64Img}`,
							detail: "auto",
						},
						{
							type: "input_text",
							text: prompt,
						},
					],
				},
			],
		});

		// @ts-ignore – output_text helper available on Responses
		const raw: string = response.output_text ?? JSON.stringify(response);
		const rawClean = repairLLMJson(raw);

		let data: any;
		try {
			data = JSON.parse(rawClean);
		} catch (err: any) {
			return Response.json(
				{
					error: "JSON parsing failed",
					raw_output: raw,
					fixed_attempt: rawClean,
					parse_error: err.message,
				},
				{ status: 500 }
			);
		}

		// Severity override
		if (severityOverride.trim()) {
			data.severity = severityOverride;
		}

		// No pricing
		if (!includePricing) {
			const result: ClassificationResponse = {
				title: data.title,
				narrative: data.narrative,
				severity: data.severity,
				trade: data.trade,
			};
			return Response.json(result);
		}

		// -----------------
		// Pricing engine
		// -----------------
		const tradeRaw = data.trade || "";
		const tradeClean = tradeRaw.trim();

		// 1. Contractor rate
		let contractorRate = 40.0;
		if (tradeClean) {
			const { data: rateRows } = await supabase
				.from("contractor_rates")
				.select("hourly_rate")
				.eq("trade", tradeClean)
				.limit(1);

			if (rateRows && rateRows.length > 0) {
				contractorRate = Number(rateRows[0].hourly_rate) || 40.0;
			}
		}

		// 2. Area modifiers
		let areaModifier = 0;
		if (state && city) {
			const { data: modRows } = await supabase
				.from("area_modification_factors")
				.select("modifier")
				.eq("state", state)
				.eq("city", city)
				.limit(1);

			if (modRows && modRows.length > 0) {
				areaModifier = Number(modRows[0].modifier) || 0;
			} else {
				const { data: avgRows } = await supabase
					.from("area_modification_factors")
					.select("modifier")
					.eq("state", state)
					.eq("city", "AVERAGE")
					.limit(1);
				if (avgRows && avgRows.length > 0) {
					areaModifier = Number(avgRows[0].modifier) || 0;
				}
			}
		}

		// 3. Labor hours
		let laborHours = 1.0;
		if (data.labor_hours !== undefined) {
			const n = Number(data.labor_hours);
			if (!Number.isNaN(n) && n > 0) laborHours = n;
		}

		// 4. Materials
		const rawMaterials: any[] = Array.isArray(data.materials)
			? data.materials
			: [];

		const materials: MaterialItem[] = [];
		let materialsCost = 0;

		for (const m of rawMaterials) {
			const label = m.label || "";
			const unit_size = m.unit_size ?? null;

			const qty = Number(m.qty ?? 1) || 1;
			const unit_price = Number(m.unit_price ?? 0) || 0;
			const line_total =
				Number(m.line_total ?? unit_price * qty) || unit_price * qty;

			materialsCost += line_total;

			materials.push({
				label,
				unit_size,
				qty,
				unit_price: Number(unit_price.toFixed(2)),
				line_total: Number(line_total.toFixed(2)),
			});
		}

		materialsCost = Number(materialsCost.toFixed(2));

		// 5. Cost math
		const baseLaborCost = laborHours * contractorRate;
		const subtotal = baseLaborCost + materialsCost;
		const areaAdjustedCost = subtotal * (1 + areaModifier / 100);
		const finalCost = areaAdjustedCost * overheadProfitFactor;

		const result: PricingResponse = {
			title: data.title,
			narrative: data.narrative,
			severity: data.severity,
			trade: tradeClean,
			action_type: data.action_type || "contractor_repair",
			task_description: data.task_description || "",
			labor_hours: laborHours,
			contractor_rate: contractorRate,
			area_modifier: areaModifier,
			materials,
			materials_cost: materialsCost,
			labor_cost: Number(baseLaborCost.toFixed(2)),
			estimated_cost: Number(finalCost.toFixed(2)),
		};

		return Response.json(result);
	} catch (err: any) {
		console.error("Classify error:", err);
		return new Response("Internal Server Error", { status: 500 });
	}
}
