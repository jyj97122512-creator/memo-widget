import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export type Memo = {
  id: string;
  title: string;
  content: string;
  status: "진행중" | "완료" | "보류";
  important: boolean;
  today?: boolean;
  category?: string;
  totalTime?: number;
  lastSessionTime?: number;
  lastWorkedAt?: string;
  dueDate?: string;
  createdAt: string;
  url: string;
};

export function getNotionClient(token?: string): Client {
  const t = token || process.env.NOTION_API_TOKEN;
  if (!t) throw new Error("NOTION_TOKEN_MISSING");
  return new Client({ auth: t });
}

export function parseMemo(page: PageObjectResponse): Memo {
  const props = page.properties as Record<string, any>;

  let status: "진행중" | "완료" | "보류" = "진행중";
  const statusVal = (props["상태"] ?? props["Status"])?.select?.name;
  if (statusVal === "완료" || statusVal === "보류") {
    status = statusVal;
  } else if (props["Hearted"]?.checkbox === true) {
    status = "완료";
  }

  const important =
    (props["중요"] ?? props["Important"])?.checkbox === true ||
    props["Type"]?.select?.name === "pinned";

  return {
    id: page.id,
    title: (props["제목"] ?? props["Content"])?.title?.[0]?.plain_text ?? "",
    content: (props["내용"] ?? props["Body"])?.rich_text?.[0]?.plain_text ?? "",
    status,
    important,
    today: (props["오늘"] ?? props["Today"])?.checkbox === true,
    category: (props["분류"] ?? props["Category"])?.select?.name,
    totalTime: props["Total Time"]?.number ?? props["TotalTime"]?.number ?? 0,
    lastSessionTime: props["Last Session Time"]?.number ?? 0,
    lastWorkedAt: props["Last Worked At"]?.date?.start ?? undefined,
    dueDate: props["마감일"]?.date?.start ?? undefined,
    createdAt: page.created_time,
    url: page.url,
  };
}
