# 메모 위젯 전체 코드

## 프로젝트 구조

```
memo-widget/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx
│   └── api/memos/
│       ├── route.ts
│       └── [id]/route.ts
└── lib/
    ├── notion.ts
    └── db.ts
```

---

## app/layout.tsx

```tsx
import type { Metadata } from "next";
import { Nanum_Gothic_Coding } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "메모 OS",
  description: "노션 메모 위젯",
};

const mono = Nanum_Gothic_Coding({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={mono.className}>
      <body>{children}</body>
    </html>
  );
}
```

---

## app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
}

::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 2px;
}
```

---

## app/page.tsx

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Memo = {
  id: string;
  content: string;
  hearted: boolean;
  pinned: boolean;
  createdAt: string;
};

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "방금";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function MemoCard({
  memo,
  onHeart,
  onDelete,
}: {
  memo: Memo;
  onHeart: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-start gap-2 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow duration-200">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
          {memo.content}
        </p>
        <p className="text-xs text-gray-400 mt-1.5">{timeAgo(memo.createdAt)}</p>
      </div>
      <div className="flex flex-col gap-1 pt-1 shrink-0">
        <button
          onClick={onHeart}
          title={memo.hearted ? "하트 취소" : "하트"}
          className={`w-7 h-7 flex items-center justify-center rounded-full text-base transition-all duration-150 ${
            memo.hearted
              ? "text-red-500 scale-110"
              : "text-gray-300 hover:text-red-400 hover:scale-110"
          }`}
        >
          {memo.hearted ? "❤️" : "🤍"}
        </button>
        <button
          onClick={onDelete}
          title="삭제"
          className={`w-7 h-7 flex items-center justify-center rounded-full text-lg font-light transition-all duration-150 ${
            hovered
              ? "text-gray-400 hover:text-red-400 hover:bg-red-50 opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function MemoWidget() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHeartedOnly, setShowHeartedOnly] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchMemos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemos(data.memos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemos();
  }, [fetchMemos]);

  // textarea 자동 높이 조절
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMemo = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemos((prev) => [data.memo, ...prev]);
    } catch (err: any) {
      setError(err.message);
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const toggleHeart = async (id: string, current: boolean) => {
    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, hearted: !current } : m))
    );
    try {
      const res = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hearted: !current }),
      });
      if (!res.ok) throw new Error("업데이트 실패");
    } catch {
      setMemos((prev) =>
        prev.map((m) => (m.id === id ? { ...m, hearted: current } : m))
      );
    }
  };

  const deleteMemo = async (id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch(`/api/memos/${id}`, { method: "DELETE" });
    } catch {
      fetchMemos();
    }
  };

  const displayMemos = showHeartedOnly
    ? memos.filter((m) => m.hearted)
    : memos;

  // 페이지 미접근 오류 화면
  if (!loading && error?.includes("NO_PAGES_ACCESSIBLE")) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6 text-center gap-3">
        <span className="text-5xl">🔐</span>
        <h2 className="text-base font-semibold text-gray-800">
          노션 페이지 공유 필요
        </h2>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
          인테그레이션에 최소 1개의 노션 페이지를 공유해야 데이터베이스가
          자동 생성됩니다.
          <br />
          <br />
          노션 페이지 우상단 <strong>···</strong> →{" "}
          <strong>연결 추가</strong>에서 인테그레이션을 연결 후 아래 버튼을
          누르세요.
        </p>
        <button
          onClick={fetchMemos}
          className="mt-1 px-5 py-2 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-600 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#f7f7f8]">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">📝</span>
          <span className="font-semibold text-gray-800 text-sm tracking-tight">
            메모 OS
          </span>
          {loading && (
            <span className="text-xs text-gray-400 animate-pulse">불러오는 중...</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchMemos}
            title="새로고침"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-base"
          >
            ↻
          </button>
          <button
            onClick={() => setShowHeartedOnly((v) => !v)}
            title={showHeartedOnly ? "전체 보기" : "하트만 보기"}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors text-base ${
              showHeartedOnly
                ? "text-red-500 bg-red-50"
                : "text-gray-400 hover:text-red-400 hover:bg-red-50"
            }`}
          >
            {showHeartedOnly ? "❤️" : "🤍"}
          </button>
        </div>
      </header>

      {/* 메모 목록 */}
      <main className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {error && !error.includes("NO_PAGES_ACCESSIBLE") && (
          <div className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
            오류: {error}
          </div>
        )}

        {!loading && displayMemos.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm gap-1">
            {showHeartedOnly ? (
              <>
                <span className="text-2xl">💔</span>
                <span>하트한 메모가 없어요</span>
              </>
            ) : (
              <>
                <span className="text-2xl">✍️</span>
                <span>첫 메모를 남겨보세요</span>
              </>
            )}
          </div>
        )}

        {displayMemos.map((memo) => (
          <MemoCard
            key={memo.id}
            memo={memo}
            onHeart={() => toggleHeart(memo.id, memo.hearted)}
            onDelete={() => deleteMemo(memo.id)}
          />
        ))}
      </main>

      {/* 입력창 */}
      <footer className="px-4 py-3 bg-white border-t border-gray-100">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMemo();
              }
            }}
            placeholder="메모를 입력하세요... (Enter로 전송, Shift+Enter 줄바꿈)"
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-gray-400 leading-relaxed"
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button
            onClick={sendMemo}
            disabled={!input.trim() || sending}
            className="px-4 py-2 bg-indigo-500 text-white text-sm font-semibold rounded-xl hover:bg-indigo-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            {sending ? "···" : "SEND"}
          </button>
        </div>
      </footer>
    </div>
  );
}
```

---

## lib/notion.ts

```ts
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
```

---

## lib/db.ts

```ts
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
```

---

## app/api/memos/route.ts

```ts
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
```

---

## app/api/memos/[id]/route.ts

```ts
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
```
