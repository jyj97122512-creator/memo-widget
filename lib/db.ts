import { Client } from "@notionhq/client";

const DB_TITLE = "Memo OS";
const dbCache = new Map<string, string>();

export async function getDatabaseId(
  notion: Client,
  cacheKey: string,
  explicitPageId?: string,
  explicitDbId?: string
): Promise<string> {
  const cached = dbCache.get(cacheKey);
  if (cached) return cached;

  // 클라이언트가 DB ID를 알고 있으면 직접 검증 후 사용 (search 인덱싱 지연 우회)
  if (explicitDbId) {
    try {
      const db = await notion.databases.retrieve({ database_id: explicitDbId });
      if (!(db as any).archived) {
        dbCache.set(cacheKey, explicitDbId);
        return explicitDbId;
      }
    } catch {}
  }

  const searchResult = await notion.search({
    query: DB_TITLE,
    filter: { property: "object", value: "database" },
  });

  const existing = searchResult.results.find(
    (r) =>
      r.object === "database" &&
      (r as any).title?.[0]?.plain_text === DB_TITLE &&
      !(r as any).archived &&
      (r as any).properties?.상태 !== undefined
  );

  if (existing) {
    dbCache.set(cacheKey, existing.id);
    return existing.id;
  }

  let parentPageId = explicitPageId;

  if (!parentPageId) {
    const pagesResult = await notion.search({
      filter: { property: "object", value: "page" },
      page_size: 1,
    });

    if (pagesResult.results.length === 0) {
      throw new Error("NO_PAGES_ACCESSIBLE");
    }
    parentPageId = pagesResult.results[0].id;
  }

  const newDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    icon: { type: "emoji", emoji: "📝" },
    title: [{ type: "text", text: { content: DB_TITLE } }],
    properties: {
      제목:                  { title: {} },
      중요:                  { checkbox: {} },
      오늘:                  { checkbox: {} },
      상태: {
        select: {
          options: [
            { name: "진행중", color: "blue"  },
            { name: "완료",   color: "green" },
            { name: "보류",   color: "gray"  },
          ],
        },
      },
      분류:                  { select: { options: [] } },
      내용:                  { rich_text: {} },
      "Total Time":        { number: { format: "number" } },
      "Last Session Time": { number: { format: "number" } },
      "Last Worked At":    { date: {} },
    },
  });

  dbCache.set(cacheKey, newDb.id);
  return newDb.id;
}
