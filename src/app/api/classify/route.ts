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

		const raw: string = response.output_text;
		const rawClean = repairLLMJson(raw);

		let data: any;
		try {
			data = JSON.parse(rawClean);
		} catch (err: any) {
			return Response.json({
				error: "JSON parsing failed",
				raw_output: raw,
				fixed_attempt: rawClean,
				parse_error: String(err),
			});
		}

		// Severity override
		if (severityOverride.trim()) {
			data.severity = severityOverride;
		}

		// No pricing
		if (!includePricing) {
			return Response.json({
				title: data.title,
				narrative: data.narrative,
				severity: data.severity,
				trade: data.trade,
			});
		}

		// ---------------
		// Pricing engine
		// ---------------

		const tradeRaw = data.trade || "";
		const tradeClean = tradeRaw.trim();

		// 1. Load contractor rate
		const rateResp = await supabase
			.from("contractor_rates")
			.select("hourly_rate")
			.eq("trade", tradeClean)
			.limit(1);

		let contractorRate = 40.0;
		if (rateResp.data && rateResp.data.length > 0) {
			contractorRate = Number(rateResp.data[0].hourly_rate) || 40.0;
		}

		// 2. Area modifiers (state/city based)
		const modResp = await supabase
			.from("area_modification_factors")
			.select("modifier")
			.eq("state", state)
			.eq("city", city)
			.limit(1);

		let areaModifier = 0;
		if (modResp.data && modResp.data.length > 0) {
			areaModifier = Number(modResp.data[0].modifier) || 0;
		} else {
			const avgResp = await supabase
				.from("area_modification_factors")
				.select("modifier")
				.eq("state", state)
				.eq("city", "AVERAGE")
				.limit(1);
			if (avgResp.data && avgResp.data.length > 0) {
				areaModifier = Number(avgResp.data[0].modifier) || 0;
			}
		}

		// 3. Labor hours
		let laborHours = 1.0;
		try {
			laborHours = Number(data.labor_hours || 1.0);
			if (isNaN(laborHours)) laborHours = 1.0;
		} catch {
			laborHours = 1.0;
		}

		// 4. Materials - trust model GPT5 for items and prices
		const rawMaterials = data.materials || [];

		const materialsLines: MaterialItem[] = [];
		let materialsCost = 0.0;

		for (const m of rawMaterials) {
			const label = m.label || "";
			const unit_size = m.unit_size || null;

			let qty = 1.0;
			try {
				qty = Number(m.qty || 1);
				if (isNaN(qty)) qty = 1.0;
			} catch {
				qty = 1.0;
			}

			let unit_price = 0.0;
			try {
				unit_price = Number(m.unit_price || 0.0);
				if (isNaN(unit_price)) unit_price = 0.0;
			} catch {
				unit_price = 0.0;
			}

			// If line_total missing, compute it
			let line_total = unit_price * qty;
			try {
				line_total = Number(m.line_total || unit_price * qty);
				if (isNaN(line_total)) line_total = unit_price * qty;
			} catch {
				line_total = unit_price * qty;
			}

			materialsCost += line_total;

			materialsLines.push({
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

		data.labor_hours = laborHours;
		data.contractor_rate = contractorRate;
		data.area_modifier = areaModifier;
		data.materials = materialsLines;
		data.materials_cost = materialsCost;
		data.labor_cost = Number(baseLaborCost.toFixed(2));
		data.estimated_cost = Number(finalCost.toFixed(2));

		// Ensure task_description/action_type exists
		if (!data.action_type) data.action_type = "contractor_repair";
		if (!data.task_description) data.task_description = "";

		return Response.json({
			title: data.title,
			narrative: data.narrative,
			severity: data.severity,
			trade: tradeClean,
			action_type: data.action_type,
			task_description: data.task_description,
			labor_hours: data.labor_hours,
			contractor_rate: data.contractor_rate,
			area_modifier: data.area_modifier,
			materials: data.materials,
			materials_cost: data.materials_cost,
			labor_cost: data.labor_cost,
			estimated_cost: data.estimated_cost,
		});
	} catch (err: any) {
		console.error("Classify error:", err);
		return new Response("Internal Server Error", { status: 500 });
	}
}
