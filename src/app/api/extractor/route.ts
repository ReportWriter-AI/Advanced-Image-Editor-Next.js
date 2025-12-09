// @ts-nocheck
// app/api/extractor/upload/route.ts
import { NextRequest } from "next/server";
import {
	PROMPT,
	EXTRACTOR_MODEL_NAME,
	openai,
	supabase,
	cleanJson,
} from "@/lib/defects";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	try {
		const formData = await req.formData();
		const companyId = formData.get("company_id")?.toString() || "";

		if (!companyId) {
			return new Response("company_id is required", { status: 400 });
		}

		const fileEntries = formData.getAll("files").filter(
			(f) => f instanceof Blob
		);

		if (fileEntries.length === 0) {
			return new Response("At least one file is required", { status: 400 });
		}

		let inserted = 0;
		const errors: { file: string; error: string }[] = [];

		for (const file of fileEntries) {
			const fileName = file instanceof File ? file.name : "unknown";
			try {
				// Read uploaded image bytes
				const imgBytes = await file.arrayBuffer();
				const base64Img = Buffer.from(imgBytes).toString("base64");

				const response = await openai.responses.create({
					model: EXTRACTOR_MODEL_NAME,
					input: [
						{
							role: "user",
							content: [
								{ type: "input_text", text: PROMPT },
								{
									type: "input_image",
									image_url: `data:image/png;base64,${base64Img}`,
								},
							],
						},
					],
				});

				const raw: string = response.output_text;
				const cleaned = cleanJson(raw);
				const data = JSON.parse(cleaned);

				// Insert into Supabase
				const { error } = await supabase.from("defect_examples").insert({
					company_id: companyId,
					title: data.title,
					narrative: data.narrative,
					severity: data.severity,
					trade: data.trade,
				});

				if (error) {
					errors.push({
						file: fileName,
						error: error.message,
					});
				} else {
					inserted += 1;
				}
			} catch (err: any) {
				errors.push({
					file: fileName,
					error: String(err),
				});
			}
		}

		return Response.json({
			status: "completed",
			inserted,
			failed: errors,
		});
	} catch (err: any) {
		console.error("Extractor upload error:", err);
		return new Response("Internal Server Error", { status: 500 });
	}
}
