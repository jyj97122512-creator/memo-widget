"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Memo = {
  id: string;
  content: string;
  hearted: boolean; // 완료 여부로 사용
  pinned: boolean; // 중요 여부로 사용
  createdAt: string;
};

type ViewMode = "all" | "active" | "done" | "important" | "today";

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

function isToday(dateString: string): boolean {
  const now = new Date();
  const date = new Date(dateString);
  return (
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()
  );
}

function MemoCard({
  memo,
  onToggleDone,
  onToggleImportant,
  onDelete,
}: {
  memo: Memo;
  onToggleDone: () => void;
  onToggleImportant: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <article
      className={`buddy-memo-card ${memo.hearted ? "is-done" : ""} ${
        memo.pinned ? "is-important" : ""
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="memo-action-row" aria-label="메모 상태 변경">
        <button
          type="button"
          onClick={onToggleDone}
          title={memo.hearted ? "완료 취소" : "완료하기"}
          className={`tiny-icon-button done-button ${memo.hearted ? "active" : ""}`}
        >
          {memo.hearted ? "✅" : "♡"}
        </button>
        <button
          type="button"
          onClick={onToggleImportant}
          title={memo.pinned ? "중요 해제" : "중요 표시"}
          className={`tiny-icon-button star-button ${memo.pinned ? "active" : ""}`}
        >
          {memo.pinned ? "⭐" : "☆"}
        </button>
      </div>

      <div className="memo-content-wrap">
        <div className="memo-label-row">
          {memo.pinned && <span className="memo-badge important">중요</span>}
          {memo.hearted && <span className="memo-badge done">완료</span>}
        </div>
        <p className="memo-content">{memo.content}</p>
        <div className="memo-meta-row">
          <span>{timeAgo(memo.createdAt)}</span>
          <button
            type="button"
            onClick={onDelete}
            title="삭제"
            className={`delete-text-button ${hovered ? "visible" : ""}`}
          >
            삭제
          </button>
        </div>
      </div>
    </article>
  );
}

const VIEW_ITEMS: { key: ViewMode; icon: string; label: string }[] = [
  { key: "all", icon: "🏠", label: "전체" },
  { key: "active", icon: "☘️", label: "진행중" },
  { key: "done", icon: "✅", label: "완료" },
  { key: "important", icon: "⭐", label: "중요" },
  { key: "today", icon: "📅", label: "오늘" },
];

export default function MemoWidget() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
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

  const toggleDone = async (id: string, current: boolean) => {
    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, hearted: !current } : m))
    );
    try {
      const res = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hearted: !current }),
      });
      if (!res.ok) throw new Error("완료 상태 업데이트 실패");
    } catch {
      setMemos((prev) =>
        prev.map((m) => (m.id === id ? { ...m, hearted: current } : m))
      );
    }
  };

  const toggleImportant = async (id: string, current: boolean) => {
    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, pinned: !current } : m))
    );
    try {
      const res = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !current }),
      });
      if (!res.ok) throw new Error("중요 상태 업데이트 실패");
    } catch {
      setMemos((prev) =>
        prev.map((m) => (m.id === id ? { ...m, pinned: current } : m))
      );
    }
  };

  const deleteMemo = async (id: string) => {
    const snapshot = memos;
    setMemos((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/memos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    } catch {
      setMemos(snapshot);
    }
  };

  const displayMemos = memos.filter((memo) => {
    if (viewMode === "active") return !memo.hearted;
    if (viewMode === "done") return memo.hearted;
    if (viewMode === "important") return memo.pinned;
    if (viewMode === "today") return isToday(memo.createdAt);
    return true;
  });

  const activeCount = memos.filter((m) => !m.hearted).length;
  const doneCount = memos.filter((m) => m.hearted).length;
  const importantCount = memos.filter((m) => m.pinned).length;

  if (!loading && error?.includes("NO_PAGES_ACCESSIBLE")) {
    return (
      <div className="buddy-error-screen">
        <span className="error-emoji">🔐</span>
        <h2>노션 페이지 공유 필요</h2>
        <p>
          인테그레이션에 최소 1개의 노션 페이지를 공유해야 데이터베이스가 자동
          생성됩니다.
        </p>
        <button onClick={fetchMemos}>다시 시도</button>
      </div>
    );
  }

  return (
    <div className="buddy-shell">
      <div className="buddy-window">
        <header className="buddy-titlebar">
          <div className="title-left">
            <span className="bear">🐻</span>
            <div>
              <strong>버디메모</strong>
              <span>{loading ? "불러오는 중..." : "온라인"}</span>
            </div>
          </div>
          <div className="window-buttons" aria-hidden="true">
            <span>_</span>
            <span>□</span>
            <span>×</span>
          </div>
        </header>

        <div className="buddy-body">
          <aside className="buddy-sidebar" aria-label="메모 필터">
            {VIEW_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                title={item.label}
                onClick={() => setViewMode(item.key)}
                className={`side-icon ${viewMode === item.key ? "active" : ""}`}
              >
                <span>{item.icon}</span>
                <small>{item.label}</small>
              </button>
            ))}
          </aside>

          <section className="buddy-main">
            <div className="status-card">
              <div>
                <span className="status-dot" />
                <strong>오늘의 상태메시지</strong>
              </div>
              <p>작은 메모도 잊지 말고 저장하기 ✍️</p>
            </div>

            <div className="memo-counter-row">
              <span>진행 {activeCount}</span>
              <span>완료 {doneCount}</span>
              <span>중요 {importantCount}</span>
              <button type="button" onClick={fetchMemos} title="새로고침">
                ↻
              </button>
            </div>

            <main className="memo-list">
              {error && !error.includes("NO_PAGES_ACCESSIBLE") && (
                <div className="error-box">오류: {error}</div>
              )}

              {!loading && displayMemos.length === 0 && (
                <div className="empty-box">
                  <span>💌</span>
                  <p>이 목록에는 아직 메모가 없어요.</p>
                </div>
              )}

              {displayMemos.map((memo) => (
                <MemoCard
                  key={memo.id}
                  memo={memo}
                  onToggleDone={() => toggleDone(memo.id, memo.hearted)}
                  onToggleImportant={() => toggleImportant(memo.id, memo.pinned)}
                  onDelete={() => deleteMemo(memo.id)}
                />
              ))}
            </main>
          </section>
        </div>

        <footer className="buddy-input-area">
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
            placeholder="메모를 입력하세요..."
            rows={1}
          />
          <button
            type="button"
            onClick={sendMemo}
            disabled={!input.trim() || sending}
          >
            {sending ? "···" : "쪽지쓰기"}
          </button>
        </footer>
      </div>
    </div>
  );
}
