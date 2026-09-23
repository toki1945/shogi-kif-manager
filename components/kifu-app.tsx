"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, Bookmark, BookOpen, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleHelp, Cloud, FileText, FolderOpen, LayoutGrid, LoaderCircle, LogOut, Pause, Play, Plus, RotateCw, Search, Settings2, Tags, Trash2, Upload, X } from "lucide-react";
import { decodeKif, parseKif, pieceText, type Kind, type Position } from "@/lib/kif";
import { type Game, LOCAL_KEY, newGame, readLocal, supabase } from "@/lib/storage";

type Modal = "import" | "login" | "help" | "delete" | null;
const handOrder: Kind[] = ["飛", "角", "金", "銀", "桂", "香", "歩"];
const messageOf = (error: unknown) => error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "処理に失敗しました。もう一度お試しください。";

function Board({ position, flipped }: { position: Position; flipped: boolean }) {
  return <div className="board-wrap">
    <div className="file-labels">{(flipped ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [9, 8, 7, 6, 5, 4, 3, 2, 1]).map(n => <span key={n}>{n}</span>)}</div>
    <div className="board" role="img" aria-label="現在の将棋盤">
      <div className="board-grid">{Array.from({ length: 81 }, (_, i) => <div key={i} className="square" />)}</div>
      {position.last && <div className="last-square" style={{ left: `${(flipped ? position.last[0] - 1 : 9 - position.last[0]) * 100 / 9}%`, top: `${(flipped ? 9 - position.last[1] : position.last[1] - 1) * 100 / 9}%` }} />}
      {["3-3", "6-3", "3-6", "6-6"].map(s => <span key={s} className="board-dot" style={{ left: `${Number(s[0]) * 100 / 9}%`, top: `${Number(s[2]) * 100 / 9}%` }} />)}
      {position.pieces.map(piece => <div key={piece.id} className={`piece-cell ${["と", "成香", "成桂", "成銀", "馬", "龍"].includes(piece.kind) ? "promoted" : ""}`} style={{ left: `${(flipped ? piece.x - 1 : 9 - piece.x) * 100 / 9}%`, top: `${(flipped ? 9 - piece.y : piece.y - 1) * 100 / 9}%` }}><span className={`piece ${Boolean(piece.side) !== flipped ? "inverted" : ""}`} aria-label={`${piece.side === 0 ? "先手" : "後手"}${piece.x}${piece.y}${piece.kind}`}>{pieceText(piece.kind)}</span></div>)}
    </div>
    <div className="rank-labels">{(flipped ? [..."九八七六五四三二一"] : [..."一二三四五六七八九"]).map(n => <span key={n}>{n}</span>)}</div>
  </div>;
}

function Player({ name, side, hands, active }: { name: string; side: number; hands: Position["hands"][0]; active: boolean }) {
  return <div className={`player ${active ? "player-active" : ""}`}><span className="player-avatar">{side === 0 ? "☗" : "☖"}</span><div className="player-name"><small>{side === 0 ? "先手 / 下手" : "後手 / 上手"}</small><strong>{name}</strong></div><div className="hand-pieces" aria-label={`${side === 0 ? "先手" : "後手"}の持ち駒`}>{handOrder.some(k => hands[k]) ? handOrder.filter(k => hands[k]).map(k => <span key={k}>{k}{hands[k]! > 1 && <sub>{hands[k]}</sub>}</span>) : <small>持ち駒なし</small>}</div>{active && <span className="turn-dot" title="手番" />}</div>;
}

