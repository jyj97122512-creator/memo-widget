"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Memo = {
  id: string;
  content: string;
  hearted: boolean;
  pinned: boolean;
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

const VIEW_ITEMS: { key: ViewMode; icon: string; label: string }[] = [
  { key: "all",       icon: "👥", label: "전체"   },
  { key: "active",    icon: "💌", label: "진행중" },
  { key: "done",      icon: "✅", label: "완료"   },
  { key: "important", icon: "⭐", label: "중요"   },
  { key: "today",     icon: "📅", label: "오늘"   },
];

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
    <div
      className={`memo-card${memo.hearted ? " is-done" : ""}${memo.pinned ? " is-important" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="memo-actions">
        <button
          type="button"
          onClick={onToggleDone}
          title={memo.hearted ? "완료 취소" : "완료하기"}
          className={`win98-btn sm${memo.hearted ? " pressed" : ""}`}
        >
          {memo.hearted ? "✅" : "☐"}
        </button>
        <button
          type="button"
          onClick={onToggleImportant}
          title={memo.pinned ? "중요 해제" : "중요 표시"}
          className={`win98-btn sm${memo.pinned ? " pressed" : ""}`}
        >
          {memo.pinned ? "⭐" : "☆"}
        </button>
      </div>

      <div className="memo-body">
        <div className="memo-label-row">
          {memo.pinned && <span className="win98-badge important">중요</span>}
          {memo.hearted && <span className="win98-badge done">완료</span>}
        </div>
        <p className="memo-text">{memo.content}</p>
        <div className="memo-meta">
          <span>{timeAgo(memo.createdAt)}</span>
          <button
            type="button"
            onClick={onDelete}
            className={`delete-btn${hovered ? " visible" : ""}`}
            title="삭제"
          >
            [삭제]
          </button>
        </div>
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

  useEffect(() => { fetchMemos(); }, [fetchMemos]);

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
    setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, hearted: !current } : m)));
    try {
      const res = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hearted: !current }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, hearted: current } : m)));
    }
  };

  const toggleImportant = async (id: string, current: boolean) => {
    setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, pinned: !current } : m)));
    try {
      const res = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !current }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, pinned: current } : m)));
    }
  };

  const deleteMemo = async (id: string) => {
    const snapshot = memos;
    setMemos((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/memos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setMemos(snapshot);
    }
  };

  const displayMemos = memos.filter((memo) => {
    if (viewMode === "active")    return !memo.hearted;
    if (viewMode === "done")      return memo.hearted;
    if (viewMode === "important") return memo.pinned;
    if (viewMode === "today")     return isToday(memo.createdAt);
    return true;
  });

  const activeCount    = memos.filter((m) => !m.hearted).length;
  const doneCount      = memos.filter((m) => m.hearted).length;
  const importantCount = memos.filter((m) => m.pinned).length;

  /* ── 에러: 페이지 미공유 ──────────────────────────── */
  if (!loading && error?.includes("NO_PAGES_ACCESSIBLE")) {
    return (
      <div className="win98-error-screen">
        <div className="win98-dialog">
          <div className="win98-titlebar">
            <div className="titlebar-left"><span>⚠️</span><span>오류</span></div>
            <div className="titlebar-btns">
              <button className="titlebar-btn">×</button>
            </div>
          </div>
          <div className="win98-dialog-body">
            <span style={{ fontSize: 32 }}>🔐</span>
            <p>
              인테그레이션에 최소 1개의 노션 페이지를<br />
              공유해야 데이터베이스가 자동 생성됩니다.
            </p>
            <button className="win98-btn" onClick={fetchMemos}>확인</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── 메인 UI ──────────────────────────────────────── */
  return (
    <div className="win98-desktop">
      <div className="win98-window">

        {/* 타이틀바 */}
        <header className="win98-titlebar">
          <div className="titlebar-left">
            <span>📁</span>
            <span>★ メモリスト.exe</span>
          </div>
          <div className="titlebar-btns">
            <button className="titlebar-btn" aria-hidden="true">_</button>
            <button className="titlebar-btn" aria-hidden="true">□</button>
            <button className="titlebar-btn" aria-hidden="true">×</button>
          </div>
        </header>

        {/* 메뉴바 */}
        <nav className="win98-menubar">
          <span className="menu-item">메모(F)</span>
          <span className="menu-item">보기(V)</span>
          <span className="menu-item">도움말(H)</span>
        </nav>

        {/* 본문 */}
        <div className="win98-body">

          {/* 사이드바 */}
          <aside className="win98-sidebar">
            {VIEW_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`side-btn${viewMode === item.key ? " active" : ""}`}
                onClick={() => setViewMode(item.key)}
                title={item.label}
              >
                <span>{item.icon}</span>
                <small>{item.label}</small>
              </button>
            ))}
          </aside>

          {/* 메인 */}
          <section className="win98-main">

            {/* 상태바 */}
            <div className="win98-statusbar">
              <span>★ メモリスト v1.0 &nbsp;{loading && "— 불러오는 중..."}</span>
            </div>

            {/* 카운터 */}
            <div className="counter-row">
              <span className="counter-chip">진행 {activeCount}</span>
              <span className="counter-chip">완료 {doneCount}</span>
              <span className="counter-chip">중요 {importantCount}</span>
              <button
                type="button"
                className="win98-btn sm"
                style={{ marginLeft: "auto" }}
                onClick={fetchMemos}
                title="새로고침"
              >
                ↻
              </button>
            </div>

            {/* 메모 목록 */}
            <div className="memo-list">
              {error && !error.includes("NO_PAGES_ACCESSIBLE") && (
                <div className="win98-error-inline">오류: {error}</div>
              )}

              {!loading && displayMemos.length === 0 && (
                <div className="win98-empty">
                  <div style={{ fontSize: 20, marginBottom: 4 }}>💌</div>
                  이 목록에는 아직 메모가 없어요.
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
            </div>
          </section>
        </div>

        {/* 입력 영역 */}
        <footer className="win98-input-area">
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
            placeholder="메모를 입력하세요... (Enter 전송 / Shift+Enter 줄바꿈)"
            rows={1}
            className="win98-textarea"
          />
          <button
            type="button"
            onClick={sendMemo}
            disabled={!input.trim() || sending}
            className="win98-btn"
          >
            {sending ? "···" : "쪽지쓰기"}
          </button>
        </footer>
      </div>
    </div>
  );
}
