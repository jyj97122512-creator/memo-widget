import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export type Memo = {
  id: string;
  content: string;
  hearted: boolean;
  pinned: boolean;
  createdAt: string;
};

export function getNotionClient(): Client {
  const token = process.env.NOTION_API_TOKEN;
  if (!token) throw new Error("NOTION_API_TOKEN 환경 변수가 설정되지 않았습니다.");
  return new Client({ auth: token });
}

export function parseMemo(page: PageObjectResponse): Memo {
  const props = page.properties as Record<string, any>;
  return {
    id: page.id,
    content: props.Content?.title?.[0]?.plain_text ?? "",
    hearted: props.Hearted?.checkbox ?? false,
    pinned: props.Type?.select?.name === "pinned",
    createdAt: page.created_time,
  };
}