export default function KifuApp() {
  const [games, setGames] = useState<Game[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [loading, setLoading] = useState(true);
  const [writable, setWritable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [flipped, setFlipped] = useState(false);
  const [tab, setTab] = useState<"moves" | "notes">("moves");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [importText, setImportText] = useState("");
  const [email, setEmail] = useState("");
  const [mailSent, setMailSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const currentMove = useRef<HTMLButtonElement>(null);
  const scope = useRef(0);
  const mutation = useRef(false);
  const game = games.find(g => g.id === selected);
  const parsed = useMemo(() => game ? parseKif(game.kif) : null, [game]);
  const tags = [...new Set(games.flatMap(g => g.tags))].sort();
  const filtered = useMemo(() => games.filter(g => (filter === "all" || (filter === "favorites" ? g.favorite : g.tags.includes(filter.slice(4)))) && `${g.title} ${g.tags.join(" ")} ${g.kif}`.toLowerCase().includes(query.toLowerCase())), [games, filter, query]);
  const showNotice = useCallback((text: string, error = false) => setNotice({ text, error }), []);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setAuthReady(true); });
    supabase.auth.getSession().then(({ data, error }) => { if (error) showNotice(error.message, true); setUser(data.session?.user ?? null); setAuthReady(true); });
    return () => subscription.unsubscribe();
  }, [showNotice]);

  useEffect(() => {
    if (!authReady) return;
    const generation = ++scope.current;
    setLoading(true); setWritable(false); setPlaying(false); setGames([]); setSelected(null);
    async function load() {
      try {
        let loaded: Game[];
        if (user && supabase) {
          const { data, error } = await supabase.from("games").select("id,title,kif,tags,favorite,note,created_at").order("created_at", { ascending: false });
          if (error) throw error;
          loaded = data as Game[];
          loaded.forEach(g => parseKif(g.kif));
        } else loaded = readLocal();
        if (scope.current !== generation) return;
        setGames(loaded); setSelected(loaded[0]?.id ?? null); setWritable(true);
      } catch (error) { if (scope.current === generation) showNotice(messageOf(error), true); }
      finally { if (scope.current === generation) setLoading(false); }
    }
    void load();
    return () => { scope.current++; };
  }, [authReady, user?.id, showNotice]); // Reload only when the account changes.

  useEffect(() => { setStep(0); setPlaying(false); }, [selected]);
  useEffect(() => { setDraftTitle(game?.title ?? ""); setDraftNote(game?.note ?? ""); setDraftTags(game?.tags.join("、") ?? ""); }, [game?.id, game?.title, game?.note, game?.tags]);
  useEffect(() => {
    if (!playing || !parsed) return;
    const timer = setInterval(() => setStep(s => { if (s >= parsed.moves.length) { setPlaying(false); return s; } return s + 1; }), 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, parsed, speed]);
  useEffect(() => { currentMove.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [step, tab]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!parsed || modal || /INPUT|TEXTAREA|SELECT|BUTTON/.test((event.target as HTMLElement).tagName)) return;
      if (["ArrowLeft", "ArrowRight", " ", "Home", "End"].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft") { setPlaying(false); setStep(s => Math.max(0, s - 1)); }
      if (event.key === "ArrowRight") { setPlaying(false); setStep(s => Math.min(parsed.moves.length, s + 1)); }
      if (event.key === "Home") { setPlaying(false); setStep(0); }
      if (event.key === "End") { setPlaying(false); setStep(parsed.moves.length); }
      if (event.key === " ") { if (step === parsed.moves.length) setStep(0); setPlaying(p => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [parsed, modal, step]);
  useEffect(() => { if (modal) { setPlaying(false); dialog.current?.showModal(); } else dialog.current?.close(); }, [modal]);

  async function persist(next: Game[], changed: Game[], deleted?: string) {
    if (!writable || mutation.current) return false;
    mutation.current = true; setBusy(true);
    const generation = scope.current;
    try {
      if (supabase && user) {
        const result = deleted ? await supabase.from("games").delete().eq("id", deleted).eq("user_id", user.id) : await supabase.from("games").upsert(changed.map(g => ({ ...g, user_id: user.id })));
        if (result.error) throw result.error;
      } else localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      if (generation !== scope.current) return false;
      setGames(next);
      return true;
    } catch (error) { showNotice(`保存できませんでした: ${messageOf(error)}`, true); return false; }
    finally { mutation.current = false; setBusy(false); }
  }
  async function updateGame(updated: Game) { return persist(games.map(g => g.id === updated.id ? updated : g), [updated]); }
  async function importGames(items: { text: string; filename?: string }[]) {
    try {
      const added = items.map(({ text, filename }) => newGame(text, filename));
      if (!added.length) return;
      if (await persist([...added, ...games], added)) {
        setSelected(added[0].id); setFilter("all"); setQuery(""); setModal(null); setImportText(""); showNotice(`${added.length}件の棋譜を取り込みました。`);
      }
    } catch (error) { showNotice(messageOf(error), true); }
  }
  async function readFiles(files: FileList | File[]) {
    try {
      const items = await Promise.all(Array.from(files).map(async file => {
        if (!/\.(kif|kifu)$/i.test(file.name)) throw new Error(`${file.name}: .kif または .kifu ファイルを選んでください。`);
        if (file.size > 2_000_000) throw new Error(`${file.name}: 2 MB 以下のファイルを選んでください。`);
        return { text: decodeKif(await file.arrayBuffer()), filename: file.name };
      }));
      await importGames(items);
    } catch (error) { showNotice(messageOf(error), true); }
    if (fileInput.current) fileInput.current.value = "";
  }
  function exportGame() {
    if (!game) return;
    const blob = new Blob(["\uFEFF", game.kif], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${game.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")}.kif`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice("棋譜をエクスポートしました。");
  }
  function jump(value: number) { setPlaying(false); setStep(value); }
  const currentStep = Math.min(step, parsed?.moves.length ?? 0);
  const position = parsed?.positions[currentStep];
  const firstName = parsed?.headers["先手"] || parsed?.headers["下手"] || "先手";
  const secondName = parsed?.headers["後手"] || parsed?.headers["上手"] || "後手";
  const nextSide = parsed ? (currentStep + parsed.firstSide) % 2 : 0;
  const ended = !!parsed?.moves[currentStep - 1]?.end;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="棋譜帖 ホーム"><span className="brand-mark">歩</span><span>棋譜帖<small>KIFU NOTEBOOK</small></span></a>
      <div className="workspace-label">MY WORKSPACE</div>
      <nav aria-label="棋譜の絞り込み">
        <button className={filter === "all" ? "nav-item active" : "nav-item"} onClick={() => setFilter("all")}><LayoutGrid size={18} />すべての棋譜<span>{games.length}</span></button>
        <button className={filter === "favorites" ? "nav-item active" : "nav-item"} onClick={() => setFilter("favorites")}><Bookmark size={18} />ブックマーク<span>{games.filter(g => g.favorite).length}</span></button>
      </nav>
      <div className="workspace-label tag-label">TAGS <Tags size={14} /></div>
      <div className="tag-nav">{tags.map((tag, i) => <button key={tag} className={filter === `tag:${tag}` ? "tag-filter selected" : "tag-filter"} onClick={() => setFilter(`tag:${tag}`)}><i className={`tag-dot color-${i % 4}`} />{tag}<span>{games.filter(g => g.tags.includes(tag)).length}</span></button>)}{!tags.length && <p className="sidebar-hint">棋譜にタグを付けて<br />自分だけのライブラリに。</p>}</div>
      <div className="sidebar-bottom"><div className="little-quote"><span>一局を、<br />次の一手へ。</span><p>振り返るたび、将棋は深くなる。</p><span className="quote-piece">桂</span></div><button className="help-button" onClick={() => setModal("help")}><CircleHelp size={17} />使い方・保存について<ArrowUpRight size={14} /></button><div className="profile"><span className="profile-avatar">{user ? user.email?.[0]?.toUpperCase() : "棋"}</span><div><strong>{user ? user.email : "ゲストの書斎"}</strong><small>{user ? "クラウドに保存" : "このブラウザーに保存"}</small></div><button className="icon-button" aria-label={user ? "ログアウト" : "ログイン"} onClick={async () => { if (user && supabase) { const { error } = await supabase.auth.signOut(); if (error) showNotice(error.message, true); } else setModal("login"); }} disabled={busy}>{user ? <LogOut size={17} /> : <Cloud size={18} />}</button></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumb">書斎 <ChevronRight size={13} /><span>棋譜ライブラリ</span></div><button className="cloud-status" onClick={() => setModal(user ? "help" : "login")}><span className="status-dot" />{user ? "クラウド保存" : "ローカル保存"}<Cloud size={15} /></button></header>
      <section className="page-heading"><div><div className="eyebrow">YOUR SHOGI COLLECTION</div><h1>棋譜ライブラリ<span>棋譜帖</span></h1><p>一手のひらめきも、一局の学びも。ここに残そう。</p></div><button className="button primary" onClick={() => setModal("import")} disabled={busy || !writable}><Plus size={18} />棋譜を取り込む</button></section>
      <section className="library-bar"><div className="collection-tabs"><button className={filter !== "favorites" ? "selected" : ""} onClick={() => setFilter("all")}><FolderOpen size={17} />{filter.startsWith("tag:") ? filter.slice(4) : "すべての棋譜"}<span>{filter === "all" ? games.length : filtered.length}</span></button><button className={filter === "favorites" ? "selected" : ""} onClick={() => setFilter("favorites")}><Bookmark size={16} /><span className="bookmark-label">ブックマーク</span></button></div><label className="search"><Search size={17} /><input placeholder="棋譜・対局者・タグを検索" aria-label="棋譜を検索" value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="検索をクリア" onClick={() => setQuery("")}><X size={14} /></button>}</label></section>

      <div className="content-grid">
        <section className="game-list" aria-label="棋譜一覧"><div className="list-heading"><span>{filtered.length} 件の棋譜</span><span>追加した順</span></div>{loading ? <div className="empty"><LoaderCircle className="spin" /><p>棋譜を読み込み中…</p></div> : filtered.length ? filtered.map(g => {
          const info = parseKif(g.kif); const count = info.moves.filter(m => !m.end).length;
          return <article key={g.id} className={`game-card ${selected === g.id ? "is-selected" : ""}`}><button className="game-select" onClick={() => { setSelected(g.id); setTab("moves"); }} aria-label={`${g.title}を開く`} aria-pressed={selected === g.id}><div className="card-top"><span className="kif-badge"><FileText size={12} />KIF</span><span>{(info.headers["開始日時"] || g.created_at).slice(0, 10).replaceAll("-", ".").replaceAll("/", ".")}</span></div><h3>{g.title}</h3><div className="versus"><span>{info.headers["先手"] || info.headers["下手"] || "先手"}</span><small>vs</small><span>{info.headers["後手"] || info.headers["上手"] || "後手"}</span></div><div className="card-tags">{g.tags.length ? g.tags.map(t => <span key={t}>{t}</span>) : <span className="untagged">タグなし</span>}</div><div className="card-bottom"><span>{count} 手 <i />{info.moves.at(-1)?.end || "棋譜"}</span><ArrowUpRight size={14} /></div></button><button className={`card-bookmark ${g.favorite ? "marked" : ""}`} aria-label={g.favorite ? "ブックマークを解除" : "ブックマークする"} disabled={busy || !writable} onClick={() => void updateGame({ ...g, favorite: !g.favorite })}><Bookmark size={17} fill={g.favorite ? "currentColor" : "none"} /></button></article>;
        }) : <div className="empty"><BookOpen size={30} /><h3>{query || filter !== "all" ? "棋譜が見つかりません" : "最初の一局を残そう"}</h3><p>{query || filter !== "all" ? "検索条件を変えてお試しください。" : "KIF ファイルを取り込んで、振り返りを始めましょう。"}</p><button className="button secondary" disabled={!writable} onClick={() => query || filter !== "all" ? (setQuery(""), setFilter("all")) : setModal("import")}>{query || filter !== "all" ? "条件をリセット" : "棋譜を取り込む"}</button></div>}<div className="list-footer"><BookOpen size={14} />あなたの学びが、ここに積み重なる。</div></section>

        {game && parsed && position ? <section className="viewer" aria-label="棋譜ビューアー"><div className="viewer-heading"><div><div className="viewer-eyebrow">KIFU VIEWER <span>{parsed.headers["手合割"] || "平手"}</span></div><h2>{game.title}</h2></div><div className="viewer-actions"><button className={`icon-button ${game.favorite ? "marked" : ""}`} title="ブックマーク" aria-label="開いている棋譜のブックマークを切り替え" disabled={busy || !writable} onClick={() => void updateGame({ ...game, favorite: !game.favorite })}><Bookmark size={18} fill={game.favorite ? "currentColor" : "none"} /></button><button className="button export-button" onClick={exportGame}><ArrowDownToLine size={16} /><span>エクスポート</span></button><button className="icon-button delete-button" aria-label="棋譜を削除" disabled={busy || !writable} onClick={() => setModal("delete")}><Trash2 size={16} /></button></div></div>
          <div className="viewer-body"><div className="board-panel"><div className="board-toolbar"><span><span className="live-dot" />棋譜再生</span><button onClick={() => setFlipped(f => !f)}><RotateCw size={14} />盤面を反転</button></div><div className="board-area"><Player name={flipped ? firstName : secondName} side={flipped ? 0 : 1} hands={position.hands[flipped ? 0 : 1]} active={!ended && nextSide === (flipped ? 0 : 1)} /><Board position={position} flipped={flipped} /><Player name={flipped ? secondName : firstName} side={flipped ? 1 : 0} hands={position.hands[flipped ? 1 : 0]} active={!ended && nextSide === (flipped ? 1 : 0)} /></div><div className="playback"><div className="progress-label"><span>{currentStep === 0 ? "開始局面" : `${currentStep}手目　${parsed.moves[currentStep - 1].label}`}</span><span><b>{currentStep}</b> / {parsed.moves.length}</span></div><input type="range" aria-label="再生位置" min={0} max={parsed.moves.length} value={currentStep} onChange={e => jump(Number(e.target.value))} style={{ "--progress": `${currentStep / parsed.moves.length * 100}%` } as React.CSSProperties} /><div className="playback-buttons"><select aria-label="再生速度" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option></select><div className="transport"><button aria-label="最初に戻る" disabled={currentStep === 0} onClick={() => jump(0)}><ChevronsLeft size={20} /></button><button aria-label="一手戻る" disabled={currentStep === 0} onClick={() => jump(currentStep - 1)}><ChevronLeft size={22} /></button><button className="play-button" aria-label={playing ? "一時停止" : "再生"} onClick={() => { if (currentStep >= parsed.moves.length) setStep(0); setPlaying(p => !p); }}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><button aria-label="一手進む" disabled={currentStep === parsed.moves.length} onClick={() => jump(currentStep + 1)}><ChevronRight size={22} /></button><button aria-label="最後に進む" disabled={currentStep === parsed.moves.length} onClick={() => jump(parsed.moves.length)}><ChevronsRight size={20} /></button></div><span className="keyboard-hint">← →</span></div></div></div>
          <aside className="moves-panel"><div className="detail-tabs"><button className={tab === "moves" ? "active" : ""} onClick={() => setTab("moves")}>指し手<span>{parsed.moves.length}</span></button><button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>メモ・タグ</button></div>{tab === "moves" ? <><div className="move-columns"><span>手数</span><span>指し手</span><span>手番</span></div><div className="move-list"><button className={`move-row ${currentStep === 0 ? "current" : ""}`} onClick={() => jump(0)} ref={currentStep === 0 ? currentMove : undefined}><span>—</span><strong>開始局面</strong><span /></button>{parsed.moves.map((move, i) => <button key={move.number} className={`move-row ${currentStep === i + 1 ? "current" : ""}`} onClick={() => jump(i + 1)} ref={currentStep === i + 1 ? currentMove : undefined}><span>{move.number.toString().padStart(2, "0")}</span><strong>{move.label}{move.comment && <i className="comment-dot" />}</strong><span>{(i + parsed.firstSide) % 2 === 0 ? "☗" : "☖"}</span></button>)}</div><div className="move-note"><FileText size={15} /><p>{parsed.moves[currentStep - 1]?.comment || (parsed.hasVariations ? "本譜を表示しています。変化手順は元の KIF に保持されます。" : "指し手を選ぶと、その局面に移動します。")}</p></div></> : <form className="notes-form" onSubmit={async e => { e.preventDefault(); if (await updateGame({ ...game, title: draftTitle.trim(), note: draftNote, tags: [...new Set(draftTags.split(/[,、]/).map(t => t.trim()).filter(Boolean))] })) showNotice("メモとタグを保存しました。"); }}><label>棋譜のタイトル<input required maxLength={200} value={draftTitle} onChange={e => setDraftTitle(e.target.value)} /></label><label>タグ<input placeholder="横歩取り、研究" value={draftTags} onChange={e => setDraftTags(e.target.value)} /><small>「、」またはカンマで区切って入力</small></label><label>振り返りメモ<textarea rows={8} placeholder="気になった一手や、次に試したいこと…" value={draftNote} onChange={e => setDraftNote(e.target.value)} /></label><button className="button primary" disabled={busy || !writable || !draftTitle.trim()}><Check size={16} />変更を保存</button></form>}</aside></div><div className="viewer-footer"><span><FileText size={13} />{parsed.headers["棋戦"] || "対局記録"}</span><span>{parsed.hasVariations ? "本譜のみ表示" : "← → キーで一手ずつ、スペースで再生"}</span></div>
        </section> : <section className="viewer viewer-empty"><div className="empty-emblem">歩</div><h2>一局と、向き合う時間。</h2><p>棋譜を選択すると、ここに将棋盤が表示されます。</p></section>}
      </div><footer className="page-footer"><span>棋譜帖 <i /> 大切な一局を、いつでも手元に。</span><span>一手ずつ、強くなる。</span></footer>
    </main>

    {notice && <div className={`toast ${notice.error ? "error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.error ? <CircleHelp size={18} /> : <Check size={18} />}<span>{notice.text}</span><button aria-label="通知を閉じる" onClick={() => setNotice(null)}><X size={16} /></button></div>}
    <dialog ref={dialog} className="modal" onCancel={() => setModal(null)} onClick={e => { if (e.target === e.currentTarget && !busy) setModal(null); }} aria-labelledby="modal-title"><div className="modal-content"><button className="modal-close icon-button" aria-label="閉じる" disabled={busy} onClick={() => setModal(null)}><X size={20} /></button>
      {modal === "import" && <><div className="modal-icon"><Upload size={24} /></div><h2 id="modal-title">新しい一局を、棋譜帖に。</h2><p>KIF ファイルを選ぶか、棋譜を貼り付けてください。</p><button className="drop-zone" disabled={busy} onClick={() => fileInput.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) void readFiles(e.dataTransfer.files); }}><Upload size={28} /><strong>ファイルを選択、またはドロップ</strong><span>.kif / .kifu · UTF-8 / Shift_JIS · 1件 2 MB まで</span></button><input type="file" ref={fileInput} hidden multiple accept=".kif,.kifu" onChange={e => { if (e.target.files) void readFiles(e.target.files); }} /><div className="or-divider">または棋譜を貼り付け</div><textarea className="kif-input" aria-label="KIF テキスト" placeholder={"先手：\n後手：\n手数----指手---------消費時間--\n1 ７六歩(77)\n2 ３四歩(33)"} value={importText} onChange={e => setImportText(e.target.value)} /><button className="button primary full-width" disabled={!importText.trim() || busy} onClick={() => void importGames([{ text: importText }])}>{busy ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}棋譜を取り込む</button></>}
      {modal === "login" && <><div className="modal-icon"><Cloud size={25} /></div><h2 id="modal-title">あなたの棋譜を、どこからでも。</h2>{supabase ? <><p>メールに届くリンクからログインできます。</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }); setBusy(false); if (error) showNotice(error.message, true); else setMailSent(true); }}><label className="form-label">メールアドレス<input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></label><button className="button primary full-width" disabled={busy}>{busy ? "送信中…" : "ログインリンクを送信"}</button></form>{mailSent && <div className="success-note">メールを送信しました。このブラウザーでメール内のリンクを開いてください。</div>}<p className="small-print">ログイン後、ブラウザーの棋譜は「使い方・保存について」からクラウドにコピーできます。</p></> : <><p>現在はこのブラウザーに棋譜を保存しています。<br />ログインを使うには Supabase の接続設定が必要です。</p><div className="setup-note">README の手順に沿って環境変数とデータベースを設定すると、メール認証とクラウド保存が有効になります。</div><button className="button secondary full-width" onClick={() => setModal(null)}>ブラウザー保存で始める</button></>}</>}
      {modal === "help" && <><div className="modal-icon"><BookOpen size={25} /></div><h2 id="modal-title">棋譜帖の使い方</h2><div className="help-sections"><section><h3>取り込む、並べる、振り返る。</h3><p>KIF を取り込み、再生ボタンや指し手一覧から局面を確認。「メモ・タグ」で学びを残し、ブックマークで大切な一局をまとめられます。</p></section><section><h3>キーボードで快適に</h3><p><kbd>←</kbd> <kbd>→</kbd> 一手ずつ移動　<kbd>Space</kbd> 再生・停止<br /><kbd>Home</kbd> 開始局面　<kbd>End</kbd> 最終局面</p></section><section><h3>{user ? "クラウドに保存しています" : "このブラウザーに保存しています"}</h3><p>{user ? "Supabase のアカウントごとに棋譜を保存します。未ログイン時の棋譜は自動では移動しません。" : "ブラウザーのデータを消すと棋譜も削除されます。大切な棋譜はエクスポートして保管してください。"}</p></section><section><h3>対応する棋譜</h3><p>移動元が記載された KIF（UTF-8 / Shift_JIS）。平手と主要な駒落ちに対応。変化手順は本譜のみ再生し、エクスポートでは元の棋譜・コメントを保持します。局面図開始・KI2 は未対応です。メモとタグはアプリ内に保存されます。</p></section></div>{user && <button className="button primary full-width" disabled={busy || !writable} onClick={async () => { try { const local = readLocal().filter(g => !games.some(existing => existing.id === g.id)); if (!local.length) { showNotice("コピーする棋譜はありません。"); return; } if (await persist([...local, ...games], local)) showNotice(`${local.length}件をクラウドにコピーしました。`); } catch (error) { showNotice(messageOf(error), true); } }}><Cloud size={17} />ブラウザーの棋譜をクラウドにコピー</button>}</>}
      {modal === "delete" && <><div className="modal-icon danger"><Trash2 size={24} /></div><h2 id="modal-title">この棋譜を削除しますか？</h2><p>「{game?.title}」とメモ・タグを削除します。この操作は元に戻せません。</p><div className="modal-buttons"><button className="button secondary" onClick={() => setModal(null)} disabled={busy}>キャンセル</button><button className="button danger-button" disabled={busy} onClick={async () => { if (!game) return; const next = games.filter(g => g.id !== game.id); if (await persist(next, [], game.id)) { setSelected(next[0]?.id ?? null); setModal(null); showNotice("棋譜を削除しました。"); } }}>削除する</button></div></>}
    </div></dialog>
  </div>;
}
