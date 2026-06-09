"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Memo = {
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

type ViewMode = "all" | "active" | "completed" | "important" | "today";
type MenuKey  = "file" | "list" | "tools" | "settings" | "help";
type ModalData = { title: string; body: React.ReactNode };
type MenuItem  = { label: string; action: () => void } | { sep: true };
type ThemeType = "buddy" | "win98";

type TimerStatus  = "idle" | "running" | "paused";
type TimerSession = { memoId: string; memoContent: string; status: TimerStatus; };

function formatHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}


const VIEWS: Record<ViewMode, { label: string; title: string; empty: string; status: string }> = {
  all:       { label: "전체",      title: "전체보기",       empty: "이 목록에는 아직 메모가 없어요.",   status: "버디메모 전체 목록을 보고 있어요." },
  today:     { label: "오늘 할 일", title: "오늘 할 일",    empty: "오늘 할 일로 등록된 메모가 없어요.", status: "오늘 처리할 메모예요." },
  important: { label: "중요",      title: "중요한 메모",    empty: "중요 표시한 메모가 없어요.",         status: "별표로 표시한 중요한 메모예요." },
  active:    { label: "진행중",    title: "진행중인 메모",  empty: "진행중인 메모가 없어요.",             status: "아직 끝나지 않은 메모예요." },
  completed: { label: "완료",      title: "완료된 메모",    empty: "완료된 메모가 없어요.",               status: "완료 처리한 메모예요." },
};

function timeLabel(dateString: string): string {
  const d = new Date(dateString);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const ap = hh >= 12 ? "PM" : "AM";
  const yyyy = d.getFullYear();
  return `${yyyy}.${mm}.${dd}  ${ap} ${String(hh % 12 || 12).padStart(2, "0")}:${mins}`;
}

function dueDateLabel(dueDate: string): { text: string; cls: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const mm = String(due.getMonth() + 1).padStart(2, "0");
  const dd = String(due.getDate()).padStart(2, "0");
  const dow = ["일", "월", "화", "수", "목", "금", "토"][due.getDay()];
  const dateStr = `${due.getFullYear()}.${mm}.${dd}(${dow})`;
  if (diffDays > 3)  return { text: `📅 ${dateStr}`,       cls: "due-normal" };
  if (diffDays > 0)  return { text: `⚠️ ${dateStr} D-${diffDays}`, cls: "due-soon" };
  if (diffDays === 0) return { text: `🔴 ${dateStr} D-Day`,  cls: "due-today" };
  return               { text: `❗ ${dateStr} D+${Math.abs(diffDays)}`, cls: "due-over" };
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


function TimerSetupModal({ memos, totalInvested, onStart, onCancel }: {
  memos: Memo[];
  totalInvested: Record<string, number>;
  onStart: (memoId: string, memoContent: string) => void;
  onCancel: () => void;
}) {
  const active = memos.filter((m) => m.status === "진행중");
  const [selectedId, setSelectedId] = useState("");
  const selectedContent = active.find((m) => m.id === selectedId)?.title ?? "";

  return (
    <div className="buddy-modal-overlay" onMouseDown={onCancel}>
      <div className="buddy-pomo-setup" onMouseDown={(e) => e.stopPropagation()}>
        <div className="buddy-modal-header">
          <span>⏱ 타이머 설정</span>
          <button className="buddy-modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="buddy-pomo-body">

          <div className="buddy-pomo-section">
            <span className="buddy-pomo-label">오늘의 작업</span>
            {active.length === 0
              ? <p className="buddy-pomo-empty">진행중인 메모가 없어요.</p>
              : (
                <select
                  className="buddy-pomo-select"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  <option value="" disabled>할 일 선택하기</option>
                  {active.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title.length > 26 ? m.title.slice(0, 26) + "…" : m.title}
                    </option>
                  ))}
                </select>
              )
            }
          </div>

          <div className="buddy-pomo-divider" />

          {selectedId && (
            <>
              <div className="buddy-pomo-section">
                <span className="buddy-pomo-label">누적 투자 시간</span>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#2c4a18", letterSpacing: 2, fontVariantNumeric: "tabular-nums" }}>
                  {formatHMS(totalInvested[selectedId] ?? 0)}
                </div>
              </div>
              <div className="buddy-pomo-divider" />
            </>
          )}

          <div className="buddy-pomo-btns">
            <button
              className="buddy-pomo-btn-primary"
              disabled={!selectedId}
              onClick={() => onStart(selectedId, selectedContent)}
            >시작</button>
            <button className="buddy-pomo-btn" onClick={onCancel}>취소</button>
          </div>

        </div>
      </div>
    </div>
  );
}


