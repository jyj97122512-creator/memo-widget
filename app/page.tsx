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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMemo();
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
            onKeyDown={handleKeyDown}
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
