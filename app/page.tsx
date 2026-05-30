"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Memo = {
  id: string;
  content: string;
  hearted: boolean; // 완료 여부로 사용
  pinned: boolean; // 중요 여부로 사용
  createdAt: string;
};

type ViewMode = "all" | "active" | "completed" | "important" | "today";

const MENUS: Record<ViewMode, { icon: string; label: string; title: string; empty: string; status: string }> = {
  all: {
    icon: "🟢",
    label: "전체",
    title: "전체보기",
    empty: "이 목록에는 아직 메모가 없어요.",
    status: "버디메모 전체 목록을 보고 있어요.",
  },
  active: {
    icon: "🍀",
    label: "진행중",
    title: "진행중인 메모",
    empty: "진행중인 메모가 없어요.",
    status: "아직 끝나지 않은 메모예요.",
  },
  completed: {
    icon: "💌",
    label: "완료",
    title: "완료된 메모",
    empty: "완료된 메모가 없어요.",
    status: "완료 처리한 메모예요.",
  },
  important: {
    icon: "⭐",
    label: "중요",
    title: "중요한 메모",
    empty: "중요 표시한 메모가 없어요.",
    status: "별표로 표시한 중요한 메모예요.",
  },
  today: {
    icon: "📅",
    label: "오늘",
    title: "오늘의 메모",
    empty: "오늘 작성한 메모가 없어요.",
    status: "오늘 작성한 메모만 보고 있어요.",
  },
};

function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function timeLabel(dateString: string): string {
  const date = new Date(dateString);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, "0");
  const ap = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 || 12;
  return `${mm}.${dd}  ${ap} ${String(hour12).padStart(2, "0")}:${mins}`;
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
  return (
    <div className={`buddy-memo-row ${memo.hearted ? "done" : ""}`}>
      <button
        onClick={onToggleDone}
        className="buddy-check"
        title={memo.hearted ? "완료 취소" : "완료하기"}
        aria-label={memo.hearted ? "완료 취소" : "완료하기"}
      >
        {memo.hearted ? "✓" : ""}
      </button>

      <div className="buddy-memo-text">
        <p className="buddy-memo-content">{memo.content}</p>
        <p className="buddy-memo-time">{timeLabel(memo.createdAt)}</p>
      </div>

      <button
        onClick={onToggleImportant}
        className="buddy-star-button"
        title={memo.pinned ? "중요 해제" : "중요 표시"}
        aria-label={memo.pinned ? "중요 해제" : "중요 표시"}
      >
        {memo.pinned ? "⭐" : "☆"}
      </button>

      <button
        onClick={onToggleDone}
        className="buddy-done-button"
        title={memo.hearted ? "완료 취소" : "완료하기"}
        aria-label={memo.hearted ? "완료 취소" : "완료하기"}
      >
        {memo.hearted ? "🤍" : "💚"}
      </button>

      <button
        onClick={onDelete}
        className="buddy-delete-button"
        title="삭제"
        aria-label="삭제"
      >
        ×
      </button>
    </div>
  );
}

