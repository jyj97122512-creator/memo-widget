import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

function extractPageId(input: string): string | null {
  const m = input.match(/([a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}|[a-f0-9]{32})/i);
  if (!m) return null;
  return m[1].replace(/-/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-notion-token") || "";
    if (!token) return NextResponse.json({ error: "NO_TOKEN" }, { status: 400 });

    const { pageUrl } = await req.json();
    const notion = getNotionClient(token);

    try {
      await notion.users.me({});
    } catch {
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
    }

    // pageUrl이 없으면 토큰 검증만 통과
    if (!pageUrl?.trim()) {
      return NextResponse.json({ ok: true });
    }

    const pageId = extractPageId(pageUrl.trim());
    if (!pageId) {
      return NextResponse.json({ error: "INVALID_PAGE_URL" }, { status: 400 });
    }

    try {
      await notion.pages.retrieve({ page_id: pageId });
    } catch {
      return NextResponse.json({ error: "PAGE_NOT_ACCESSIBLE" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, pageId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
