import { NextRequest, NextResponse } from "next/server";
import { getNotionClient, parseMemo } from "@/lib/notion";
import { getDatabaseId } from "@/lib/db";
import { decryptData } from "@/lib/crypto";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

function getCredentials(req: NextRequest): { token: string; pageId?: string; dbId?: string } {
  const headerDbId = req.headers.get("x-notion-db-id") || undefined;
  const enc = req.headers.get("x-notion-enc-token");
  if (enc) {
    try {
      const decrypted = decryptData(enc);
      return { ...decrypted, dbId: headerDbId ?? decrypted.dbId };
    } catch { throw new Error("INVALID_TOKEN"); }
  }
  return {
    token: req.headers.get("x-notion-token") || process.env.NOTION_API_TOKEN || "",
    pageId: req.headers.get("x-notion-page-id") || undefined,
    dbId: headerDbId,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { token, pageId, dbId } = getCredentials(req);
    const notion = getNotionClient(token);
    const databaseId = await getDatabaseId(notion, token, pageId, dbId);

    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: 50,
    });

    const memos = (response.results as PageObjectResponse[]).map(parseMemo);
    return NextResponse.json({ memos, databaseId });
  } catch (error: any) {
    const status = error.message === "NO_PAGES_ACCESSIBLE" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, content, important, today, category, dueDate } = await req.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
    }

    const { token, pageId, dbId } = getCredentials(req);
    const notion = getNotionClient(token);
    const databaseId = await getDatabaseId(notion, token, pageId, dbId);

    const properties: Record<string, any> = {
      제목: {
        title: [{ type: "text", text: { content: title.trim() } }],
      },
      상태: { select: { name: "진행중" } },
      중요: { checkbox: !!important },
      오늘: { checkbox: !!today },
    };

    if (content?.trim()) {
      properties.내용 = {
        rich_text: [{ type: "text", text: { content: content.trim() } }],
      };
    }
    if (category?.trim()) {
      properties.분류 = {
        select: { name: category.trim() },
      };
    }
    if (dueDate) {
      properties.마감일 = { date: { start: dueDate } };
    }

    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    });

    return NextResponse.json({ memo: parseMemo(page as PageObjectResponse), databaseId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
