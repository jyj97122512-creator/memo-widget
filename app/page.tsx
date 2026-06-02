"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Memo = {
  id: string;
  title: string;
  content: string;
  status: "진행중" | "완료" | "보류";
  important: boolean;
  category?: string;
  totalTime?: number;
  lastSessionTime?: number;
  lastWorkedAt?: string;
  createdAt: string;
  url: string;
};

type ViewMode = "all" | "active" | "completed" | "important";
type MenuKey  = "file" | "list" | "tools" | "help";
type ModalData = { title: string; body: React.ReactNode };
type MenuItem  = { label: string; action: () => void } | { sep: true };
type ThemeType = "buddy" | "win98";

type PomodoroStatus = "running" | "paused" | "completed" | "break";
type PomodoroConfig = {
  memoId: string; memoContent: string;
  focusMinutes: number; breakMinutes: number; withSound: boolean;
};
type PomodoroSession = PomodoroConfig & {
  remainingSeconds: number; status: PomodoroStatus; cheerMessage: string;
};

type TimerStatus  = "idle" | "running" | "paused";
type TimerSession = { memoId: string; memoContent: string; status: TimerStatus; };

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

function formatHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return `${h}시간 ${m}분`;
}

function playBeep(ctx: AudioContext) {
  try {
    ctx.resume().then(() => {
      const tone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      tone(880, 0,    0.3);
      tone(1108, 0.32, 0.3);
      tone(1320, 0.64, 0.6);
    });
  } catch {}
}

