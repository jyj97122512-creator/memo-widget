import { getNotionClient } from "./notion";

let cachedDatabaseId: string | null = null;

const DB_TITLE = "Memo OS";

export async function getDatabaseId(): Promise<string> {
  if (cachedDatabaseId) return cachedDatabaseId;

  const notion = getNotionClient();

  // 이미 존재하는 데이터베이스 탐색
  const searchResult = await notion.search({
    query: DB_TITLE,
    filter: { property: "object", value: "database" },
  });

  const existing = searchResult.results.find(
    (r) =>
      r.object === "database" &&
      (r as any).title?.[0]?.plain_text === DB_TITLE
  );

  if (existing) {
    cachedDatabaseId = existing.id;
    return cachedDatabaseId;
  }

  // 부모로 사용할 접근 가능한 페이지 탐색
  const pagesResult = await notion.search({
    filter: { property: "object", value: "page" },
    page_size: 1,
  });

  if (pagesResult.results.length === 0) {
    throw new Error("NO_PAGES_ACCESSIBLE");
  }

  const parentPageId = pagesResult.results[0].id;

  // 데이터베이스 자동 생성
  const newDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    icon: { type: "emoji", emoji: "📝" },
    title: [{ type: "text", text: { content: DB_TITLE } }],
    properties: {
      Content: { title: {} },
      Hearted: { checkbox: {} },
      Type: {
        select: {
          options: [
            { name: "memo", color: "blue" },
            { name: "pinned", color: "yellow" },
          ],
        },
      },
    },
  });

  cachedDatabaseId = newDb.id;
  return cachedDatabaseId;
}
