import { NextRequest, NextResponse } from "next/server";
import { getNotionClient, parseMemo } from "@/lib/notion";
import { decryptData } from "@/lib/crypto";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

function getToken(req: NextRequest): string {
  const enc = req.headers.get("x-notion-enc-token");
  if (enc) {
    try { return decryptData(enc).token; } catch { throw new Error("INVALID_TOKEN"); }
  }
  return req.headers.get("x-notion-token") || process.env.NOTION_API_TOKEN || "";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const notion = getNotionClient(getToken(req));

    const properties: Record<string, any> = {};

    if (body.status !== undefined) {
      properties.상태 = { select: { name: body.status } };
    }
    if (body.important !== undefined) {
      properties.중요 = { checkbox: body.important };
    }
    if (body.today !== undefined) {
      properties.오늘 = { checkbox: body.today };
    }
    if (body.totalTime !== undefined) {
      properties["Total Time"] = { number: body.totalTime };
    }
    if (body.lastSessionTime !== undefined) {
      properties["Last Session Time"] = { number: body.lastSessionTime };
    }
    if (body.lastWorkedAt !== undefined) {
      properties["Last Worked At"] = { date: { start: body.lastWorkedAt } };
    }
    if (body.dueDate !== undefined) {
      properties["마감일"] = body.dueDate ? { date: { start: body.dueDate } } : null;
    }

    const page = await notion.pages.update({
      page_id: params.id,
      properties,
    });

    return NextResponse.json({ memo: parseMemo(page as PageObjectResponse) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notion = getNotionClient(getToken(req));
    await notion.pages.update({
      page_id: params.id,
      archived: true,
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
