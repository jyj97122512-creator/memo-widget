"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Memo = {
  id: string;
  content: string;
  hearted: boolean;
  pinned: boolean;
  createdAt: string;
};

type ViewMode = "all" | "active" | "completed" | "important" | "today";
type MenuKey  = "file" | "list" | "tools" | "help";
type ModalData = { title: string; body: React.ReactNode };
type MenuItem  = { label: string; action: () => void } | { sep: true };

async function getRandomCheerMessage(): Promise<string> {
  try {
    const res = await fetch("/cheer-messages.json");
    const data = await res.json();
    const messages: { text: string }[] = data.messages;
    return messages[Math.floor(Math.random() * messages.length)].text;
  } catch {
    return "오늘도 충분히 잘하고 있어요.";
  }
}

const VIEWS: Record<ViewMode, { label: string; title: string; empty: string; status: string }> = {
  all:       { label: "전체",  title: "전체보기",     empty: "이 목록에는 아직 메모가 없어요.",  status: "버디메모 전체 목록을 보고 있어요." },
  active:    { label: "진행중", title: "진행중인 메모", empty: "진행중인 메모가 없어요.",           status: "아직 끝나지 않은 메모예요." },
  completed: { label: "완료",  title: "완료된 메모",   empty: "완료된 메모가 없어요.",             status: "완료 처리한 메모예요." },
  important: { label: "중요",  title: "중요한 메모",   empty: "중요 표시한 메모가 없어요.",        status: "별표로 표시한 중요한 메모예요." },
  today:     { label: "오늘",  title: "오늘의 메모",   empty: "오늘 작성한 메모가 없어요.",        status: "오늘 작성한 메모만 보고 있어요." },
};

function isToday(dateString: string): boolean {
  const d = new Date(dateString), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function timeLabel(dateString: string): string {
  const d = new Date(dateString);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const ap = hh >= 12 ? "PM" : "AM";
  return `${mm}.${dd}  ${ap} ${String(hh % 12 || 12).padStart(2, "0")}:${mins}`;
}

function Modal({ title, body, onClose }: ModalData & { onClose: () => void }) {
  return (
    <div className="buddy-modal-overlay" onMouseDown={onClose}>
      <div className="buddy-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="buddy-modal-header">
          <span>{title}</span>
          <button className="buddy-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="buddy-modal-body">{body}</div>
      </div>
    </div>
  );
}

function MemoCard({ memo, onToggleDone, onToggleImportant, onDelete }: {
  memo: Memo;
  onToggleDone: () => void;
  onToggleImportant: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`buddy-memo-row ${memo.hearted ? "done" : ""}`}>
      <button onClick={onToggleDone} className="buddy-check" title={memo.hearted ? "완료 취소" : "완료하기"}>
        {memo.hearted ? "✓" : ""}
      </button>
      <div className="buddy-memo-text">
        <p className="buddy-memo-content">{memo.content}</p>
        <p className="buddy-memo-time">{timeLabel(memo.createdAt)}</p>
      </div>
      <button onClick={onToggleImportant} className={`buddy-select-btn buddy-select-star${memo.pinned ? " sel-on" : ""}`} title={memo.pinned ? "중요 해제" : "중요 표시"}>
        <span className="bsb-icon">⭐</span>
        <span className="bsb-label">{memo.pinned ? "중요" : "중요 아님"}</span>
        <span className="bsb-arrow">▾</span>
      </button>
      <button onClick={onToggleDone} className={`buddy-select-btn${memo.hearted ? " sel-on" : ""}`} title={memo.hearted ? "완료 취소" : "완료하기"}>
        <span className="bsb-icon">{memo.hearted ? "💚" : "🤍"}</span>
        <span className="bsb-label">{memo.hearted ? "완료" : "미완료"}</span>
        <span className="bsb-arrow">▾</span>
      </button>
      <button onClick={onDelete} className="buddy-delete-button" title="삭제">×</button>
    </div>
  );
}

