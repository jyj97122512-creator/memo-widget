import { NextRequest, NextResponse } from "next/server";
import { getNotionClient, parseMemo } from "@/lib/notion";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const notion = getNotionClient();

    const properties: Record<string, any> = {};
    if (body.hearted !== undefined) {
      properties.Hearted = { checkbox: body.hearted };
    }
    if (body.pinned !== undefined) {
      properties.Type = { select: { name: body.pinned ? "pinned" : "memo" } };
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
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notion = getNotionClient();
    await notion.pages.update({
      page_id: params.id,
      archived: true,
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