const VIEWS: Record<ViewMode, { label: string; title: string; empty: string; status: string }> = {
  all:       { label: "전체",  title: "전체보기",     empty: "이 목록에는 아직 메모가 없어요.",  status: "버디메모 전체 목록을 보고 있어요." },
  active:    { label: "진행중", title: "진행중인 메모", empty: "진행중인 메모가 없어요.",           status: "아직 끝나지 않은 메모예요." },
  completed: { label: "완료",  title: "완료된 메모",   empty: "완료된 메모가 없어요.",             status: "완료 처리한 메모예요." },
  important: { label: "중요",  title: "중요한 메모",   empty: "중요 표시한 메모가 없어요.",        status: "별표로 표시한 중요한 메모예요." },
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

function PomodoroSetup({ memos, onStart, onCancel }: {
  memos: Memo[];
  onStart: (cfg: PomodoroConfig) => void;
  onCancel: () => void;
}) {
  const active = memos.filter((m) => m.status === "진행중");
  const [selectedId, setSelectedId] = useState("");
  const [focusMin,   setFocusMin]   = useState(25);
  const [breakMin,   setBreakMin]   = useState(5);
  const [withSound,  setWithSound]  = useState(false);
  const selectedContent = active.find((m) => m.id === selectedId)?.title ?? "";

  return (
    <div className="buddy-modal-overlay" onMouseDown={onCancel}>
      <div className="buddy-pomo-setup" onMouseDown={(e) => e.stopPropagation()}>
        <div className="buddy-modal-header">
          <span>☘ 집중모드 설정</span>
          <button className="buddy-modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="buddy-pomo-body">

          <div className="buddy-pomo-section">
            <span className="buddy-pomo-label">오늘의 집중</span>
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

          <div className="buddy-pomo-time-row">
            <div className="buddy-pomo-time-col">
              <span className="buddy-pomo-label">집중 시간</span>
              <input type="range" min={1} max={60} value={focusMin}
                onChange={(e) => setFocusMin(Number(e.target.value))}
                className="buddy-pomo-slider buddy-pomo-slider-full" />
              <div className="buddy-pomo-val">{focusMin}분</div>
            </div>
            <div className="buddy-pomo-col-divider" />
            <div className="buddy-pomo-time-col">
              <span className="buddy-pomo-label">휴식 시간</span>
              <input type="range" min={1} max={60} value={breakMin}
                onChange={(e) => setBreakMin(Number(e.target.value))}
                className="buddy-pomo-slider buddy-pomo-slider-full" />
              <div className="buddy-pomo-val">{breakMin}분</div>
            </div>
          </div>

          <div className="buddy-pomo-divider" />

          <div className="buddy-pomo-section">
            <label className="buddy-pomo-check-row">
              <input type="checkbox" checked={withSound}
                onChange={(e) => setWithSound(e.target.checked)}
                className="buddy-pomo-chk" />
              <span>종료 시 알림음</span>
            </label>
          </div>

          <div className="buddy-pomo-divider" />

          <div className="buddy-fp-controls">
            <button
              className="buddy-fp-ctrl-btn buddy-fp-ctrl-wide"
              disabled={!selectedId}
              onClick={() => onStart({ memoId: selectedId, memoContent: selectedContent, focusMinutes: focusMin, breakMinutes: breakMin, withSound })}
            >시작</button>
            <button className="buddy-fp-ctrl-btn buddy-fp-ctrl-wide" onClick={onCancel}>취소</button>
          </div>

        </div>
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

function FocusSideSetup({ memos, onStart, onClose }: {
  memos: Memo[];
  onStart: (cfg: PomodoroConfig) => void;
  onClose: () => void;
}) {
  const active = memos.filter((m) => m.status === "진행중");
  const [selectedId, setSelectedId] = useState("");
  const [focusMin,   setFocusMin]   = useState(25);
  const [breakMin,   setBreakMin]   = useState(5);
  const [withSound,  setWithSound]  = useState(false);
  const selectedContent = active.find((m) => m.id === selectedId)?.title ?? "";

  return (
    <aside className="buddy-focus-panel">
      <div className="buddy-fp-title" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>☘ 뽀모도로</span>
        <button className="buddy-fp-close-btn" onClick={onClose}>×</button>
      </div>
      <div className="buddy-fp-body">

      <div className="buddy-fp-setup-section">
        <span className="buddy-pomo-label">오늘의 집중</span>
        {active.length === 0
          ? <p className="buddy-pomo-empty">진행중인 메모가 없어요.</p>
          : (
            <select className="buddy-pomo-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="" disabled>할 일 선택하기</option>
              {active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title.length > 22 ? m.title.slice(0, 22) + "…" : m.title}
                </option>
              ))}
            </select>
          )
        }
      </div>

      <div className="buddy-pomo-divider" />

      <div className="buddy-pomo-time-row">
        <div className="buddy-pomo-time-col">
          <span className="buddy-pomo-label">집중 시간</span>
          <input type="range" min={1} max={60} value={focusMin}
            onChange={(e) => setFocusMin(Number(e.target.value))}
            className="buddy-pomo-slider buddy-pomo-slider-full" />
          <div className="buddy-pomo-val">{focusMin}분</div>
        </div>
        <div className="buddy-pomo-col-divider" />
        <div className="buddy-pomo-time-col">
          <span className="buddy-pomo-label">휴식 시간</span>
          <input type="range" min={1} max={60} value={breakMin}
            onChange={(e) => setBreakMin(Number(e.target.value))}
            className="buddy-pomo-slider buddy-pomo-slider-full" />
          <div className="buddy-pomo-val">{breakMin}분</div>
        </div>
      </div>

      <div className="buddy-pomo-divider" />

      <div className="buddy-fp-setup-section">
        <label className="buddy-pomo-check-row">
          <input type="checkbox" checked={withSound}
            onChange={(e) => setWithSound(e.target.checked)}
            className="buddy-pomo-chk" />
          <span>종료 시 알림음</span>
        </label>
      </div>

      <div className="buddy-pomo-divider" />

      <div className="buddy-fp-controls">
        <button
          className="buddy-fp-ctrl-btn buddy-fp-ctrl-wide"
          disabled={!selectedId}
          onClick={() => onStart({ memoId: selectedId, memoContent: selectedContent, focusMinutes: focusMin, breakMinutes: breakMin, withSound })}
        >시작</button>
        <button className="buddy-fp-ctrl-btn buddy-fp-ctrl-wide" onClick={onClose}>취소</button>
      </div>
      </div>
    </aside>
  );
}