export default function MemoWidget() {
  const [memos,       setMemos]       = useState<Memo[]>([]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [view,        setView]        = useState<ViewMode>("all");
  const [openMenu,    setOpenMenu]    = useState<MenuKey | null>(null);
  const [focusMode,   setFocusMode]   = useState(false);
  const [showSearch,  setShowSearch]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modal,       setModal]       = useState<ModalData | null>(null);

  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const menubarRef    = useRef<HTMLElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const searchRef     = useRef<HTMLInputElement>(null);

  /* 메뉴 외부 클릭 시 닫기 */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menubarRef.current && !menubarRef.current.contains(e.target as Node))
        setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchMemos = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/memos");
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
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 108) + "px"; }
  }, [input]);

  const sendMemo = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true); setInput("");
    try {
      const res  = await fetch("/api/memos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemos((prev) => [data.memo, ...prev]);
    } catch (err: any) {
      setError(err.message); setInput(content);
    } finally {
      setSending(false);
    }
  };

  const patchMemo = async (id: string, optimistic: (m: Memo) => Memo, body: Partial<{ hearted: boolean; pinned: boolean }>) => {
    const prev = memos;
    setMemos((p) => p.map((m) => (m.id === id ? optimistic(m) : m)));
    try {
      const res = await fetch(`/api/memos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
    } catch { setMemos(prev); }
  };

  const toggleDone      = (id: string, cur: boolean) => patchMemo(id, (m) => ({ ...m, hearted: !cur }), { hearted: !cur });
  const toggleImportant = (id: string, cur: boolean) => patchMemo(id, (m) => ({ ...m, pinned:  !cur }), { pinned:  !cur });

  const deleteMemo = async (id: string) => {
    const prev = memos;
    setMemos((p) => p.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/memos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch { setMemos(prev); }
  };

  /* ── 파일 메뉴 액션 ──────────────────────────────── */
  const closeMenu = () => setOpenMenu(null);
  const act = (fn: () => void) => { closeMenu(); fn(); };

  /* confirm() 대신 커스텀 모달 */
  const withConfirm = (message: string, onOk: () => void) => {
    setModal({
      title: "확인",
      body: (
        <div className="buddy-confirm-body">
          <p className="buddy-confirm-msg">{message}</p>
          <div className="buddy-confirm-btns">
            <button className="buddy-confirm-ok"   onClick={() => { setModal(null); onOk(); }}>확인</button>
            <button className="buddy-confirm-cancel" onClick={() => setModal(null)}>취소</button>
          </div>
        </div>
      ),
    });
  };

  const exportMemos = () => {
    const blob = new Blob([JSON.stringify(memos, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = `buddymemo-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Memo[];
        for (const m of data) {
          await fetch("/api/memos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: m.content }) });
        }
        fetchMemos();
      } catch { setError("가져오기에 실패했어요."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const deleteAllDone = () => {
    withConfirm("완료된 메모를 모두 삭제할까요?", async () => {
      const ids = memos.filter((m) => m.hearted).map((m) => m.id);
      if (!ids.length) return;
      setMemos((p) => p.filter((m) => !m.hearted));
      try { await Promise.all(ids.map((id) => fetch(`/api/memos/${id}`, { method: "DELETE" }))); }
      catch { fetchMemos(); }
    });
  };

  const deleteAll = () => {
    withConfirm("메모를 전부 삭제할까요? 이 작업은 되돌릴 수 없어요.", async () => {
      const ids = memos.map((m) => m.id);
      setMemos([]);
      try { await Promise.all(ids.map((id) => fetch(`/api/memos/${id}`, { method: "DELETE" }))); }
      catch { fetchMemos(); }
    });
  };

  /* ── 집계 ────────────────────────────────────────── */
  const activeCount    = memos.filter((m) => !m.hearted).length;
  const completedCount = memos.filter((m) =>  m.hearted).length;
  const importantCount = memos.filter((m) =>  m.pinned).length;
  const todayCount     = memos.filter((m) =>  isToday(m.createdAt)).length;

  const effectiveView = focusMode ? "active" : view;

  const displayMemos = memos.filter((m) => {
    const inView =
      effectiveView === "active"    ? !m.hearted :
      effectiveView === "completed" ?  m.hearted :
      effectiveView === "important" ?  m.pinned  :
      effectiveView === "today"     ?  isToday(m.createdAt) : true;
    const inSearch = !showSearch || !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase());
    return inView && inSearch;
  });

  const currentView = VIEWS[effectiveView];

  /* ── 메뉴 정의 ───────────────────────────────────── */
  const FILE_ITEMS: MenuItem[] = [
    { label: "새 메모 작성",         action: () => act(() => textareaRef.current?.focus()) },
    { sep: true },
    { label: "완료 메모 모두 삭제",   action: () => act(deleteAllDone) },
    { label: "전체 메모 삭제",        action: () => act(deleteAll) },
    { sep: true },
    { label: "메모 내보내기 (.json)", action: () => act(exportMemos) },
    { label: "메모 가져오기 (.json)", action: () => act(() => fileInputRef.current?.click()) },
    { label: "새로고침",              action: () => { closeMenu(); fetchMemos(); } },
  ];

  const LIST_ITEMS: MenuItem[] = [
    { label: "전체보기",     action: () => act(() => { setFocusMode(false); setView("all"); }) },
    { label: "진행중인 메모", action: () => act(() => { setFocusMode(false); setView("active"); }) },
    { label: "완료된 메모",  action: () => act(() => { setFocusMode(false); setView("completed"); }) },
    { label: "중요한 메모",  action: () => act(() => { setFocusMode(false); setView("important"); }) },
    { label: "오늘의 메모",  action: () => act(() => { setFocusMode(false); setView("today"); }) },
  ];

  const TOOLS_ITEMS: MenuItem[] = [
    { label: "뽀모도로 시작", action: () => act(() => setModal({ title: "🍅 뽀모도로", body: <p className="buddy-modal-info">뽀모도로 기능은 준비 중이에요.</p> })) },
    { label: "타이머 설정",   action: () => act(() => setModal({ title: "⏱ 타이머 설정", body: <p className="buddy-modal-info">타이머 기능은 준비 중이에요.</p> })) },
    { sep: true },
    { label: "메모 검색", action: () => act(() => { setShowSearch((p) => !p); setTimeout(() => searchRef.current?.focus(), 50); }) },
    { sep: true },
    { label: focusMode ? "☘️ 집중 모드 해제" : "☘️ 집중 모드", action: () => act(() => setFocusMode((p) => !p)) },
  ];

  const HELP_ITEMS: MenuItem[] = [
    { label: "버디메모 사용법", action: () => act(() => setModal({
      title: "버디메모 사용법",
      body: (
        <ul className="buddy-modal-list">
          <li>메모 입력 후 Enter 또는 [등록] 버튼으로 저장</li>
          <li>Shift+Enter로 줄바꿈</li>
          <li>☐ 버튼으로 완료 처리</li>
          <li>☆ 버튼으로 중요 표시</li>
          <li>마우스 오버 시 × 삭제 버튼 표시</li>
        </ul>
      ),
    })) },
    { label: "단축키 안내", action: () => act(() => setModal({
      title: "단축키 안내",
      body: (
        <table className="buddy-modal-table">
          <tbody>
            <tr><td>Enter</td><td>메모 저장</td></tr>
            <tr><td>Shift+Enter</td><td>줄바꿈</td></tr>
          </tbody>
        </table>
      ),
    })) },
    { sep: true },
    { label: "버전 정보", action: () => act(() => setModal({
      title: "버전 정보",
      body: (
        <div className="buddy-modal-version">
          <p className="mv-title">BuddyMemo 7.0</p>
          <p className="mv-sub">Retro Edition</p>
          <hr className="mv-hr" />
          <p>Inspired by BuddyBuddy</p>
          <p>Built with Notion Widget</p>
        </div>
      ),
    })) },
    { label: "개발자 정보", action: () => act(() => setModal({
      title: "개발자 정보",
      body: (
        <div className="buddy-modal-version">
          <p>Built with Next.js + Notion API</p>
          <p>Deployed on Vercel</p>
        </div>
      ),
    })) },
  ];

  const MENU_CONFIG: { key: MenuKey; label: string; items: MenuItem[] }[] = [
    { key: "file",  label: "파일(F)",   items: FILE_ITEMS  },
    { key: "list",  label: "목록(L)",   items: LIST_ITEMS  },
    { key: "tools", label: "도구(T)",   items: TOOLS_ITEMS },
    { key: "help",  label: "도움말(H)", items: HELP_ITEMS  },
  ];

  /* ── 노션 미연결 오류 화면 ───────────────────────── */
  if (!loading && error?.includes("NO_PAGES_ACCESSIBLE")) {
    return (
      <div className="buddy-access-error">
        <div className="buddy-access-card">
          <div className="buddy-empty-icon">🔐</div>
          <h2>노션 페이지 공유 필요</h2>
          <p>인테그레이션에 최소 1개의 노션 페이지를 공유해야<br />데이터베이스가 자동 생성됩니다.</p>
          <button onClick={fetchMemos} className="buddy-send">다시 시도</button>
        </div>
      </div>
    );
  }

  /* ── 메인 UI ─────────────────────────────────────── */
  return (
    <div className="buddy-shell">
      <div className="buddy-window">

        {/* 타이틀바 */}
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

        {/* 메뉴바 — 드롭다운 */}
        <nav className="buddy-menubar" ref={menubarRef} aria-label="상단 메뉴">
          {MENU_CONFIG.map(({ key, label, items }) => (
            <div key={key} className="buddy-menu-item">
              <button
                className={`buddy-menu-btn${openMenu === key ? " open" : ""}`}
                onClick={() => setOpenMenu((p) => (p === key ? null : key))}
              >
                {label}
              </button>
              {openMenu === key && (
                <div className="buddy-dropdown-panel">
                  {items.map((item, i) =>
                    "sep" in item
                      ? <div key={i} className="buddy-dropdown-sep" />
                      : <button key={i} className="buddy-dropdown-item" onClick={item.action}>{item.label}</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* 집중 모드 배너 */}
        {focusMode && (
          <div className="buddy-focus-banner">
            ☘️ 집중 모드 — 진행중 메모만 표시합니다.
            <button className="buddy-focus-off" onClick={() => setFocusMode(false)}>해제</button>
          </div>
        )}

        {/* 프로필바 */}
        <section className="buddy-profilebar">
          <div className="buddy-profile-left">
            <img src="/icon-buddy-symbol.png" alt="버디" className="buddy-face" />
            <span className="buddy-profile-name">버디버디</span>
            <span className="buddy-profile-state">&#123;접속&#125;</span>
          </div>
          <div className="buddy-toolbar">
            <button
              className="buddy-toolbar-item"
              onClick={async () => {
                const quote = await getRandomCheerMessage();
                setModal({
                  title: "✨ 오늘의 응원",
                  body: (
                    <div className="buddy-quote-body">
                      <p className="buddy-quote-text">"{quote}"</p>
                      <button className="buddy-quote-close" onClick={() => setModal(null)}>닫기</button>
                    </div>
                  ),
                });
              }}
            >
              <img src="/icon-mail-plus.png" alt="오늘의 한마디" className="buddy-toolbar-icon" />오늘의 한마디
            </button>
            <button
              className="buddy-toolbar-item"
              onClick={() => { setFocusMode(false); setView("all"); }}
            >
              <img src="/icon-home.png" alt="홈" className="buddy-toolbar-icon" />홈
            </button>
            <button
              className="buddy-toolbar-item"
              onClick={() => setModal({ title: "🎁 꾸미기", body: <p className="buddy-modal-info">꾸미기 기능은 준비 중이에요.</p> })}
            >
              <img src="/icon-itemshop.png" alt="꾸미기" className="buddy-toolbar-icon" />꾸미기
            </button>
          </div>
        </section>

        {/* 본문 */}
        <div className="buddy-body">

          {/* 사이드바 */}
          <aside className="buddy-sidebar" aria-label="메모 필터">
            {(Object.keys(VIEWS) as ViewMode[]).map((key) => (
              <button
                key={key}
                onClick={() => { setFocusMode(false); setView(key); }}
                className={`buddy-nav-button${effectiveView === key && !focusMode ? " active" : ""}`}
                title={VIEWS[key].title}
              >
                <img src={`/icon-${key}.png`} alt={VIEWS[key].label} className="buddy-nav-icon" />
              </button>
            ))}
            <div className="buddy-sidebar-footer">
              <div className="buddy-mini-stickers">
                <img src="/icon-service-star.png" alt="" className="buddy-mini-sticker" />
                <img src="/icon-service-star.png" alt="" className="buddy-mini-sticker" />
              </div>
              <div>버디메모<br />7.0</div>
            </div>
          </aside>

          {/* 메인 */}
          <main className="buddy-main">

            {/* 리스트바 */}
            <div className="buddy-listbar">
              <div className="buddy-list-title">
                <img src={`/icon-${effectiveView}.png`} alt={currentView.label} className="buddy-list-icon" />
                <span className="buddy-list-text">{currentView.title}</span>
              </div>
              <div className="buddy-counts">
                <span className="buddy-count-chip">진행 {activeCount}</span>
                <span className="buddy-count-chip">완료 {completedCount}</span>
                <span className="buddy-count-chip">중요 {importantCount}</span>
                <span className="buddy-count-chip">오늘 {todayCount}</span>
                <button onClick={fetchMemos} className="buddy-refresh" title="새로고침">↻</button>
              </div>
            </div>

            {/* 검색바 */}
            {showSearch && (
              <div className="buddy-searchbar">
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="메모 검색..."
                  className="buddy-search-input"
                />
                <button className="buddy-search-close" onClick={() => { setShowSearch(false); setSearchQuery(""); }}>×</button>
              </div>
            )}

            {/* 메모 목록 */}
            <section className="buddy-list">
              {error && !error.includes("NO_PAGES_ACCESSIBLE") && (
                <div className="buddy-error">오류: {error}</div>
              )}
              {!loading && displayMemos.length === 0 && (
                <div className="buddy-empty">
                  <img src={`/icon-${effectiveView}.png`} alt={currentView.label} className="buddy-empty-icon" />
                  <span>{currentView.empty}</span>
                </div>
              )}
              {loading && displayMemos.length === 0 && (
                <div className="buddy-empty">
                  <span style={{ fontSize: 32 }}>🍀</span>
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

            {/* 입력바 */}
            <footer className="buddy-inputbar">
              <div className="buddy-textarea-wrap">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMemo(); } }}
                  placeholder="메모를 입력하세요... (Enter 전송 / Shift+Enter 줄바꿈)"
                  rows={1}
                  className="buddy-textarea"
                />
              </div>
              <button onClick={sendMemo} disabled={!input.trim() || sending} className="buddy-send">
                <span>✏️</span>{sending ? "전송중" : "등록"}
              </button>
            </footer>
          </main>
        </div>

        {/* 상태바 */}
        <footer className="buddy-statusbar">
          <div className="buddy-status-cell">
            <img src="/icon-service-star.png" alt="서비스" className="buddy-status-icon" />버디버디 7.0 서비스 중
          </div>
          <div className="buddy-progress">
            <div className="buddy-progress-box"><span /><span /><span /><span /><span /></div>
          </div>
          <div className="buddy-status-cell">
            <img src={`/icon-${effectiveView}.png`} alt={currentView.label} className="buddy-status-icon" />{currentView.status}
          </div>
        </footer>

        {/* 파일 가져오기용 히든 input */}
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />

        {/* 모달 */}
        {modal && <Modal title={modal.title} body={modal.body} onClose={() => setModal(null)} />}

      </div>
    </div>
  );
}
