"use client";

import { useState } from "react";

type DbMode = "auto" | "existing";

const S = {
  wrap: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f0f4e0", padding: "20px", fontFamily: "inherit",
  } as React.CSSProperties,
  card: {
    width: "100%", maxWidth: 480,
    background: "#fff",
    border: "2px solid #b8c49a",
    borderRadius: 2,
    boxShadow: "3px 3px 0 #8fac61",
    overflow: "hidden",
  } as React.CSSProperties,
  header: {
    background: "#c8dfa0", borderBottom: "2px solid #b8c49a",
    padding: "12px 18px", display: "flex", alignItems: "center", gap: 8,
  } as React.CSSProperties,
  body: { padding: "20px" } as React.CSSProperties,
  label: { display: "block", fontSize: 11, fontWeight: 900, color: "#3a5a1e", marginBottom: 4 } as React.CSSProperties,
  input: {
    width: "100%", padding: "7px 9px", fontSize: 12,
    border: "1px solid #b8c49a", background: "#f9fbf0",
    outline: "none", boxSizing: "border-box" as const,
  } as React.CSSProperties,
  hint: { fontSize: 10, color: "#7a9050", margin: "4px 0 0", lineHeight: 1.5 } as React.CSSProperties,
  error: { fontSize: 11, color: "#b03020", margin: "0 0 12px", whiteSpace: "pre-wrap" as const, lineHeight: 1.5 } as React.CSSProperties,
  btn: (active: boolean): React.CSSProperties => ({
    width: "100%", padding: "8px 0", fontSize: 13, fontWeight: 900,
    color: "#fff", background: active ? "#5a8a30" : "#a0b880",
    border: "none", cursor: active ? "pointer" : "not-allowed",
    fontFamily: "inherit",
  }),
  stepBar: {
    display: "flex", alignItems: "center", gap: 0, marginBottom: 18,
  } as React.CSSProperties,
};

