import { NextRequest, NextResponse } from "next/server";
import { encryptData } from "@/lib/crypto";
import { getNotionClient } from "@/lib/notion";

function extractId(input: string): string | null {
  const m = input.match(/([a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}|[a-f0-9]{32})/i);
  if (!m) return null;
  return m[1].replace(/-/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const { token, pageUrl, dbMode, dbUrl } = await req.json();
    if (!token?.trim()) return NextResponse.json({ error: "NO_TOKEN" }, { status: 400 });

    const notion = getNotionClient(token.trim());

    try {
      await notion.users.me({});
    } catch {
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
    }

    let pageId: string | undefined;
    if (pageUrl?.trim()) {
      pageId = extractId(pageUrl.trim()) ?? undefined;
      if (!pageId) return NextResponse.json({ error: "INVALID_PAGE_URL" }, { status: 400 });
      try {
        await notion.pages.retrieve({ page_id: pageId });
      } catch {
        return NextResponse.json({ error: "PAGE_NOT_ACCESSIBLE" }, { status: 403 });
      }
    }

    let dbId: string | undefined;
    if (dbMode === "existing" && dbUrl?.trim()) {
      dbId = extractId(dbUrl.trim()) ?? undefined;
      if (!dbId) return NextResponse.json({ error: "INVALID_DB_URL" }, { status: 400 });
      try {
        const db = await notion.databases.retrieve({ database_id: dbId });
        if ((db as any).archived) throw new Error();
      } catch {
        return NextResponse.json({ error: "DB_NOT_ACCESSIBLE" }, { status: 403 });
      }
    }

    const encrypted = encryptData({
      token: token.trim(),
      ...(pageId ? { pageId } : {}),
      ...(dbId ? { dbId } : {}),
    });
    return NextResponse.json({ encrypted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