export default function MemoWidget() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("all");
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
      ta.style.height = Math.min(ta.scrollHeight, 108) + "px";
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

  const patchMemo = async (
    id: string,
    optimistic: (memo: Memo) => Memo,
    body: Partial<{ hearted: boolean; pinned: boolean }>
  ) => {
    const previous = memos;
    setMemos((prev) => prev.map((m) => (m.id === id ? optimistic(m) : m)));
    try {
      const res = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("업데이트 실패");
    } catch {
      setMemos(previous);
    }
  };

  const toggleDone = (id: string, current: boolean) => {
    patchMemo(id, (m) => ({ ...m, hearted: !current }), { hearted: !current });
  };

  const toggleImportant = (id: string, current: boolean) => {
    patchMemo(id, (m) => ({ ...m, pinned: !current }), { pinned: !current });
  };

  const deleteMemo = async (id: string) => {
    const previous = memos;
    setMemos((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/memos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    } catch {
      setMemos(previous);
    }
  };

  const activeCount = memos.filter((m) => !m.hearted).length;
  const completedCount = memos.filter((m) => m.hearted).length;
  const importantCount = memos.filter((m) => m.pinned).length;
  const todayCount = memos.filter((m) => isToday(m.createdAt)).length;

  const displayMemos = memos.filter((memo) => {
    if (view === "active") return !memo.hearted;
    if (view === "completed") return memo.hearted;
    if (view === "important") return memo.pinned;
    if (view === "today") return isToday(memo.createdAt);
    return true;
  });

  const currentMenu = MENUS[view];

  if (!loading && error?.includes("NO_PAGES_ACCESSIBLE")) {
    return (
      <div className="buddy-access-error">
        <div className="buddy-access-card">
          <div className="buddy-empty-icon">🔐</div>
          <h2>노션 페이지 공유 필요</h2>
          <p>
            인테그레이션에 최소 1개의 노션 페이지를 공유해야 데이터베이스가 자동 생성됩니다.
            <br />노션 페이지 우상단 <strong>···</strong> → <strong>연결 추가</strong>에서 인테그레이션을 연결하세요.
          </p>
          <button onClick={fetchMemos} className="buddy-send">다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="buddy-shell">
      <div className="buddy-window">
        <header className="buddy-titlebar">
          <div className="buddy-title-left">
            <span className="buddy-logo">🐻</span>
            <span className="buddy-title-text">BUDDYMEMO&nbsp;&nbsp;v1.0</span>
          </div>
          <div className="buddy-window-buttons" aria-hidden="true">
            <span className="buddy-win-btn">−</span>
            <span className="buddy-win-btn">□</span>
            <span className="buddy-win-btn">×</span>
          </div>
        </header>

        <nav className="buddy-menubar" aria-label="상단 메뉴">
          <span>파일(F)</span>
          <span>친구(B)</span>
          <span>기능(A)</span>
          <span>도구(T)</span>
          <span>도움말(H)</span>
        </nav>

        <section className="buddy-profilebar">
          <div className="buddy-profile-left">
            <span className="buddy-face">🙂</span>
            <span className="buddy-profile-name">버디버디</span>
            <span className="buddy-profile-state">&#123;접속&#125;</span>
          </div>
          <div className="buddy-toolbar">
            <span className="buddy-toolbar-item"><span className="buddy-toolbar-icon">✏️</span>쪽지+</span>
            <span className="buddy-toolbar-item"><span className="buddy-toolbar-icon">🏠</span>홈페이지</span>
            <span className="buddy-toolbar-item"><span className="buddy-toolbar-icon">💼</span>마이템샵</span>
          </div>
        </section>

        <div className="buddy-body">
          <aside className="buddy-sidebar" aria-label="메모 필터">
            {(Object.keys(MENUS) as ViewMode[]).map((key) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`buddy-nav-button ${view === key ? "active" : ""}`}
                title={MENUS[key].title}
              >
                <img src={`/icon-${key}.png`} alt={MENUS[key].label} className="buddy-nav-icon" />
                <span className="buddy-nav-label">{MENUS[key].label}</span>
              </button>
            ))}
            <div className="buddy-sidebar-footer">
              <div className="buddy-mini-stickers"><span>🐻</span><span>🍀</span></div>
              <div>버디메모<br />7.0</div>
            </div>
          </aside>

          <main className="buddy-main">
            <div className="buddy-listbar">
              <div className="buddy-list-title">
                <span className="buddy-list-icon">{currentMenu.icon}</span>
                <span className="buddy-list-text">{currentMenu.title}</span>
              </div>
              <div className="buddy-counts">
                <span className="buddy-count-chip">진행 {activeCount}</span>
                <span className="buddy-count-chip">완료 {completedCount}</span>
                <span className="buddy-count-chip">중요 {importantCount}</span>
                <span className="buddy-count-chip">오늘 {todayCount}</span>
                <button onClick={fetchMemos} className="buddy-refresh" title="새로고침">↻</button>
              </div>
            </div>

            <section className="buddy-list">
              {error && !error.includes("NO_PAGES_ACCESSIBLE") && (
                <div className="buddy-error">오류: {error}</div>
              )}

              {!loading && displayMemos.length === 0 && (
                <div className="buddy-empty">
                  <span className="buddy-empty-icon">{currentMenu.icon}</span>
                  <span>{currentMenu.empty}</span>
                </div>
              )}

              {loading && displayMemos.length === 0 && (
                <div className="buddy-empty">
                  <span className="buddy-empty-icon">🍀</span>
                  <span>메모를 불러오는 중...</span>
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
            </section>

            <footer className="buddy-inputbar">
              <div className="buddy-textarea-wrap">
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
                  className="buddy-textarea"
                />
              </div>
              <button
                onClick={sendMemo}
                disabled={!input.trim() || sending}
                className="buddy-send"
              >
                <span>✏️</span>{sending ? "전송중" : "등록"}
              </button>
            </footer>
          </main>
        </div>

        <footer className="buddy-statusbar">
          <div className="buddy-status-cell">🌼 버디버디 7.0 서비스 중</div>
          <div className="buddy-progress"><div className="buddy-progress-box"><span /><span /><span /><span /><span /></div></div>
          <div className="buddy-status-cell">{currentMenu.icon} {currentMenu.status}</div>
        </footer>
      </div>
    </div>
  );
}