export default function SetupPage() {
  const [step, setStep]       = useState<1 | 2>(1);
  const [token, setToken]     = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [dbMode, setDbMode]   = useState<DbMode>("auto");
  const [dbUrl, setDbUrl]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [copied, setCopied]   = useState(false);

  const STEP_LABELS = ["① 노션 연결", "② DB 설정"];

  const handleNext = async () => {
    const t = token.trim();
    if (!t) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-notion-token": t },
        body: JSON.stringify({ pageUrl: pageUrl.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          INVALID_TOKEN:       "API 토큰이 유효하지 않아요.",
          INVALID_PAGE_URL:    "올바른 Notion 페이지 URL을 입력해주세요.",
          PAGE_NOT_ACCESSIBLE: "해당 페이지에 접근할 수 없어요.\n인테그레이션이 연결되어 있는지 확인해주세요.",
        };
        throw new Error(msgs[data.error] || "연결에 실패했어요.");
      }
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (dbMode === "existing" && !dbUrl.trim()) {
      setError("연결할 DB URL을 입력해주세요."); return;
    }
    setLoading(true); setError(""); setEmbedUrl("");
    try {
      const res = await fetch("/api/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          pageUrl: pageUrl.trim() || undefined,
          dbMode,
          dbUrl: dbMode === "existing" ? dbUrl.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          INVALID_DB_URL:    "올바른 Notion DB URL을 입력해주세요.",
          DB_NOT_ACCESSIBLE: "해당 DB에 접근할 수 없어요.\n인테그레이션이 연결되어 있는지 확인해주세요.",
          INVALID_TOKEN:     "API 토큰이 유효하지 않아요.",
        };
        throw new Error(msgs[data.error] || "오류가 발생했어요. 다시 시도해주세요.");
      }
      setEmbedUrl(`${window.location.origin}/?t=${data.encrypted}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.getElementById("embed-url-input") as HTMLInputElement;
      el?.select();
    }
  };

  const reset = () => {
    setStep(1); setToken(""); setPageUrl(""); setDbMode("auto"); setDbUrl("");
    setError(""); setEmbedUrl(""); setLoading(false);
  };

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        {/* 헤더 */}
        <div style={S.header}>
          <span style={{ fontSize: 22 }}>🐻</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#2d4a1a" }}>BuddyMemo 위젯 설정</div>
            <div style={{ fontSize: 11, color: "#526733" }}>Notion 임베드 URL 발급</div>
          </div>
        </div>

        <div style={S.body}>
          {!embedUrl ? (
            <>
              {/* 스텝 표시 */}
              <div style={S.stepBar}>
                {STEP_LABELS.map((label, i) => {
                  const n = (i + 1) as 1 | 2;
                  const active = step === n;
                  const done   = step > n;
                  return (
                    <div key={n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <div style={{
                        flex: 1, padding: "5px 10px", fontSize: 11, fontWeight: 900, textAlign: "center",
                        background: active ? "#5a8a30" : done ? "#c8dfa0" : "#eef3db",
                        color: active ? "#fff" : done ? "#3a5a1e" : "#8aaa60",
                        borderTop: "1px solid #b8c49a", borderBottom: "1px solid #b8c49a",
                        borderLeft: i === 0 ? "1px solid #b8c49a" : "none",
                        borderRight: i === STEP_LABELS.length - 1 ? "1px solid #b8c49a" : "none",
                      }}>
                        {done ? `✓ ${label}` : label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Step 1 ── */}
              {step === 1 && (
                <>
                  <p style={{ fontSize: 12, color: "#526733", margin: "0 0 16px", lineHeight: 1.7 }}>
                    Notion API 토큰과 메모를 저장할 페이지를 연결합니다.
                  </p>

                  <div style={{ marginBottom: 14 }}>
                    <label style={S.label}>Notion API 토큰 *</label>
                    <input
                      type="password"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      placeholder="secret_xxxxxxxxxxxx"
                      autoFocus
                      style={S.input}
                    />
                    <p style={S.hint}>notion.so → 설정 → 연결 → 통합 만들기에서 발급</p>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={S.label}>
                      Notion 페이지 URL <span style={{ fontWeight: 400, color: "#8aaa60" }}>(권장)</span>
                    </label>
                    <input
                      type="text"
                      value={pageUrl}
                      onChange={e => setPageUrl(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleNext()}
                      placeholder="https://www.notion.so/..."
                      style={S.input}
                    />
                    <p style={S.hint}>메모를 저장할 페이지 · 해당 페이지에 인테그레이션이 연결되어 있어야 합니다</p>
                  </div>

                  {error && <p style={S.error}>{error}</p>}

                  <button
                    onClick={handleNext}
                    disabled={!token.trim() || loading}
                    style={S.btn(!!token.trim() && !loading)}
                  >
                    {loading ? "확인 중..." : "다음 →"}
                  </button>
                </>
              )}

              {/* ── Step 2 ── */}
              {step === 2 && (
                <>
                  <p style={{ fontSize: 12, color: "#526733", margin: "0 0 16px", lineHeight: 1.7 }}>
                    메모 데이터베이스 설정 방식을 선택해주세요.
                  </p>

                  {/* 자동 생성 */}
                  <label style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "12px",
                    border: `2px solid ${dbMode === "auto" ? "#5a8a30" : "#b8c49a"}`,
                    background: dbMode === "auto" ? "#f0f8e0" : "#f9fbf0",
                    cursor: "pointer", marginBottom: 10,
                  }}>
                    <input
                      type="radio"
                      name="dbMode"
                      value="auto"
                      checked={dbMode === "auto"}
                      onChange={() => setDbMode("auto")}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 12, color: "#2d4a1a", marginBottom: 3 }}>
                        자동 생성
                      </div>
                      <div style={{ fontSize: 11, color: "#526733", lineHeight: 1.5 }}>
                        "Memo OS" DB를 자동으로 만들어드립니다.<br />
                        처음 사용하거나 새로 시작할 때 권장합니다.
                      </div>
                    </div>
                  </label>

                  {/* 기존 DB 연결 */}
                  <label style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "12px",
                    border: `2px solid ${dbMode === "existing" ? "#5a8a30" : "#b8c49a"}`,
                    background: dbMode === "existing" ? "#f0f8e0" : "#f9fbf0",
                    cursor: "pointer", marginBottom: dbMode === "existing" ? 0 : 16,
                  }}>
                    <input
                      type="radio"
                      name="dbMode"
                      value="existing"
                      checked={dbMode === "existing"}
                      onChange={() => setDbMode("existing")}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <div style={{ width: "100%" }}>
                      <div style={{ fontWeight: 900, fontSize: 12, color: "#2d4a1a", marginBottom: 3 }}>
                        기존 DB 연결
                      </div>
                      <div style={{ fontSize: 11, color: "#526733", lineHeight: 1.5 }}>
                        이미 만들어진 Notion DB를 연결합니다.<br />
                        인테그레이션이 해당 DB에 연결되어 있어야 합니다.
                      </div>
                    </div>
                  </label>

                  {/* DB URL 입력 (기존 연결 선택 시) */}
                  {dbMode === "existing" && (
                    <div style={{
                      padding: "12px", marginBottom: 16,
                      border: "2px solid #5a8a30", borderTop: "none",
                      background: "#f0f8e0",
                    }}>
                      <label style={S.label}>Notion DB URL *</label>
                      <input
                        type="text"
                        value={dbUrl}
                        onChange={e => setDbUrl(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleGenerate()}
                        placeholder="https://www.notion.so/..."
                        autoFocus
                        style={S.input}
                      />
                      <p style={S.hint}>연결할 DB 페이지의 URL을 붙여넣으세요</p>
                    </div>
                  )}

                  {error && <p style={S.error}>{error}</p>}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { setStep(1); setError(""); }}
                      style={{
                        padding: "8px 0", fontSize: 12, fontWeight: 900,
                        color: "#526733", background: "#eef3db",
                        border: "1px solid #b8c49a", cursor: "pointer",
                        fontFamily: "inherit", width: 80, flexShrink: 0,
                      }}
                    >
                      ← 이전
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={loading || (dbMode === "existing" && !dbUrl.trim())}
                      style={{
                        ...S.btn(!(loading || (dbMode === "existing" && !dbUrl.trim()))),
                        width: "auto", flex: 1,
                      }}
                    >
                      {loading ? "처리 중..." : "URL 발급하기"}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            /* ── 완료 ── */
            <>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>✅</div>
                <div style={{ fontWeight: 900, fontSize: 15, color: "#2d4a1a" }}>발급 완료!</div>
                <p style={{ fontSize: 12, color: "#526733", margin: "6px 0 0", lineHeight: 1.6 }}>
                  아래 URL을 복사해서 Notion 페이지에<br />
                  <strong>/embed</strong> 블록으로 삽입하세요.
                </p>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input
                  id="embed-url-input"
                  type="text"
                  readOnly
                  value={embedUrl}
                  style={{
                    flex: 1, padding: "7px 9px", fontSize: 11,
                    border: "1px solid #b8c49a", background: "#f0f4e0",
                    outline: "none", wordBreak: "break-all",
                    fontFamily: "monospace",
                  }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopy}
                  style={{
                    padding: "0 14px", fontSize: 12, fontWeight: 900,
                    background: copied ? "#5a8a30" : "#d8eda4",
                    color: copied ? "#fff" : "#2d4a1a",
                    border: "1px solid #b8c49a", cursor: "pointer",
                    fontFamily: "inherit", flexShrink: 0,
                  }}
                >
                  {copied ? "복사됨 ✓" : "복사"}
                </button>
              </div>

              <div style={{
                background: "#fff9e0", border: "1px solid #e0cc80",
                padding: "8px 10px", fontSize: 11, color: "#7a6020",
                lineHeight: 1.6, marginBottom: 14,
              }}>
                ⚠️ 이 URL을 안전하게 보관하세요. 분실 시 아래 버튼으로 재발급 가능합니다.
              </div>

              <button
                onClick={reset}
                style={{
                  width: "100%", padding: "7px 0", fontSize: 12, fontWeight: 900,
                  color: "#526733", background: "#eef3db",
                  border: "1px solid #b8c49a", cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                다시 설정하기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
