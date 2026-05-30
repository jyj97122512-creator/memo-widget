import { NextRequest, NextResponse } from "next/server";
import { getNotionClient, parseMemo } from "@/lib/notion";
import { getDatabaseId } from "@/lib/db";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export async function GET() {
  try {
    const notion = getNotionClient();
    const databaseId = await getDatabaseId();

    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: 50,
    });

    const memos = (response.results as PageObjectResponse[]).map(parseMemo);
    return NextResponse.json({ memos });
  } catch (error: any) {
    const status = error.message === "NO_PAGES_ACCESSIBLE" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    const notion = getNotionClient();
    const databaseId = await getDatabaseId();

    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Content: {
          title: [{ type: "text", text: { content: content.trim() } }],
        },
        Hearted: { checkbox: false },
        Type: { select: { name: "memo" } },
      },
    });

    return NextResponse.json({ memo: parseMemo(page as PageObjectResponse) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