function TimerPanel({ memos, session, elapsed, totalInvested, currentCheer, onStart, onPause, onResume, onStop, onClose, onResetInvested, onResetElapsed }: {
  memos: Memo[];
  session: TimerSession | null;
  elapsed: number;
  totalInvested: Record<string, number>;
  currentCheer: string;
  onStart: (memoId: string, memoContent: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose: () => void;
  onResetInvested: (memoId: string) => void;
  onResetElapsed: () => void;
}) {
  const active = memos.filter(m => m.status === "진행중");
  const [selectedId, setSelectedId] = useState("");
  const [doneInfo, setDoneInfo] = useState<{ elapsed: number; total: number } | null>(null);

  const handleStop = () => {
    const e = elapsed;
    const t = (totalInvested[session!.memoId] ?? 0) + e;
    setDoneInfo({ elapsed: e, total: t });
    onStop();
  };

  const handleClose = () => { setDoneInfo(null); setSelectedId(""); onClose(); };

  if (doneInfo) {
    return (
      <aside className="buddy-focus-panel">
        <div className="buddy-fp-title" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>⏱ 타이머</span>
          <button className="buddy-fp-close-btn" onClick={handleClose}>×</button>
        </div>
        <div className="buddy-fp-body">
        <div className="buddy-fp-divider" />
        <div className="buddy-fp-section">
          <div className="buddy-fp-done" style={{ marginBottom: 10 }}>⏱ 작업 종료</div>
          <div className="buddy-fp-section-label">이번 세션</div>
          <div className="buddy-fp-elapsed">{formatHMS(doneInfo.elapsed)}</div>
          <div className="buddy-fp-section-label" style={{ marginTop: 8 }}>누적</div>
          <div className="buddy-fp-elapsed">{formatHMS(doneInfo.total)}</div>
        </div>
        <div className="buddy-fp-divider" />
        <div className="buddy-fp-controls">
          <button className="buddy-fp-ctrl-btn buddy-fp-ctrl-wide" onClick={handleClose}>닫기</button>
        </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="buddy-focus-panel">
      <div className="buddy-fp-title" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>⏱ 타이머</span>
        <button className="buddy-fp-close-btn" onClick={onClose}>×</button>
      </div>
      <div className="buddy-fp-body">
      <div className="buddy-fp-divider" />

      {!session ? (
        <>
          <div className="buddy-fp-setup-section">
            <span className="buddy-pomo-label">오늘의 작업</span>
            {active.length === 0
              ? <p className="buddy-pomo-empty">진행중인 메모가 없어요.</p>
              : (
                <select className="buddy-pomo-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                  <option value="">할 일 선택하기</option>
                  {active.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.title.length > 22 ? m.title.slice(0, 22) + "…" : m.title}
                    </option>
                  ))}
                </select>
              )
            }
          </div>

          <div className="buddy-fp-divider" />

          <div className="buddy-fp-section buddy-fp-time-row">
            <div style={{ flex: 1 }}>
              <div className="buddy-fp-section-label">경과 시간</div>
              <div className="buddy-fp-elapsed buddy-fp-elapsed-sm">00:00:00</div>
            </div>
            <div className="buddy-fp-time-divider" />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <div className="buddy-fp-section-label" style={{ marginBottom: 0 }}>총 투자 시간</div>
                {selectedId && (totalInvested[selectedId] ?? 0) > 0 && (
                  <button className="buddy-timer-reset-btn" onClick={() => onResetInvested(selectedId)} title="누적 시간 초기화">초기화</button>
                )}
              </div>
              <div className="buddy-fp-elapsed buddy-fp-elapsed-sm">{selectedId ? formatHMS(totalInvested[selectedId] ?? 0) : "00:00:00"}</div>
            </div>
          </div>

          <div className="buddy-fp-divider" />

          <div className="buddy-fp-controls">
            <button
              className="buddy-fp-ctrl-btn buddy-fp-ctrl-wide"
              disabled={!selectedId}
              onClick={() => { const m = active.find(x => x.id === selectedId); if (m) onStart(m.id, m.title); }}
            >▶ 시작</button>
          </div>
        </>
      ) : (
        <>
          <div className="buddy-fp-section">
            <div className="buddy-fp-section-label">오늘의 작업</div>
            <div className="buddy-fp-memo">{session.memoContent}</div>
          </div>

          <div className="buddy-fp-divider" />

          <div className="buddy-fp-section buddy-fp-time-row">
            <div style={{ flex: 1 }}>
              <div className="buddy-fp-section-label">경과 시간</div>
              <div className="buddy-fp-elapsed buddy-fp-elapsed-sm">{formatHMS(elapsed)}</div>
            </div>
            <div className="buddy-fp-time-divider" />
            <div style={{ flex: 1 }}>
              <div className="buddy-fp-section-label">총 투자 시간</div>
              <div className="buddy-fp-elapsed buddy-fp-elapsed-sm">{formatHMS((totalInvested[session.memoId] ?? 0) + elapsed)}</div>
            </div>
          </div>

          <div className="buddy-fp-divider" />

          <div className="buddy-fp-controls">
            {session.status === "running" && (
              <button className="buddy-fp-ctrl-btn" onClick={onPause} title="일시정지">⏸</button>
            )}
            {session.status === "paused" && (
              <button className="buddy-fp-ctrl-btn" onClick={onResume} title="재개">▶</button>
            )}
            <button className="buddy-fp-ctrl-btn" onClick={handleStop} title="종료">■</button>
            <button className="buddy-fp-ctrl-btn" onClick={onResetElapsed} title="경과 시간 초기화">↺</button>
          </div>
        </>
      )}
      </div>
    </aside>
  );
}

const BUDDY_NAV: Record<string, string> = {
  today:     "/images/today.png",
  important: "/images/important2.png",
  active:    "/images/active2.png",
};
const W98_NAV: Record<string, string> = {
  all:       "/images/win98/win98-memo-folder.png",
  active:    "/images/win98/win98-memo-new.png",
  today:     "/images/win98/win98-memo-today.png",
  completed: "/images/win98/win98-memo-done.png",
  important: "/images/win98/win98-memo-star.png",
};
function navIcon(key: string, theme: ThemeType): string {
  if (theme === "win98" && W98_NAV[key]) return W98_NAV[key];
  if (BUDDY_NAV[key]) return BUDDY_NAV[key];
  return `/icon-${key}.png`;
}

function MemoCard({ memo, onToggleDone, onToggleImportant, onToggleToday, onDelete, onDoubleClick, theme }: {
  memo: Memo;
  onToggleDone: () => void;
  onToggleImportant: () => void;
  onToggleToday: () => void;
  onDelete: () => void;
  onDoubleClick: () => void;
  theme: ThemeType;
}) {
  const w98 = theme === "win98";
  return (
    <div className={`buddy-memo-row${memo.status === "완료" ? " done" : ""}`}>
      <button onClick={onToggleDone} className="buddy-check" title={memo.status === "완료" ? "완료 취소" : "완료하기"}>
        {memo.status === "완료" ? "✓" : ""}
      </button>
      <div className="buddy-memo-text" onClick={onDoubleClick} style={{ cursor: "pointer" }}>
        <p className="buddy-memo-content">{memo.title}</p>
        <p className="buddy-memo-time">
          {timeLabel(memo.createdAt)}
          {memo.dueDate && (() => {
            const { text, cls } = dueDateLabel(memo.dueDate);
            return <span className={`due-badge ${cls}`}> ~ {text}</span>;
          })()}
        </p>
      </div>
      <button onClick={onToggleImportant} className="buddy-img-btn" title={memo.important ? "중요 해제" : "중요 표시"}>
        <img src={w98 ? "/images/win98/win98-memo-star.png" : "/images/important-after.png"} alt="중요" className={memo.important ? "" : "img-off"} />
      </button>
      <button onClick={onToggleToday} className="buddy-img-btn" title={memo.today ? "오늘 할 일 해제" : "오늘 할 일 등록"}>
        <img src={w98 ? "/images/win98/win98-memo-today.png" : "/images/today.png"} alt="오늘" className={memo.today ? "" : "img-off"} />
      </button>
      <button onClick={onToggleDone} className="buddy-img-btn" title={memo.status === "완료" ? "완료 취소" : "완료하기"}>
        <img src={w98 ? "/images/win98/win98-memo-done.png" : "/images/completed-on.png"} alt="완료" className={memo.status === "완료" ? "" : "img-off"} />
      </button>
      <a href={memo.url} target="_blank" rel="noopener noreferrer" className="buddy-img-btn" title="Notion에서 열기">
        <img src={w98 ? "/images/win98/win98-memo-folder.png" : "/images/move-to-memo.png"} alt="이동" />
      </a>
      <button onClick={onDelete} className="buddy-img-btn buddy-del-btn" title="삭제">
        <img src={w98 ? "/images/win98/win98-memo-delete.png" : "/images/delete-default.png"} alt="삭제" className="del-default" />
        <img src={w98 ? "/images/win98/win98-memo-delete.png" : "/images/delete-hover.png"} alt="삭제" className="del-hover" />
      </button>
    </div>
  );
}

