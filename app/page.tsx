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

function WindowButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#8da66d] bg-[#f7fbef] text-[11px] leading-none text-[#57723a] shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
      {children}
    </span>
  );
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
    <article
      className="group relative rounded-[10px] border border-[#c4d3a4] bg-[#fffef8] px-3 py-2.5 shadow-[1px_1px_0_#dce9c6]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-dashed border-[#d7e2bd] pb-1.5">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#668348]">
          <span>{memo.hearted ? "✅" : "☘️"}</span>
          <span>{memo.hearted ? "완료된 메모" : "오늘의 메모"}</span>
        </div>
        <span className="text-[11px] text-[#9aa87d]">{timeAgo(memo.createdAt)}</span>
      </div>

      <p className={`whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#4b4b3f] transition-all ${memo.hearted ? "line-through opacity-50" : ""}`}>
        {memo.content}
      </p>

      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          onClick={onHeart}
          title={memo.hearted ? "완료 취소" : "완료하기"}
          className={`rounded-md border px-2 py-1 text-[11px] transition-all ${
            memo.hearted
              ? "border-[#a8c88a] bg-[#f0fae8] text-[#4a8030]"
              : "border-[#cad8ae] bg-[#f8fbef] text-[#7f9661] hover:bg-[#eef6db]"
          }`}
        >
          {memo.hearted ? "✅ 완료됨" : "☐ 완료하기"}
        </button>

        <button
          onClick={onDelete}
          title="삭제"
          className={`rounded-md border border-[#cad8ae] bg-[#f8fbef] px-2 py-1 text-[11px] text-[#8b9a75] transition-all hover:border-[#eaa5b6] hover:bg-[#fff1f5] hover:text-[#d94f77] ${
            hovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          삭제
        </button>
      </div>
    </article>
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

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 112) + "px";
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

  if (!loading && error?.includes("NO_PAGES_ACCESSIBLE")) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#f8f8ef] p-6 text-center">
        <span className="text-5xl">🔐</span>
        <h2 className="text-base font-bold text-[#4b4b3f]">노션 페이지 공유 필요</h2>
        <p className="max-w-xs text-sm leading-relaxed text-[#7c836e]">
          인테그레이션에 최소 1개의 노션 페이지를 공유해야 데이터베이스가 자동
          생성됩니다.
          <br />
          <br />
          노션 페이지 우상단 <strong>···</strong> → <strong>연결 추가</strong>에서
          인테그레이션을 연결 후 아래 버튼을 누르세요.
        </p>
        <button
          onClick={fetchMemos}
          className="rounded-lg border border-[#9bb878] bg-[#dce9c6] px-5 py-2 text-sm font-bold text-[#496b2e] shadow-[1px_1px_0_#9bb878]"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-[#f8f8ef] p-2">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,#f8f8ef,#f8f8ef_27px,#f0f1e6_28px)]" />

      <section className="relative flex h-full w-full max-w-[520px] flex-col overflow-hidden rounded-[18px] border-2 border-[#a8bd83] bg-[#f7faee] shadow-[0_8px_24px_rgba(93,116,61,.18)]">
        <div className="pointer-events-none absolute -right-1 top-10 z-20 rotate-12 text-[34px] drop-shadow-sm">🍓</div>
        <div className="pointer-events-none absolute left-3 top-[96px] z-20 -rotate-12 text-[30px] drop-shadow-sm">🐻</div>

        {/* BuddyBuddy-style title bar */}
        <header className="relative z-10 border-b border-[#9fb87c] bg-gradient-to-b from-[#e5f2cf] via-[#cfe5a8] to-[#b8d48a]">
          <div className="flex h-10 items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <span className="text-[18px]">☘️</span>
              <span className="text-[14px] font-black tracking-[0.08em] text-[#1f2f16]">
                BUDDYMEMO
              </span>
            </div>
            <div className="flex items-center gap-1">
              <WindowButton>－</WindowButton>
              <WindowButton>□</WindowButton>
              <WindowButton>×</WindowButton>
            </div>
          </div>

          <div className="flex h-10 items-center gap-4 border-t border-[#eff8df] bg-[#fbfff4]/75 px-4 text-[13px] font-bold text-[#2f352b]">
            <span>메모(F)</span>
            <span>친구(B)</span>
            <span>기능(A)</span>
            <span>도움말(H)</span>
          </div>
        </header>

        <div className="flex items-center justify-between border-b border-[#d2dfb8] bg-[#fffdf3] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#c6d7a4] bg-[#f6fbe9] text-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
              🙂
            </span>
            <div>
              <div className="text-[17px] font-black text-[#1e1e1a]">
                버디메모 <span className="text-[13px] font-bold text-[#4b6f2a]">{`{접속}`}</span>
              </div>
              <div className="text-[11px] text-[#7f8d68]">💬 오늘도 기록 중...</div>
            </div>
          </div>

          {loading && (
            <span className="rounded-full border border-[#d2dfb8] bg-[#f8fbef] px-2 py-1 text-[11px] text-[#79915d]">
              불러오는 중...
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Icon rail */}
          <aside className="flex w-[54px] shrink-0 flex-col items-center gap-3 border-r border-[#c5d5a6] bg-[#edf5dc] py-4">
            {["👥", "💌", "🏠", "🔎"].map((icon) => (
              <span
                key={icon}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#c0d19d] bg-[#fbfff4] text-[20px] shadow-[1px_1px_0_#d7e7bd]"
              >
                {icon}
              </span>
            ))}
            <div className="mt-auto flex flex-col items-center gap-1 text-[#8aa16b]">
              <span className="text-[12px]">▲</span>
              <span className="text-[12px]">▼</span>
            </div>
          </aside>

          {/* Memo list */}
          <main className="min-w-0 flex-1 overflow-y-auto bg-[#fffdf7] p-3">
            <div className="mb-2 flex items-center justify-between rounded-lg border border-[#d4e0ba] bg-[#f8fbef] px-3 py-2">
              <span className="text-[12px] font-bold text-[#668348]">★ 버디버디 7.0 서비스 자</span>
              <div className="flex gap-1">
                <button
                  onClick={fetchMemos}
                  title="새로고침"
                  className="rounded-md border border-[#bacd97] bg-[#fffef8] px-2 py-1 text-[12px] text-[#5f7a43] hover:bg-[#eef6db]"
                >
                  ↻
                </button>
                <button
                  onClick={() => setShowHeartedOnly((v) => !v)}
                  title={showHeartedOnly ? "전체 보기" : "완료만 보기"}
                  className={`rounded-md border px-2 py-1 text-[12px] ${
                    showHeartedOnly
                      ? "border-[#a8c88a] bg-[#f0fae8] text-[#4a8030]"
                      : "border-[#bacd97] bg-[#fffef8] text-[#5f7a43] hover:bg-[#eef6db]"
                  }`}
                >
                  {showHeartedOnly ? "✅ 완료만" : "☐ 전체"}
                </button>
              </div>
            </div>

            {error && !error.includes("NO_PAGES_ACCESSIBLE") && (
              <div className="mb-2 rounded-lg border border-[#eaa5b6] bg-[#fff1f5] px-3 py-2 text-[12px] text-[#c64a6d]">
                오류: {error}
              </div>
            )}

            {!loading && displayMemos.length === 0 && (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#cbd9ad] bg-[#fffef8] text-center text-[13px] text-[#8b9a75]">
                <span className="text-3xl">{showHeartedOnly ? "💔" : "✍️"}</span>
                <span>
                  {showHeartedOnly ? "저장한 메모가 없어요" : "첫 메모를 남겨보세요"}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {displayMemos.map((memo) => (
                <MemoCard
                  key={memo.id}
                  memo={memo}
                  onHeart={() => toggleHeart(memo.id, memo.hearted)}
                  onDelete={() => deleteMemo(memo.id)}
                />
              ))}
            </div>
          </main>
        </div>

        {/* Footer input */}
        <footer className="border-t border-[#b9cc93] bg-[#eef5dd] p-3">
          <div className="mb-2 flex items-center justify-between rounded-lg border border-[#c9d9ab] bg-[#fffef8] px-3 py-1.5 text-[11px] text-[#73865b]">
            <span>☘️ TODAY 03</span>
            <span>TOTAL {String(memos.length).padStart(4, "0")}</span>
          </div>

          <div className="flex items-end gap-2">
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
              placeholder="메모를 입력하세요... Enter 전송 / Shift+Enter 줄바꿈"
              rows={1}
              className="min-h-[40px] max-h-[112px] flex-1 resize-none rounded-lg border border-[#b8ca96] bg-[#fffef8] px-3 py-2 text-[13px] leading-relaxed text-[#4b4b3f] outline-none placeholder:text-[#9ba984] focus:border-[#7fa65c] focus:ring-2 focus:ring-[#dce9c6]"
            />
            <button
              onClick={sendMemo}
              disabled={!input.trim() || sending}
              className="h-10 whitespace-nowrap rounded-lg border border-[#8fae6d] bg-gradient-to-b from-[#fbfff4] to-[#cfe5a8] px-4 text-[13px] font-black text-[#3f6228] shadow-[1px_1px_0_#9bb878] transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "···" : "쪽지쓰기"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