function FocusPanel({ session, currentCheer, onPause, onResume, onComplete, onStartBreak, onClose }: {
  session: PomodoroSession;
  currentCheer: string;
  onPause: () => void; onResume: () => void;
  onComplete: () => void; onStartBreak: () => void;
  onClose: () => void;
}) {
  const totalSec    = session.status === "break" ? session.breakMinutes * 60 : session.focusMinutes * 60;
  const progressPct = Math.min(100, Math.round(((totalSec - session.remainingSeconds) / totalSec) * 100));
  const mins = String(Math.floor(session.remainingSeconds / 60)).padStart(2, "0");
  const secs = String(session.remainingSeconds % 60).padStart(2, "0");
  const isDone  = session.status === "completed";
  const isBreak = session.status === "break";

  return (
    <aside className="buddy-focus-panel">
      <div className="buddy-fp-title" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{isBreak ? "🌿 휴식 중" : "☘ 뽀모도로"}</span>
        <button className="buddy-fp-close-btn" onClick={onClose}>×</button>
      </div>
      <div className="buddy-fp-body">

      <div className="buddy-fp-divider" />

      <div className="buddy-fp-section">
        <div className="buddy-fp-section-label">현재 집중</div>
        <div className="buddy-fp-memo">{session.memoContent}</div>
      </div>

      <div className="buddy-fp-divider" />

      {!isDone ? (
        <>
          <div className="buddy-fp-section">
            <div className="buddy-fp-section-label">{isBreak ? "남은 휴식 시간" : "남은 시간"}</div>
            <div className="buddy-fp-timer">{mins}:{secs}</div>
            <div className="buddy-fp-progress-wrap" style={{ marginTop: 5 }}>
              <div className="buddy-fp-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="buddy-fp-divider" />
        </>
      ) : (
        <>
          <div className="buddy-fp-section">
            <div className="buddy-fp-done">🎉 {session.focusMinutes}분 집중 성공!</div>
          </div>
          <div className="buddy-fp-divider" />
        </>
      )}

      <div className="buddy-fp-cheer-section">
        <span className="buddy-fp-emoji">💬</span>
        <p className="buddy-fp-cheer-text">{isDone ? "수고했어! 잠깐 쉬어도 돼 ☘" : currentCheer}</p>
      </div>

      <div className="buddy-fp-divider" />

      <div className="buddy-fp-controls">
        {session.status === "running" && (
          <button className="buddy-fp-ctrl-btn" onClick={onPause} title="일시정지">⏸</button>
        )}
        {session.status === "paused" && (
          <button className="buddy-fp-ctrl-btn" onClick={onResume} title="재개">▶</button>
        )}
        {(session.status === "running" || session.status === "paused") && (
          <button className="buddy-fp-ctrl-btn" onClick={onComplete} title="종료">■</button>
        )}
        {isDone && (
          <>
            <button className="buddy-fp-ctrl-btn" onClick={onStartBreak} title="휴식 시작">🌿</button>
            <button className="buddy-fp-ctrl-btn" onClick={onComplete} title="닫기">■</button>
          </>
        )}
        {isBreak && (
          <button className="buddy-fp-ctrl-btn" onClick={onComplete} title="휴식 종료">■</button>
        )}
      </div>

      </div>
    </aside>
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

function MemoCard({ memo, onToggleDone, onToggleImportant, onDelete, onDoubleClick }: {
  memo: Memo;
  onToggleDone: () => void;
  onToggleImportant: () => void;
  onDelete: () => void;
  onDoubleClick: () => void;
}) {
  return (
    <div className={`buddy-memo-row${memo.status === "완료" ? " done" : ""}`}>
      <button onClick={onToggleDone} className="buddy-check" title={memo.status === "완료" ? "완료 취소" : "완료하기"}>
        {memo.status === "완료" ? "✓" : ""}
      </button>
      <div className="buddy-memo-text" onClick={onDoubleClick} style={{ cursor: "pointer" }}>
        <p className="buddy-memo-content">{memo.title}</p>
        <p className="buddy-memo-time">{timeLabel(memo.createdAt)}</p>
      </div>
      <button onClick={onToggleImportant} className="buddy-img-btn" title={memo.important ? "중요 해제" : "중요 표시"}>
        <img src="/images/important-after.png" alt="중요" className={memo.important ? "" : "img-off"} />
      </button>
      <button onClick={onToggleDone} className="buddy-img-btn" title={memo.status === "완료" ? "완료 취소" : "완료하기"}>
        <img src="/images/completed-on.png" alt="완료" className={memo.status === "완료" ? "" : "img-off"} />
      </button>
      <a href={memo.url} target="_blank" rel="noopener noreferrer" className="buddy-img-btn" title="Notion에서 열기">
        <img src="/images/move-to-memo.png" alt="이동" />
      </a>
      <button onClick={onDelete} className="buddy-img-btn buddy-del-btn" title="삭제">
        <img src="/images/delete-default.png" alt="삭제" className="del-default" />
        <img src="/images/delete-hover.png" alt="삭제" className="del-hover" />
      </button>
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
  const [focusMode,   setFocusMode]   = useState(false);
  const [showSearch,  setShowSearch]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modal,       setModal]       = useState<ModalData | null>(null);

  // 상세 작성 팝업
  const [isDetailOpen,   setIsDetailOpen]   = useState(false);
  const [detailTitle,    setDetailTitle]    = useState("");
  const [detailContent,  setDetailContent]  = useState("");
  const [detailImportant, setDetailImportant] = useState(false);

  // 상세 보기 팝업
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);

  const [customizeOpen,   setCustomizeOpen]   = useState(false);
  const customizeRef = useRef<HTMLDivElement>(null);

  const [pomodoroOpen,    setPomodoroOpen]    = useState(false);
  const [timerSetupOpen,  setTimerSetupOpen]  = useState(false);
  const [pomodoroSession, setPomodoroSession] = useState<PomodoroSession | null>(null);
  const [splitFocus,      setSplitFocus]      = useState(false);
  const [timerMode,       setTimerMode]       = useState(false);
  const [timerSession,    setTimerSession]    = useState<TimerSession | null>(null);
  const [timerElapsed,    setTimerElapsed]    = useState(0);
  const [totalInvested,   setTotalInvested]   = useState<Record<string, number>>({});
  const [cheerIdx,        setCheerIdx]        = useState(0);

  const [theme,            setThemeState]       = useState<ThemeType>("buddy");
  const setTheme = (t: ThemeType) => { setThemeState(t); try { localStorage.setItem("buddy-theme", t); } catch {} };
  const [notionReady,      setNotionReady]      = useState(false);
  const [needsSetup,       setNeedsSetup]       = useState(false);
  const [showPanelOnMobile, setShowPanelOnMobile] = useState(false);

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

  const quickMemoRef  = useRef<HTMLInputElement>(null);
  const menubarRef    = useRef<HTMLElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const searchRef     = useRef<HTMLInputElement>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const timerElapsedRef   = useRef(0);
  const timerStartRef     = useRef<number | null>(null);
  const timerAccumRef     = useRef(0);
  const allCheersRef      = useRef<string[]>([]);

  /* 메뉴 외부 클릭 시 닫기 */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menubarRef.current && !menubarRef.current.contains(e.target as Node))
        setOpenMenu(null);
      if (customizeRef.current && !customizeRef.current.contains(e.target as Node))
        setCustomizeOpen(false);
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

  /* 뽀모도로 타이머 */
  useEffect(() => {
    if (!pomodoroSession || (pomodoroSession.status !== "running" && pomodoroSession.status !== "break")) return;
    const id = setInterval(() => {
      setPomodoroSession((prev) => {
        if (!prev) return null;
        if (prev.remainingSeconds <= 1) {
          if (prev.withSound && audioCtxRef.current) playBeep(audioCtxRef.current);
          if (prev.status === "break") return null;
          return { ...prev, status: "completed", remainingSeconds: 0 };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pomodoroSession?.status]);

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
        setSplitFocus(true);
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
    const isRunning = pomodoroSession?.status === "running" || timerSession?.status === "running";
    if (!isRunning) return;
    const id = setInterval(() => {
      if (allCheersRef.current.length > 0)
        setCheerIdx(prev => (prev + 1) % allCheersRef.current.length);
    }, 30000);
    return () => clearInterval(id);
  }, [pomodoroSession?.status, timerSession?.status]);

  /* 메모 생성 */
  const createMemo = async (data: {
    title: string;
    content?: string;
    important?: boolean;
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

  const handlePomodoroStart = async (cfg: PomodoroConfig) => {
    if (cfg.withSound) {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new Ctx();
        await audioCtxRef.current.resume();
      } catch {}
    }
    setPomodoroOpen(false);
    setSplitFocus(true); setFocusMode(false); setView("active"); setShowPanelOnMobile(true);
    const msgs = allCheersRef.current;
    const idx = msgs.length > 0 ? Math.floor(Math.random() * msgs.length) : 0;
    setCheerIdx(idx);
    const cheerMessage = msgs.length > 0 ? msgs[idx] : await getRandomCheerMessage();
    setPomodoroSession({ ...cfg, remainingSeconds: cfg.focusMinutes * 60, status: "running", cheerMessage });
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

  const pausePomo    = () => setPomodoroSession((p) => p ? { ...p, status: "paused"  } : null);
  const resumePomo   = () => setPomodoroSession((p) => p ? { ...p, status: "running" } : null);
  const completePomo = () => { setPomodoroSession(null); };
  const activateFocusMode   = () => { setSplitFocus(true); setFocusMode(false); setView("active"); setShowPanelOnMobile(true); };
  const deactivateFocusMode = () => { setSplitFocus(false); setPomodoroSession(null); setShowPanelOnMobile(false); };

  const getTimerElapsed = () => {
    if (timerStartRef.current !== null)
      return timerAccumRef.current + Math.floor((Date.now() - timerStartRef.current) / 1000);
    return timerAccumRef.current;
  };

  const isFocusWindow = splitFocus && timerMode;
  const activateFocusWindow = () => {
    setSplitFocus(true); setTimerMode(true); setFocusMode(false); setView("active"); setShowPanelOnMobile(true);
  };
  const deactivateFocusWindow = () => {
    setSplitFocus(false); setPomodoroSession(null);
    if (timerSession) saveInvestedTime(timerSession.memoId, getTimerElapsed());
    setTimerElapsed(0); timerElapsedRef.current = 0; timerAccumRef.current = 0; timerStartRef.current = null;
    setTimerSession(null); setTimerMode(false); setShowPanelOnMobile(false);
    try { localStorage.removeItem("buddy-timer-session"); } catch {}
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

  const startBreak   = () => setPomodoroSession((p) => p ? {
    ...p, status: "break", remainingSeconds: p.breakMinutes * 60,
    cheerMessage: "잘 쉬고 다시 시작해봐요 🌿",
  } : null);

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

  const effectiveView = (focusMode || splitFocus) ? "active" : view;

  const displayMemos = memos.filter((m) => {
    const inView =
      effectiveView === "active"    ? m.status === "진행중" :
      effectiveView === "completed" ? m.status === "완료" :
      effectiveView === "important" ? m.important : true;
    const inSearch = !showSearch || !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase());
    return inView && inSearch;
  });

  const currentView  = VIEWS[effectiveView];
  const currentCheer = allCheersRef.current.length > 0
    ? allCheersRef.current[cheerIdx % allCheersRef.current.length]
    : (pomodoroSession?.cheerMessage ?? "오늘도 충분히 잘하고 있어요.");

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
    { label: "전체보기",     action: () => act(() => { setFocusMode(false); setView("all"); }) },
    { label: "진행중인 메모", action: () => act(() => { setFocusMode(false); setView("active"); }) },
    { label: "완료된 메모",  action: () => act(() => { setFocusMode(false); setView("completed"); }) },
    { label: "중요한 메모",  action: () => act(() => { setFocusMode(false); setView("important"); }) },
  ];

  const TOOLS_ITEMS: MenuItem[] = [
    { label: isFocusWindow ? "집중 모드 해제" : "집중 모드", action: () => act(() => isFocusWindow ? deactivateFocusWindow() : activateFocusWindow()) },
    { sep: true },
    { label: "뽀모도로", action: () => act(() => setPomodoroOpen(true)) },
    { label: "타이머",   action: () => act(() => setTimerSetupOpen(true)) },
    { sep: true },
    { label: "메모 검색", action: () => act(() => { setShowSearch((p) => !p); setTimeout(() => searchRef.current?.focus(), 50); }) },
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
    { label: "단축키 안내", action: () => act(() => setModal({
      title: "단축키 안내",
      body: (
        <table className="buddy-modal-table">
          <tbody>
            <tr><td>Enter</td><td>메모 저장</td></tr>
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
            <span className="buddy-logo">🐻</span>
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

        {/* 집중 모드 배너 */}
        {(focusMode || splitFocus) && (
          <div className="buddy-focus-banner">
            {pomodoroSession
              ? `☘️ 집중 모드 — ${pomodoroSession.memoContent.length > 28 ? pomodoroSession.memoContent.slice(0, 28) + "…" : pomodoroSession.memoContent}`
              : "☘️ 집중 모드 — 진행중 메모만 표시합니다."
            }
            {focusMode  && <button className="buddy-focus-off" onClick={() => setFocusMode(false)}>해제</button>}
            {splitFocus && <button className="buddy-focus-off" onClick={deactivateFocusMode}>해제</button>}
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
            <div className="buddy-toolbar-dropdown-wrap" ref={customizeRef}>
              <button
                className={`buddy-toolbar-item${customizeOpen ? " open" : ""}`}
                onClick={() => setCustomizeOpen((p) => !p)}
              >
                <img src="/icon-itemshop.png" alt="꾸미기" className="buddy-toolbar-icon" />꾸미기
              </button>
              {customizeOpen && (
                <div className="buddy-toolbar-dropdown">
                  <button
                    className="buddy-toolbar-dropdown-item"
                    onClick={() => { setTheme("buddy"); setCustomizeOpen(false); }}
                  >{theme === "buddy" ? "✓ " : ""}🐻 버디버디</button>
                  <button
                    className="buddy-toolbar-dropdown-item"
                    onClick={() => { setTheme("win98"); setCustomizeOpen(false); }}
                  >{theme === "win98" ? "✓ " : ""}🖥 Win98</button>
                  <div className="buddy-dropdown-sep" />
                  <button
                    className="buddy-toolbar-dropdown-item"
                    onClick={() => {
                      setCustomizeOpen(false);
                      withConfirm("Notion 연동을 초기화할까요? 다시 API 토큰을 입력해야 합니다.", () => {
                        localStorage.removeItem("buddy-notion-token");
                        setNeedsSetup(true);
                      });
                    }}
                  >초기화</button>
                </div>
              )}
            </div>
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
              </div>
              <div>버디메모<br />7.0</div>
            </div>
          </aside>

          {/* 메인 */}
          <main className={`buddy-main${(splitFocus || pomodoroSession || timerMode) ? " buddy-main--split" : ""}${(splitFocus || pomodoroSession || timerMode) && showPanelOnMobile ? " mobile-panel" : ""}`}>
            <div className="buddy-memo-area">

            {/* 모바일: 활성 패널로 전환 버튼 */}
            {(splitFocus || pomodoroSession || timerMode) && (
              <button className="buddy-mobile-to-panel" onClick={() => setShowPanelOnMobile(true)}>
                {timerMode ? "⏱ 타이머 실행 중" : "🍅 집중 타이머 실행 중"}&nbsp;&nbsp;→ 보러가기
              </button>
            )}

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
                  onToggleDone={() => toggleDone(memo.id, memo.status)}
                  onToggleImportant={() => toggleImportant(memo.id, memo.important)}
                  onDelete={() => withConfirm("메모를 삭제하시겠습니까?", () => deleteMemo(memo.id))}
                  onDoubleClick={() => setSelectedMemo(memo)}
                />
              ))}
            </section>

            {/* 입력바 */}
            <footer className="memo-input-bar">
              <input
                ref={quickMemoRef}
                value={quickMemo}
                onChange={(e) => setQuickMemo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && quickMemo.trim()) {
                    e.preventDefault();
                    createMemo({ title: quickMemo });
                    setQuickMemo("");
                  }
                }}
                placeholder="메모를 입력하세요... (Enter 전송)"
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
                📝 등록
              </button>
              <button
                className="win98-button"
                onClick={() => setIsDetailOpen(true)}
              >
                상세 작성 ▼
              </button>
            </footer>
            </div>{/* buddy-memo-area */}

            {(splitFocus || pomodoroSession || timerMode) && (
              <div className="buddy-right-panels">
                <button className="buddy-mobile-back" onClick={() => setShowPanelOnMobile(false)}>
                  ← 메모 목록
                </button>
                {(splitFocus || pomodoroSession) && (
                  splitFocus && !pomodoroSession
                    ? <FocusSideSetup
                        memos={memos}
                        onStart={handlePomodoroStart}
                        onClose={deactivateFocusMode}
                      />
                    : <FocusPanel
                        session={pomodoroSession!}
                        currentCheer={currentCheer}
                        onPause={pausePomo} onResume={resumePomo}
                        onComplete={completePomo} onStartBreak={startBreak}
                        onClose={deactivateFocusMode}
                      />
                )}
                {timerMode && (
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
                )}
              </div>
            )}
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
            {pomodoroSession
              ? <><img src="/icon-active.png" alt="집중" className="buddy-status-icon" />
                  {`☘ ${pomodoroSession.memoContent.length > 14 ? pomodoroSession.memoContent.slice(0, 14) + "…" : pomodoroSession.memoContent}에 집중 중`}</>
              : timerSession
                ? <><img src="/icon-active.png" alt="타이머" className="buddy-status-icon" />
                    {`⏱ ${timerSession.memoContent.length > 14 ? timerSession.memoContent.slice(0, 14) + "…" : timerSession.memoContent} 기록 중`}</>
                : <><img src={`/icon-${effectiveView}.png`} alt={currentView.label} className="buddy-status-icon" />{currentView.status}</>
            }
          </div>
        </footer>

        {/* 파일 가져오기용 히든 input */}
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />

        {/* 뽀모도로 설정 */}
        {pomodoroOpen && (
          <PomodoroSetup
            memos={memos}
            onStart={handlePomodoroStart}
            onCancel={() => setPomodoroOpen(false)}
          />
        )}

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
                <div className="memo-option-row">
                  <label>
                    <input type="checkbox" checked={detailImportant} onChange={(e) => setDetailImportant(e.target.checked)} />
                    중요
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
                      });
                      setDetailTitle(""); setDetailContent("");
                      setDetailImportant(false);
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
                {/* 상태 변경 */}
                <div style={{ display: "flex", gap: 5, marginTop: 12, alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#526733", fontWeight: 700 }}>상태 :</span>
                  {(["진행중", "완료", "보류"] as const).map((s) => (
                    <button
                      key={s}
                      className="win98-button"
                      style={{
                        height: 24, fontSize: 11,
                        background: selectedMemo.status === s ? "#c8e88a" : undefined,
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

        {/* 모달 */}
        {modal && <Modal title={modal.title} body={modal.body} onClose={() => setModal(null)} />}

      </div>
    </div>
  );
}