function ThemeModal({ current, onSelect, onClose }: {
  current: ThemeType;
  onSelect: (t: ThemeType) => void;
  onClose: () => void;
}) {
  return (
    <div className="buddy-modal-overlay" onMouseDown={onClose}>
      <div className="buddy-modal" onMouseDown={(e) => e.stopPropagation()} style={{ minWidth: 240 }}>
        <div className="buddy-modal-header">
          <span>🎨 테마 설정</span>
          <button className="buddy-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="buddy-modal-body" style={{ padding: "16px 20px", display: "flex", flexDirection: "row", gap: 20, justifyContent: "center" }}>
          {/* 버디버디 버튼 */}
          <button
            onClick={() => { onSelect("buddy"); onClose(); }}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              opacity: current === "buddy" ? 1 : 0.4,
              transition: "opacity 0.15s",
            }}
          >
            <div style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/images/titlebar-main.png" alt="버디버디" style={{ height: 32, width: "auto" }} />
            </div>
            <span style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 900, color: "#526733" }}>
              {current === "buddy" ? "✓ " : ""}버디버디
            </span>
          </button>

          {/* Win98 버튼 */}
          <button
            onClick={() => { onSelect("win98"); onClose(); }}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              opacity: current === "win98" ? 1 : 0.4,
              transition: "opacity 0.15s",
            }}
          >
            <div style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/images/win98/win98-memo-theme.png" alt="Win98" style={{ height: 36, width: "auto", imageRendering: "pixelated" }} />
            </div>
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700, color: "#444" }}>
              {current === "win98" ? "✓ " : ""}Win98
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MemoWidget() {
  const [memos,       setMemos]       = useState<Memo[]>([]);
  const [quickMemo,   setQuickMemo]   = useState("");
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [view,        setView]        = useState<ViewMode>("all");
  const [openMenu,    setOpenMenu]    = useState<MenuKey | null>(null);
  const [showSearch,  setShowSearch]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modal,       setModal]       = useState<ModalData | null>(null);

  // 상세 작성 팝업
  const [isDetailOpen,   setIsDetailOpen]   = useState(false);
  const [detailTitle,    setDetailTitle]    = useState("");
  const [detailContent,  setDetailContent]  = useState("");
  const [detailImportant, setDetailImportant] = useState(false);
  const [detailToday,    setDetailToday]     = useState(false);
  const [detailCategory, setDetailCategory] = useState("");
  const [detailDueDate,  setDetailDueDate]   = useState("");
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  // 상세 보기 팝업
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);


  const [timerSetupOpen,  setTimerSetupOpen]  = useState(false);
  const [timerMode,       setTimerMode]       = useState(false);
  const [timerSession,    setTimerSession]    = useState<TimerSession | null>(null);
  const [timerElapsed,    setTimerElapsed]    = useState(0);
  const [totalInvested,   setTotalInvested]   = useState<Record<string, number>>({});
  const [cheerIdx,        setCheerIdx]        = useState(0);

  const [theme,            setThemeState]       = useState<ThemeType>("buddy");
  const setTheme = (t: ThemeType) => { setThemeState(t); try { localStorage.setItem("buddy-theme", t); } catch {} };
  const [themeOpen,        setThemeOpen]        = useState(false);
  const [notionReady,      setNotionReady]      = useState(false);
  const [needsSetup,       setNeedsSetup]       = useState(false);
  const [showPanelOnMobile, setShowPanelOnMobile] = useState(false);
  const [showUpdatePopup,  setShowUpdatePopup]  = useState(false);

  /* URL ?t= 파라미터 또는 localStorage 토큰 확인 */
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("t")) {
        setNotionReady(true);
        return;
      }
      const saved = localStorage.getItem("buddy-notion-token");
      if (!saved) setNeedsSetup(true);
    } catch {
      setNeedsSetup(true);
    }
    setNotionReady(true);
  }, []);

  /* 업데이트 팝업 — 버전 키가 바뀌면 다시 표시됨 */
  const UPDATE_POPUP_KEY = "buddy-update-seen-v2.1-duedate";
  useEffect(() => {
    try {
      if (!localStorage.getItem(UPDATE_POPUP_KEY)) setShowUpdatePopup(true);
    } catch {}
  }, []);

  const closeUpdatePopup = () => {
    try { localStorage.setItem(UPDATE_POPUP_KEY, "1"); } catch {}
    setShowUpdatePopup(false);
  };

  /* 모든 API 요청에 붙일 헤더 */
  const notionHeader = (): Record<string, string> => {
    try {
      const params = new URLSearchParams(window.location.search);
      const enc = params.get("t");
      if (enc) {
        const h: Record<string, string> = { "x-notion-enc-token": enc };
        const dbId = localStorage.getItem("buddy-notion-db-id");
        if (dbId) h["x-notion-db-id"] = dbId;
        return h;
      }
    } catch {}
    try {
      const t = localStorage.getItem("buddy-notion-token");
      const p = localStorage.getItem("buddy-notion-page-id");
      const dbId = localStorage.getItem("buddy-notion-db-id");
      const h: Record<string, string> = {};
      if (t) h["x-notion-token"] = t;
      if (p) h["x-notion-page-id"] = p;
      if (dbId) h["x-notion-db-id"] = dbId;
      return h;
    } catch {
      return {};
    }
  };

  const quickMemoRef  = useRef<HTMLTextAreaElement>(null);
  const menubarRef    = useRef<HTMLElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const searchRef     = useRef<HTMLInputElement>(null);
  const timerElapsedRef   = useRef(0);
  const timerStartRef     = useRef<number | null>(null);
  const timerAccumRef     = useRef(0);
  const allCheersRef      = useRef<string[]>([]);

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
      const res  = await fetch("/api/memos", { headers: notionHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemos(data.memos);
      if (data.databaseId) {
        try { localStorage.setItem("buddy-notion-db-id", data.databaseId); } catch {}
      }
      setTotalInvested(prev => {
        const next = { ...prev };
        (data.memos as Memo[]).forEach(m => {
          if ((m.totalTime ?? 0) > (prev[m.id] ?? 0)) next[m.id] = m.totalTime ?? 0;
        });
        try { localStorage.setItem("buddy-invested", JSON.stringify(next)); } catch {}
        return next;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (notionReady && !needsSetup) fetchMemos();
  }, [notionReady, needsSetup, fetchMemos]);


/* 마운트: localStorage 투자 시간 + 응원 메시지 로드 + 타이머 세션 복원 */
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("buddy-theme") as ThemeType | null;
      if (savedTheme === "buddy" || savedTheme === "win98") setThemeState(savedTheme);
    } catch {}
    try {
      const saved = localStorage.getItem("buddy-invested");
      if (saved) setTotalInvested(JSON.parse(saved));
    } catch {}
    fetch("/cheer-messages.json").then(r => r.json()).then(data => {
      allCheersRef.current = (data.messages as { text: string }[]).map(m => m.text);
    }).catch(() => { allCheersRef.current = ["오늘도 충분히 잘하고 있어요."]; });

    /* 타이머 세션 복원 */
    try {
      const raw = localStorage.getItem("buddy-timer-session");
      if (raw) {
        const s = JSON.parse(raw) as {
          memoId: string; memoContent: string; status: TimerStatus;
          startedAt: number | null; accumulated: number;
        };
        const accum = s.accumulated ?? 0;
        timerAccumRef.current = accum;
        timerElapsedRef.current = accum;
        timerStartRef.current = null;
        setTimerElapsed(accum);
        setTimerSession({ memoId: s.memoId, memoContent: s.memoContent, status: s.status });
        setTimerMode(true);
        setView("active");
      }
    } catch {}
  }, []);

  /* 타이머 경과 시간 카운트업 (wall-clock 기반) */
  useEffect(() => {
    if (!timerSession || timerSession.status !== "running") return;
    if (timerStartRef.current === null) timerStartRef.current = Date.now();
    const id = setInterval(() => {
      if (timerStartRef.current === null) return;
      const elapsed = timerAccumRef.current + Math.floor((Date.now() - timerStartRef.current) / 1000);
      timerElapsedRef.current = elapsed;
      setTimerElapsed(elapsed);
    }, 500);
    return () => clearInterval(id);
  }, [timerSession?.status]);

  /* 페이지 이탈/새로고침 시 타이머 세션 저장 */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!timerSession) return;
      const elapsed = timerAccumRef.current +
        (timerStartRef.current !== null ? Math.floor((Date.now() - timerStartRef.current) / 1000) : 0);
      try {
        localStorage.setItem("buddy-timer-session", JSON.stringify({
          memoId: timerSession.memoId,
          memoContent: timerSession.memoContent,
          status: "paused",
          startedAt: null,
          accumulated: elapsed,
        }));
      } catch {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [timerSession]);

  /* 타이머 실행 중 60초마다 Notion 자동 저장 */
  useEffect(() => {
    if (!timerSession || timerSession.status !== "running") return;
    const memoId = timerSession.memoId;
    const id = setInterval(() => {
      const elapsed = timerAccumRef.current +
        (timerStartRef.current !== null ? Math.floor((Date.now() - timerStartRef.current) / 1000) : 0);
      if (elapsed <= 0) return;
      let prevTotal = 0;
      try { prevTotal = JSON.parse(localStorage.getItem("buddy-invested") || "{}")[memoId] ?? 0; } catch {}
      fetch(`/api/memos/${memoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...notionHeader() },
        body: JSON.stringify({
          totalTime: prevTotal + elapsed,
          lastSessionTime: elapsed,
          lastWorkedAt: new Date().toISOString(),
        }),
      }).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [timerSession?.status, timerSession?.memoId]);

  /* 응원 문구 30초 로테이션 */
  useEffect(() => {
    const isRunning = timerSession?.status === "running";
    if (!isRunning) return;
    const id = setInterval(() => {
      if (allCheersRef.current.length > 0)
        setCheerIdx(prev => (prev + 1) % allCheersRef.current.length);
    }, 30000);
    return () => clearInterval(id);
  }, [timerSession?.status]);

  /* 메모 생성 */
  const createMemo = async (data: {
    title: string;
    content?: string;
    important?: boolean;
    today?: boolean;
    category?: string;
    dueDate?: string;
  }) => {
    if (!data.title.trim() || sending) return;
    setSending(true);
    try {
      const res  = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...notionHeader() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMemos((prev) => [json.memo, ...prev]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const patchMemo = async (id: string, optimistic: (m: Memo) => Memo, body: Record<string, any>) => {
    const prev = memos;
    setMemos((p) => p.map((m) => (m.id === id ? optimistic(m) : m)));
    try {
      const res = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...notionHeader() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
    } catch { setMemos(prev); }
  };

  const toggleDone = (id: string, curStatus: "진행중" | "완료" | "보류") => {
    const newStatus = curStatus === "완료" ? "진행중" : "완료";
    patchMemo(id, (m) => ({ ...m, status: newStatus }), { status: newStatus });
  };

  const toggleImportant = (id: string, curImportant: boolean) => {
    patchMemo(id, (m) => ({ ...m, important: !curImportant }), { important: !curImportant });
  };

  const toggleToday = (id: string, curToday: boolean) => {
    patchMemo(id, (m) => ({ ...m, today: !curToday }), { today: !curToday });
  };

  const setMemoStatus = (id: string, newStatus: "진행중" | "완료" | "보류") => {
    patchMemo(id, (m) => ({ ...m, status: newStatus }), { status: newStatus });
  };

  const deleteMemo = async (id: string) => {
    const prev = memos;
    setMemos((p) => p.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/memos/${id}`, { method: "DELETE", headers: notionHeader() });
      if (!res.ok) throw new Error();
    } catch { setMemos(prev); }
  };

  /* ── 파일 메뉴 ──────────────────────────────────────── */
  const closeMenu = () => setOpenMenu(null);
  const act = (fn: () => void) => { closeMenu(); fn(); };

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

const saveInvestedTime = (memoId: string, seconds: number) => {
    if (!memoId || seconds <= 0) return;
    const newTotal = (totalInvested[memoId] ?? 0) + seconds;
    setTotalInvested(prev => {
      const next = { ...prev, [memoId]: newTotal };
      try { localStorage.setItem("buddy-invested", JSON.stringify(next)); } catch {}
      return next;
    });
    fetch(`/api/memos/${memoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...notionHeader() },
      body: JSON.stringify({
        totalTime: newTotal,
        lastSessionTime: seconds,
        lastWorkedAt: new Date().toISOString(),
      }),
    }).catch(() => {});
    setMemos(prev => prev.map(m => m.id === memoId
      ? { ...m, totalTime: newTotal, lastSessionTime: seconds, lastWorkedAt: new Date().toISOString() }
      : m
    ));
  };


  const getTimerElapsed = () => {
    if (timerStartRef.current !== null)
      return timerAccumRef.current + Math.floor((Date.now() - timerStartRef.current) / 1000);
    return timerAccumRef.current;
  };


  const activateTimerMode   = () => { setTimerMode(true); };
  const deactivateTimerMode = () => {
    if (timerSession) saveInvestedTime(timerSession.memoId, getTimerElapsed());
    setTimerElapsed(0); timerElapsedRef.current = 0; timerAccumRef.current = 0; timerStartRef.current = null;
    setTimerSession(null); setTimerMode(false); setShowPanelOnMobile(false);
    try { localStorage.removeItem("buddy-timer-session"); } catch {}
  };
  const startTimer  = (memoId: string, memoContent: string) => {
    setTimerElapsed(0); timerElapsedRef.current = 0;
    timerAccumRef.current = 0; timerStartRef.current = Date.now();
    const msgs = allCheersRef.current;
    setCheerIdx(msgs.length > 0 ? Math.floor(Math.random() * msgs.length) : 0);
    try {
      localStorage.setItem("buddy-timer-session", JSON.stringify({
        memoId, memoContent, status: "running",
        startedAt: timerStartRef.current, accumulated: 0,
      }));
    } catch {}
    setTimerSession({ memoId, memoContent, status: "running" });
  };
  const pauseTimer  = () => {
    timerAccumRef.current = getTimerElapsed();
    timerElapsedRef.current = timerAccumRef.current;
    timerStartRef.current = null;
    setTimerSession(p => {
      if (!p) return null;
      try {
        localStorage.setItem("buddy-timer-session", JSON.stringify({
          memoId: p.memoId, memoContent: p.memoContent, status: "paused",
          startedAt: null, accumulated: timerAccumRef.current,
        }));
      } catch {}
      return { ...p, status: "paused" };
    });
  };
  const resumeTimer = () => {
    timerStartRef.current = Date.now();
    setTimerSession(p => {
      if (!p) return null;
      try {
        localStorage.setItem("buddy-timer-session", JSON.stringify({
          memoId: p.memoId, memoContent: p.memoContent, status: "running",
          startedAt: timerStartRef.current, accumulated: timerAccumRef.current,
        }));
      } catch {}
      return { ...p, status: "running" };
    });
  };
  const stopTimer   = () => {
    const elapsed = getTimerElapsed();
    if (timerSession) saveInvestedTime(timerSession.memoId, elapsed);
    setTimerElapsed(0); timerElapsedRef.current = 0; timerAccumRef.current = 0; timerStartRef.current = null;
    setTimerSession(null);
    try { localStorage.removeItem("buddy-timer-session"); } catch {}
  };

  const resetInvestedTime = (memoId: string) => {
    setTotalInvested(prev => {
      const next = { ...prev, [memoId]: 0 };
      try { localStorage.setItem("buddy-invested", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const resetTimerElapsed = () => {
    timerAccumRef.current = 0;
    timerStartRef.current = timerSession?.status === "running" ? Date.now() : null;
    timerElapsedRef.current = 0;
    setTimerElapsed(0);
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
        const data = JSON.parse(ev.target?.result as string) as any[];
        for (const m of data) {
          // 구 포맷(content만 있는 경우)과 새 포맷 모두 처리
          const title = m.title || m.content || "";
          const content = (m.title && m.content) ? m.content : "";
          if (title) {
            await fetch("/api/memos", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...notionHeader() },
              body: JSON.stringify({ title, content }),
            });
          }
        }
        fetchMemos();
      } catch { setError("가져오기에 실패했어요."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const deleteAllDone = () => {
    withConfirm("완료된 메모를 모두 삭제할까요?", async () => {
      const ids = memos.filter((m) => m.status === "완료").map((m) => m.id);
      if (!ids.length) return;
      setMemos((p) => p.filter((m) => m.status !== "완료"));
      try { await Promise.all(ids.map((id) => fetch(`/api/memos/${id}`, { method: "DELETE", headers: notionHeader() }))); }
      catch { fetchMemos(); }
    });
  };

  const deleteAll = () => {
    withConfirm("메모를 전부 삭제할까요? 이 작업은 되돌릴 수 없어요.", async () => {
      const ids = memos.map((m) => m.id);
      setMemos([]);
      try { await Promise.all(ids.map((id) => fetch(`/api/memos/${id}`, { method: "DELETE", headers: notionHeader() }))); }
      catch { fetchMemos(); }
    });
  };

  /* ── 집계 ────────────────────────────────────────────── */
  const activeCount    = memos.filter((m) => m.status === "진행중").length;
  const completedCount = memos.filter((m) => m.status === "완료").length;
  const importantCount = memos.filter((m) => m.important).length;

  const effectiveView = view;

  const displayMemos = memos.filter((m) => {
    const inView =
      effectiveView === "active"    ? m.status === "진행중" :
      effectiveView === "completed" ? m.status === "완료" :
      effectiveView === "important" ? m.important :
      effectiveView === "today"     ? m.today === true : true;
    const inSearch = !showSearch || !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase());
    return inView && inSearch;
  });

  const currentView  = VIEWS[effectiveView];
  const currentCheer = allCheersRef.current.length > 0
    ? allCheersRef.current[cheerIdx % allCheersRef.current.length]
    : "오늘도 충분히 잘하고 있어요.";

  /* ── 메뉴 정의 ───────────────────────────────────────── */
  const FILE_ITEMS: MenuItem[] = [
    { label: "새 메모 작성",         action: () => act(() => quickMemoRef.current?.focus()) },
    { sep: true },
    { label: "연동 설정 변경", action: () => act(() => withConfirm("Notion 연동 설정을 초기화할까요?", () => {
        localStorage.removeItem("buddy-notion-token");
        setNeedsSetup(true);
      }))
    },
    { sep: true },
    { label: "완료 메모 모두 삭제",   action: () => act(deleteAllDone) },
    { label: "전체 메모 삭제",        action: () => act(deleteAll) },
    { sep: true },
    { label: "메모 내보내기 (.json)", action: () => act(exportMemos) },
    { label: "메모 가져오기 (.json)", action: () => act(() => fileInputRef.current?.click()) },
    { label: "새로고침",              action: () => { closeMenu(); fetchMemos(); } },
  ];

  const LIST_ITEMS: MenuItem[] = [
    { label: "전체보기",     action: () => act(() => setView("all")) },
    { label: "진행중인 메모", action: () => act(() => setView("active")) },
    { label: "완료된 메모",  action: () => act(() => setView("completed")) },
    { label: "중요한 메모",  action: () => act(() => setView("important")) },
  ];

  const TOOLS_ITEMS: MenuItem[] = [
    { label: "타이머",   action: () => act(() => setTimerSetupOpen(true)) },
    { sep: true },
    { label: "메모 검색", action: () => act(() => { setShowSearch((p) => !p); setTimeout(() => searchRef.current?.focus(), 50); }) },
  ];

  const SETTINGS_ITEMS: MenuItem[] = [
    { label: "테마 변경", action: () => act(() => setThemeOpen(true)) },
    { sep: true },
    { label: "초기화", action: () => act(() => setModal({
      title: "⚠️ Notion 연동을 초기화할까요?",
      body: (
        <div className="buddy-confirm-body">
          <p className="buddy-confirm-msg">
            초기화하면 저장된 API 토큰이 삭제되며,<br />
            다시 설정을 진행해야 합니다.<br />
            메모 데이터는 Notion에 그대로 유지됩니다.
          </p>
          <div className="buddy-confirm-btns">
            <button className="buddy-confirm-ok" onClick={() => {
              setModal(null);
              try {
                localStorage.removeItem("buddy-notion-token");
                localStorage.removeItem("buddy-notion-page-id");
                localStorage.removeItem("buddy-notion-db-id");
                localStorage.removeItem("buddy-invested");
                localStorage.removeItem("buddy-timer-session");
                localStorage.removeItem("buddy-theme");
              } catch {}
              setThemeState("buddy");
              setTotalInvested({});
              setTimerSession(null);
              setTimerMode(false);
              setTimerElapsed(0);
              timerAccumRef.current = 0;
              timerStartRef.current = null;
              timerElapsedRef.current = 0;
              setMemos([]);
              setNeedsSetup(true);
            }}>확인</button>
            <button className="buddy-confirm-cancel" onClick={() => setModal(null)}>취소</button>
          </div>
        </div>
      ),
    })) },
  ];

  const HELP_ITEMS: MenuItem[] = [
    { label: "버디메모 사용법", action: () => act(() => setModal({
      title: "버디메모 사용법",
      body: (
        <ul className="buddy-modal-list">
          <li>입력창에 메모 입력 후 Enter 또는 [📝 등록] 클릭</li>
          <li>[상세 작성 ▼]로 내용·옵션 포함 메모 작성</li>
          <li>체크박스 클릭 → 완료 처리</li>
          <li>⭐ 클릭 → 중요 표시 토글</li>
          <li>더블클릭 → 상세 보기 (삭제·상태 변경 가능)</li>
        </ul>
      ),
    })) },
    { sep: true },
    { label: "업데이트 내역", action: () => act(() => setModal({
      title: "업데이트 내역",
      body: (
        <div className="buddy-modal-version">
          <p className="mv-title">BuddyMemo 7.0</p>
          <p className="mv-sub">Retro Edition</p>
          <hr className="mv-hr" />
          <ul className="buddy-modal-list" style={{ marginTop: 0 }}>
            <li>메뉴바 구조 개편 (설정 메뉴 추가)</li>
            <li>타이머 기능 개선</li>
            <li>Win98 / 버디버디 듀얼 테마</li>
            <li>분류(select) 속성 지원</li>
            <li>검색 기능 추가</li>
          </ul>
        </div>
      ),
    })) },
    { label: "문의하기", action: () => act(() => setModal({
      title: "문의하기",
      body: (
        <div className="buddy-modal-version">
          <p style={{ marginBottom: 8 }}>버그 신고 및 기능 제안은 아래로 연락해 주세요.</p>
          <p>📧 00gungum00i@gmail.com</p>
        </div>
      ),
    })) },
  ];

  const MENU_CONFIG: { key: MenuKey; label: string; items: MenuItem[] }[] = [
    { key: "file",     label: "파일(F)",   items: FILE_ITEMS     },
    { key: "list",     label: "목록(L)",   items: LIST_ITEMS     },
    { key: "tools",    label: "도구(T)",   items: TOOLS_ITEMS    },
    { key: "settings", label: "설정(S)",   items: SETTINGS_ITEMS },
    { key: "help",     label: "도움말(H)", items: HELP_ITEMS     },
  ];

  /* ── 초기화 전 로딩 ──────────────────────────────────── */
  if (!notionReady) return null;

  /* ── 설정 안내 화면 ─────────────────────────────────── */
  if (needsSetup) {
    return (
      <div className="buddy-shell">
        <div className="buddy-window">
          <header className="buddy-titlebar">
            <div className="buddy-title-left">
              <span className="buddy-logo">🐻</span>
              <span className="buddy-title-text">BUDDYMEMO&nbsp;&nbsp;7.0</span>
            </div>
          </header>
          <div className="buddy-setup-overlay">
            <div className="buddy-setup-card">
              <div className="buddy-setup-header">
                <span>🐻 BuddyMemo에 오신 것을 환영합니다!</span>
              </div>
              <div className="buddy-setup-body">
                <p className="buddy-setup-desc">
                  시작하기 전에 Notion API 연동 설정이 필요합니다.<br />
                  확인 버튼을 눌러 설정을 진행해주세요.
                </p>
                <button
                  className="buddy-setup-btn"
                  onClick={() => { window.location.href = "/setup"; }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── 노션 미연결 오류 화면 ───────────────────────────── */
  if (!loading && error?.includes("NO_PAGES_ACCESSIBLE")) {
    return (
      <div className="buddy-access-error">
        <div className="buddy-access-card">
          <div className="buddy-empty-icon">🔐</div>
          <h2>노션 페이지 공유 필요</h2>
          <p>인테그레이션에 최소 1개의 노션 페이지를 공유해야<br />데이터베이스가 자동 생성됩니다.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 4 }}>
            <button onClick={fetchMemos} className="buddy-send">다시 시도</button>
            <button
              onClick={() => {
                try { localStorage.removeItem("buddy-notion-token"); } catch {}
                setError(null);
                setNeedsSetup(true);
              }}
              className="buddy-send"
              style={{ background: "#d4cfc0" }}
            >토큰 재설정</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── 메인 UI ─────────────────────────────────────────── */
  return (
    <div className={`buddy-shell theme-${theme}`}>
      <div className="buddy-window">

        {/* 타이틀바 */}
        <header className="buddy-titlebar">
          <div className="buddy-title-left">
            <img src={theme === "win98" ? "/images/win98/win98-memo-theme.png" : "/images/titlebar-main.png"} alt="" className="buddy-titlebar-mail" aria-hidden="true" />
            <span className="buddy-title-text">BUDDYMEMO&nbsp;&nbsp;7.0</span>
          </div>
          <div className="buddy-window-buttons" aria-hidden="true">
            <span className="buddy-win-btn">−</span>
            <span className="buddy-win-btn">□</span>
            <span className="buddy-win-btn">×</span>
          </div>
        </header>

        {/* 메뉴바 */}
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


        {/* 프로필바 */}
        <section className="buddy-profilebar">
          <div className="buddy-profile-left">
            <img src="/icon-buddy-symbol.png" alt="버디" className="buddy-face" />
            <span className="buddy-profile-name">버디메모</span>
            <span className="buddy-profile-state">&#123;접속&#125;</span>
          </div>
          <div className="buddy-toolbar">
            <button
              className="buddy-toolbar-item"
              onClick={() => setView("all")}
            >
              <img src={theme === "win98" ? "/images/win98/win98-memo-home.png" : "/icon-home.png"} alt="홈" className="buddy-toolbar-icon" />홈
            </button>
            <button
              className="buddy-toolbar-item"
              onClick={() => { setShowSearch((p) => !p); setTimeout(() => searchRef.current?.focus(), 50); }}
            >
              <img src="/images/search.png" alt="검색" className="buddy-toolbar-icon" style={{ width: 15, height: 15 }} />검색
            </button>
            <button
              className="buddy-toolbar-item"
              onClick={() => {
                const msgs = allCheersRef.current;
                const quote = msgs.length > 0 ? msgs[Math.floor(Math.random() * msgs.length)] : "오늘도 충분히 잘하고 있어요.";
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
              <img src={theme === "win98" ? "/images/win98/win98-memo-message.png" : "/icon-mail-plus.png"} alt="오늘의 한마디" className="buddy-toolbar-icon" />오늘의 한마디
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
                onClick={() => setView(key)}
                className={`buddy-nav-button${effectiveView === key ? " active" : ""}`}
                title={VIEWS[key].title}
              >
                <img src={navIcon(key, theme)} alt={VIEWS[key].label} className="buddy-nav-icon" style={key === "today" ? { width: theme === "win98" ? 27 : 29, height: theme === "win98" ? 27 : 29 } : undefined} />
              </button>
            ))}
            <div className="buddy-sidebar-footer">
              <div className="buddy-sidebar-brand">BUDDY<br />MEMO</div>
            </div>
          </aside>

          {/* 메인 */}
          <main className={`buddy-main${timerMode ? " buddy-main--split" : ""}${timerMode && showPanelOnMobile ? " mobile-panel" : ""}`}>
            <div className="buddy-memo-area">

            {/* 모바일: 활성 패널로 전환 버튼 */}
            {timerMode && (
              <button className="buddy-mobile-to-panel" onClick={() => setShowPanelOnMobile(true)}>
                ⏱ 타이머 실행 중&nbsp;&nbsp;→ 보러가기
              </button>
            )}

            {/* 리스트바 */}
            <div className="buddy-listbar">
              <div className="buddy-list-title">
                <img src={navIcon(effectiveView, theme)} alt={currentView.label} className="buddy-list-icon" />
                <span className="buddy-list-text">{currentView.title}</span>
              </div>
              <div className="buddy-counts">
                <span className="buddy-count-chip">진행 {activeCount}</span>
                <span className="buddy-count-chip">완료 {completedCount}</span>
                <span className="buddy-count-chip">중요 {importantCount}</span>
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
                  <img src={navIcon(effectiveView, theme)} alt={currentView.label} className="buddy-empty-icon" />
                  <span>{currentView.empty}</span>
                </div>
              )}
              {loading && displayMemos.length === 0 && (
                <div className="buddy-empty">
                  {theme === "win98"
                    ? <img src="/images/win98/win98-memo-hourglass.png" alt="로딩" style={{ width: 32, height: 32, imageRendering: "pixelated" }} />
                    : <span style={{ fontSize: 32 }}>🍀</span>
                  }
                  <span>메모를 불러오는 중...</span>
                </div>
              )}
              {displayMemos.map((memo) => (
                <MemoCard
                  key={memo.id}
                  memo={memo}
                  theme={theme}
                  onToggleDone={() => toggleDone(memo.id, memo.status)}
                  onToggleImportant={() => toggleImportant(memo.id, memo.important)}
                  onToggleToday={() => toggleToday(memo.id, memo.today ?? false)}
                  onDelete={() => withConfirm("메모를 삭제하시겠습니까?", () => deleteMemo(memo.id))}
                  onDoubleClick={() => setSelectedMemo(memo)}
                />
              ))}
            </section>

            {/* 입력바 */}
            <footer className="memo-input-bar">
              <textarea
                ref={quickMemoRef}
                value={quickMemo}
                rows={1}
                onChange={(e) => {
                  setQuickMemo(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (quickMemo.trim()) {
                      createMemo({ title: quickMemo });
                      setQuickMemo("");
                      if (quickMemoRef.current) {
                        quickMemoRef.current.style.height = "auto";
                      }
                    }
                  }
                }}
                placeholder="메모를 입력하세요... (Enter 전송 · Shift+Enter 줄바꿈)"
              />
              <button
                className="win98-button"
                disabled={!quickMemo.trim() || sending}
                onClick={() => {
                  if (!quickMemo.trim()) return;
                  createMemo({ title: quickMemo });
                  setQuickMemo("");
                }}
              >
                {theme === "win98"
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><img src="/images/win98/win98-memo-save.png" alt="" style={{ height: 13, width: "auto" }} />등록</span>
                  : "📝 등록"}
              </button>
              <button
                className="win98-button"
                onClick={() => setIsDetailOpen(true)}
              >
                상세 작성 ▼
              </button>
            </footer>
            </div>{/* buddy-memo-area */}

            {timerMode && (
              <div className="buddy-right-panels">
                <button className="buddy-mobile-back" onClick={() => setShowPanelOnMobile(false)}>
                  ← 메모 목록
                </button>
                <TimerPanel
                  memos={memos}
                  session={timerSession}
                  elapsed={timerElapsed}
                  totalInvested={totalInvested}
                  currentCheer={currentCheer}
                  onStart={startTimer}
                  onPause={pauseTimer}
                  onResume={resumeTimer}
                  onStop={stopTimer}
                  onClose={deactivateTimerMode}
                  onResetInvested={resetInvestedTime}
                  onResetElapsed={resetTimerElapsed}
                />
              </div>
            )}
          </main>
        </div>

        {/* 상태바 */}
        <footer className="buddy-statusbar">
          <div className="buddy-status-cell">
            <img src={theme === "win98" ? "/images/win98/win98-memo-theme.png" : "/images/titlebar-main.png"} alt="서비스" className="buddy-status-icon" />버디버디 7.0 서비스 중
          </div>
          <div className="buddy-progress">
            <div className="buddy-progress-box"><span /><span /><span /><span /><span /></div>
          </div>
          <div className="buddy-status-cell">
            {timerSession
              ? <><img src={theme === "win98" ? "/images/win98/win98-memo-timer.png" : "/icon-active.png"} alt="타이머" className="buddy-status-icon" />
                  {`⏱ ${timerSession.memoContent.length > 14 ? timerSession.memoContent.slice(0, 14) + "…" : timerSession.memoContent} 기록 중`}</>
              : <><img src={navIcon(effectiveView, theme)} alt={currentView.label} className="buddy-status-icon" />{currentView.status}</>
            }
          </div>
        </footer>

        {/* 파일 가져오기용 히든 input */}
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />

        {/* 타이머 설정 */}
        {timerSetupOpen && (
          <TimerSetupModal
            memos={memos}
            totalInvested={totalInvested}
            onStart={(id, content) => {
              startTimer(id, content);
              setTimerMode(true);
              setShowPanelOnMobile(true);
              setTimerSetupOpen(false);
            }}
            onCancel={() => setTimerSetupOpen(false)}
          />
        )}

        {/* 상세 작성 팝업 */}
        {isDetailOpen && (
          <div className="memo-modal-backdrop" onMouseDown={() => setIsDetailOpen(false)}>
            <div className="memo-detail-window" onMouseDown={(e) => e.stopPropagation()}>
              <div className="memo-window-title">
                <span>☘ 상세 메모 작성</span>
                <button onClick={() => setIsDetailOpen(false)}>×</button>
              </div>
              <div className="memo-detail-body">
                <label>제목 :</label>
                <input
                  type="text"
                  value={detailTitle}
                  onChange={(e) => setDetailTitle(e.target.value)}
                  placeholder="제목 입력"
                  autoFocus
                />
                <label>내용 :</label>
                <textarea
                  value={detailContent}
                  onChange={(e) => setDetailContent(e.target.value)}
                  placeholder="내용을 입력하세요..."
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <label style={{ margin: 0, whiteSpace: "nowrap", flexShrink: 0 }}>분류 :</label>
                <div style={{ display: "flex", gap: 5, flex: 1 }}>
                  {!newCategoryMode ? (
                    <>
                      <select
                        value={detailCategory}
                        onChange={(e) => setDetailCategory(e.target.value)}
                        style={{ flex: 1, fontFamily: "inherit", fontSize: 12 }}
                      >
                        <option value="">선택 안 함</option>
                        {Array.from(new Set(memos.map(m => m.category).filter(Boolean))).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="win98-button"
                        style={{ fontSize: 11, whiteSpace: "nowrap" }}
                        onClick={() => { setNewCategoryMode(true); setNewCategoryInput(""); }}
                      >
                        + 새 분류
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        autoFocus
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (newCategoryInput.trim()) {
                              setDetailCategory(newCategoryInput.trim());
                            }
                            setNewCategoryMode(false);
                          }
                          if (e.key === "Escape") {
                            setNewCategoryMode(false);
                          }
                        }}
                        placeholder="새 분류명 입력 후 Enter"
                        style={{ flex: 1, fontFamily: "inherit", fontSize: 12 }}
                      />
                      <button
                        type="button"
                        className="win98-button"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          if (newCategoryInput.trim()) setDetailCategory(newCategoryInput.trim());
                          setNewCategoryMode(false);
                        }}
                      >
                        확인
                      </button>
                      <button
                        type="button"
                        className="win98-button"
                        style={{ fontSize: 11 }}
                        onClick={() => setNewCategoryMode(false)}
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>
                </div>
                <div className="memo-option-row">
                  <label style={{ whiteSpace: "nowrap" }}>마감일</label>
                  <input
                    type="date"
                    value={detailDueDate}
                    onChange={(e) => setDetailDueDate(e.target.value)}
                    style={{ fontFamily: "inherit", fontSize: 12 }}
                  />
                  {detailDueDate && (
                    <button
                      type="button"
                      className="win98-button"
                      style={{ fontSize: 11 }}
                      onClick={() => setDetailDueDate("")}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="memo-option-row">
                  <label>
                    <input type="checkbox" checked={detailImportant} onChange={(e) => setDetailImportant(e.target.checked)} />
                    중요
                  </label>
                  <label>
                    <input type="checkbox" checked={detailToday} onChange={(e) => setDetailToday(e.target.checked)} />
                    오늘 할 일
                  </label>
                </div>
                <div className="memo-modal-buttons">
                  <button
                    className="win98-button"
                    disabled={!detailTitle.trim() || sending}
                    onClick={async () => {
                      if (!detailTitle.trim()) return;
                      await createMemo({
                        title: detailTitle,
                        content: detailContent,
                        important: detailImportant,
                        today: detailToday,
                        category: detailCategory.trim() || undefined,
                        dueDate: detailDueDate || undefined,
                      });
                      setDetailTitle(""); setDetailContent("");
                      setDetailImportant(false); setDetailToday(false); setDetailCategory(""); setDetailDueDate("");
                      setNewCategoryMode(false); setNewCategoryInput("");
                      setIsDetailOpen(false);
                    }}
                  >
                    등록
                  </button>
                  <button className="win98-button" onClick={() => setIsDetailOpen(false)}>취소</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 상세 보기 팝업 */}
        {selectedMemo && (
          <div className="memo-modal-backdrop" onMouseDown={() => setSelectedMemo(null)}>
            <div className="memo-view-window" onMouseDown={(e) => e.stopPropagation()}>
              <div className={`memo-window-title${selectedMemo.important ? " blue" : ""}`}>
                <span>메모</span>
                <button onClick={() => setSelectedMemo(null)}>×</button>
              </div>
              <div className="memo-view-body">
                <h2>
                  {selectedMemo.title}
                  {selectedMemo.important && <span> ⭐</span>}
                </h2>
                {selectedMemo.content && <p>{selectedMemo.content}</p>}
                <div className="memo-view-info">
                  <span>총 투자 시간 : {formatHMS(selectedMemo.totalTime ?? 0)}</span>
                  <span>작성 : {timeLabel(selectedMemo.createdAt)}</span>
                </div>
                {/* 마감일 */}
                <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: theme === "win98" ? "#000000" : "#526733", fontWeight: 700, whiteSpace: "nowrap" }}>마감일 :</span>
                  <input
                    type="date"
                    value={selectedMemo.dueDate ?? ""}
                    onChange={(e) => {
                      const val = e.target.value || undefined;
                      patchMemo(selectedMemo.id, (m) => ({ ...m, dueDate: val }), { dueDate: val ?? null });
                      setSelectedMemo((p) => p ? { ...p, dueDate: val } : null);
                    }}
                    style={{ fontFamily: "inherit", fontSize: 12 }}
                  />
                  {selectedMemo.dueDate && (
                    <>
                      {(() => {
                        const { text, cls } = dueDateLabel(selectedMemo.dueDate);
                        return <span className={`due-badge ${cls}`}>{text}</span>;
                      })()}
                      <button
                        type="button"
                        className="win98-button"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          patchMemo(selectedMemo.id, (m) => ({ ...m, dueDate: undefined }), { dueDate: null });
                          setSelectedMemo((p) => p ? { ...p, dueDate: undefined } : null);
                        }}
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
                {/* 상태 변경 */}
                <div style={{ display: "flex", gap: 5, marginTop: 12, alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: theme === "win98" ? "#000000" : "#526733", fontWeight: 700 }}>상태 :</span>
                  {(["진행중", "완료", "보류"] as const).map((s) => (
                    <button
                      key={s}
                      className="win98-button"
                      style={{
                        height: 24, fontSize: 11,
                        background: selectedMemo.status === s
                          ? (theme === "win98" ? "#000080" : "#c8e88a")
                          : undefined,
                        color: selectedMemo.status === s && theme === "win98" ? "#ffffff" : undefined,
                      }}
                      onClick={() => {
                        setMemoStatus(selectedMemo.id, s);
                        setSelectedMemo((p) => p ? { ...p, status: s } : null);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="memo-modal-buttons">
                  <button
                    className="win98-button"
                    onClick={() => {
                      toggleImportant(selectedMemo.id, selectedMemo.important);
                      setSelectedMemo((p) => p ? { ...p, important: !p.important } : null);
                    }}
                  >
                    {selectedMemo.important ? "⭐ 중요 해제" : "☆ 중요"}
                  </button>
                  <button
                    className="win98-button"
                    style={{ color: "#b03020" }}
                    onClick={() => {
                      withConfirm("메모를 삭제하시겠습니까?", () => {
                        deleteMemo(selectedMemo.id);
                        setSelectedMemo(null);
                      });
                    }}
                  >
                    삭제
                  </button>
                  <button className="win98-button" onClick={() => setSelectedMemo(null)}>닫기</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 테마 설정 */}
        {themeOpen && (
          <ThemeModal current={theme} onSelect={setTheme} onClose={() => setThemeOpen(false)} />
        )}

        {/* 모달 */}
        {modal && <Modal title={modal.title} body={modal.body} onClose={() => setModal(null)} />}

        {/* 업데이트 안내 팝업 */}
        {showUpdatePopup && (
          <div className="buddy-modal-overlay" onMouseDown={closeUpdatePopup}>
            <div className="buddy-modal update-popup" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
              <div className="buddy-modal-header">
                <span>📢 버디메모 업데이트 안내</span>
                <button className="buddy-modal-close" onClick={closeUpdatePopup}>×</button>
              </div>
              <div className="buddy-modal-body">
                <p style={{ fontWeight: 900, fontSize: 13, marginBottom: 8, color: "#2d4a1a" }}>
                  📅 마감일 기능이 추가됐어요!
                </p>
                <p style={{ marginBottom: 10, color: "#444" }}>
                  메모에 마감일을 설정하면 카드에 D-Day 뱃지가 표시되고,<br />
                  상세 보기에서 바로 수정할 수 있어요.
                </p>
                <div className="update-popup-steps">
                  <p style={{ fontWeight: 900, color: "#526733", marginBottom: 6 }}>
                    ⚙️ 노션 DB 설정이 필요해요
                  </p>
                  <ol style={{ paddingLeft: 18, color: "#444", lineHeight: 2 }}>
                    <li>연결된 노션 DB를 열어주세요</li>
                    <li>오른쪽 위 <strong>+</strong> 버튼으로 속성 추가</li>
                    <li>속성 타입 <strong>날짜(Date)</strong> 선택</li>
                    <li>속성 이름을 정확히 <strong>마감일</strong> 로 입력</li>
                  </ol>
                </div>
                <p style={{ marginTop: 10, fontSize: 11, color: "#888" }}>
                  설정 전에는 마감일 저장이 되지 않아요.
                </p>
                <div style={{ textAlign: "right", marginTop: 14 }}>
                  <button className="win98-button" style={{ minWidth: 72, height: 28, fontWeight: 900 }} onClick={closeUpdatePopup}>
                    확인
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
