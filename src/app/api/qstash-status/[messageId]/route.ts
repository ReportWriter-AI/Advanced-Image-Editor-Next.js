import { NextResponse } from "next/server";

// GET /api/qstash-status/:messageId
// Queries QStash for the delivery status of a published message.
export async function GET(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Missing QSTASH_TOKEN env" }, { status: 500 });
  }

  try {
    // QStash message status endpoint
    const url = `https://qstash.upstash.io/v2/messages/${messageId}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const data = await res.json();
    return NextResponse.json({ ok: res.ok, status: res.status, data });
  } catch (err: any) {
    console.error("❌ Failed to fetch QStash message status", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
