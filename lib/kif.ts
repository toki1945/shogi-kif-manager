export type Side = 0 | 1;
export type Kind = "歩" | "香" | "桂" | "銀" | "金" | "角" | "飛" | "玉" | "と" | "成香" | "成桂" | "成銀" | "馬" | "龍";
export type Piece = { id: string; kind: Kind; side: Side; x: number; y: number };
export type Move = { number: number; label: string; to?: [number, number]; from?: [number, number]; kind?: Kind; promote?: boolean; drop?: boolean; end?: string; comment: string };
export type Position = { pieces: Piece[]; hands: [Partial<Record<Kind, number>>, Partial<Record<Kind, number>>]; last?: [number, number] };
export type ParsedKif = { headers: Record<string, string>; moves: Move[]; positions: Position[]; firstSide: Side; hasVariations: boolean };
const promoted: Partial<Record<Kind, Kind>> = { 歩: "と", 香: "成香", 桂: "成桂", 銀: "成銀", 角: "馬", 飛: "龍" };
const demoted: Partial<Record<Kind, Kind>> = { と: "歩", 成香: "香", 成桂: "桂", 成銀: "銀", 馬: "角", 龍: "飛" };
const terminals = ["投了", "中断", "千日手", "持将棋", "詰み", "切れ負け", "反則勝ち", "反則負け", "入玉勝ち", "不戦勝", "不戦敗"];

export function initialPosition(handicap = "平手"): Position {
  const pieces: Piece[] = [];
  const back: Kind[] = ["香", "桂", "銀", "金", "玉", "金", "銀", "桂", "香"];
  for (const side of [0, 1] as Side[]) {
    for (let x = 1; x <= 9; x++) {
      pieces.push({ id: `${side}-${x}-back`, kind: back[x - 1], side, x, y: side === 0 ? 9 : 1 });
      pieces.push({ id: `${side}-${x}-pawn`, kind: "歩", side, x, y: side === 0 ? 7 : 3 });
    }
    pieces.push({ id: `${side}-rook`, kind: "飛", side, x: side === 0 ? 2 : 8, y: side === 0 ? 8 : 2 });
    pieces.push({ id: `${side}-bishop`, kind: "角", side, x: side === 0 ? 8 : 2, y: side === 0 ? 8 : 2 });
  }
  const removals: Record<string, [number, number][]> = {
    平手: [], 香落ち: [[1, 1]], 右香落ち: [[9, 1]], 角落ち: [[2, 2]], 飛車落ち: [[8, 2]],
    飛香落ち: [[8, 2], [1, 1]], 二枚落ち: [[8, 2], [2, 2]],
    四枚落ち: [[8, 2], [2, 2], [1, 1], [9, 1]],
    六枚落ち: [[8, 2], [2, 2], [1, 1], [9, 1], [2, 1], [8, 1]],
    八枚落ち: [[8, 2], [2, 2], [1, 1], [9, 1], [2, 1], [8, 1], [3, 1], [7, 1]],
    十枚落ち: [[8, 2], [2, 2], [1, 1], [9, 1], [2, 1], [8, 1], [3, 1], [7, 1], [4, 1], [6, 1]],
  };
  if (!(handicap in removals)) throw new Error(`手合割「${handicap}」には対応していません。`);
  return { pieces: pieces.filter(p => !removals[handicap].some(([x, y]) => p.side === 1 && p.x === x && p.y === y)), hands: [{}, {}] };
}

function advance(previous: Position, move: Move, side: Side): Position {
  const next: Position = { pieces: previous.pieces.map(p => ({ ...p })), hands: [{ ...previous.hands[0] }, { ...previous.hands[1] }], last: previous.last };
  if (move.end) return next;
  const [x, y] = move.to!;
  let piece: Piece | undefined;
  if (move.drop) {
    const count = next.hands[side][move.kind!] ?? 0;
    if (!count) throw new Error(`${move.number}手目: 持ち駒に${move.kind}がありません。`);
    next.hands[side][move.kind!] = count - 1;
    piece = { id: `drop-${move.number}`, kind: move.kind!, side, x, y };
  } else {
    piece = next.pieces.find(p => p.x === move.from![0] && p.y === move.from![1]);
    if (!piece || piece.side !== side || piece.kind !== move.kind) throw new Error(`${move.number}手目: 移動元の駒と棋譜が一致しません。`);
  }
  const target = next.pieces.find(p => p.x === x && p.y === y);
  if (target) {
    if (target.side === side || move.drop || target.kind === "玉") throw new Error(`${move.number}手目: 移動先が正しくありません。`);
    const captured = demoted[target.kind] ?? target.kind;
    next.hands[side][captured] = (next.hands[side][captured] ?? 0) + 1;
    next.pieces = next.pieces.filter(p => p.id !== target.id);
  }
  if (move.promote) {
    const promotion = promoted[piece.kind];
    if (!promotion) throw new Error(`${move.number}手目: この駒は成れません。`);
    piece.kind = promotion;
  }
  piece.x = x;
  piece.y = y;
  if (move.drop) next.pieces.push(piece);
  next.last = [x, y];
  return next;
}

export function parseKif(raw: string): ParsedKif {
  if (!raw.trim()) throw new Error("棋譜の内容が空です。");
  if (raw.length > 2_000_000) throw new Error("棋譜は 2 MB 以下にしてください。");
  const headers: Record<string, string> = {};
  const moves: Move[] = [];
  let lastTo: [number, number] | undefined;
  let hasVariations = false;
  for (const original of raw.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^変化[：:]/.test(line)) { hasVariations = true; break; }
    if (line.startsWith("*") && moves.length) { moves[moves.length - 1].comment += `${line.slice(1)}\n`; continue; }
    if (/^[|+]/.test(line) || /^(先手|後手|上手|下手)の持駒[：:]/.test(line)) throw new Error("局面図から始まる棋譜には未対応です。平手または駒落ちの初期局面からの KIF を選んでください。");
    const header = line.match(/^([^：:]+)[：:](.*)$/);
    if (header && !/^\d/.test(line)) { headers[header[1].trim()] = header[2].trim(); continue; }
    const row = line.match(/^(\d+)\s+(.+)$/);
    if (!row) continue;
    const number = Number(row[1]);
    if (number !== moves.length + 1) throw new Error(`${number}手目: 手数が連続していません。`);
    if (moves.at(-1)?.end) throw new Error("終局後に指し手が含まれています。");
    const value = row[2];
    const end = terminals.find(t => value.startsWith(t));
    if (end) { moves.push({ number, label: end, end, comment: "" }); continue; }
    const match = value.match(/^(同\s*|[１-９1-9][一二三四五六七八九1-9])\s*(成香|成桂|成銀|[歩香桂銀金角飛玉王と馬龍竜])(不成|成)?(打|\([1-9][1-9]\))/);
    if (!match) throw new Error(`${number}手目を読み取れません。移動元付きの KIF 形式にしてください。`);
    const destination = match[1];
    let to: [number, number];
    if (destination.startsWith("同")) {
      if (!lastTo) throw new Error("最初の指し手に「同」は使えません。");
      to = [...lastTo];
    } else {
      const normalized = destination.normalize("NFKC");
      to = [Number(normalized[0]), "一二三四五六七八九".indexOf(normalized[1]) + 1 || Number(normalized[1])];
    }
    const drop = match[4] === "打";
    if (drop && match[3]) throw new Error(`${number}手目: 駒打ちに成り指定は使えません。`);
    const kind = match[2].replace("王", "玉").replace("竜", "龍") as Kind;
    moves.push({ number, label: `${destination.trim()}${match[2]}${match[3] ?? ""}${drop ? "打" : ""}`, to, from: drop ? undefined : [Number(match[4][1]), Number(match[4][2])], kind, promote: match[3] === "成", drop, comment: "" });
    lastTo = to;
  }
  if (!moves.length) throw new Error("指し手が見つかりません。KIF 形式の棋譜を選んでください。");
  const handicap = headers["手合割"] || "平手";
  const firstSide: Side = handicap === "平手" ? 0 : 1;
  const positions = [initialPosition(handicap)];
  moves.forEach((move, i) => positions.push(advance(positions[i], move, ((i + firstSide) % 2) as Side)));
  return { headers, moves, positions, firstSide, hasVariations };
}

export function decodeKif(buffer: ArrayBuffer): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { return new TextDecoder("shift_jis").decode(buffer); }
}

export function pieceText(kind: Kind): string {
  return ({ 成香: "杏", 成桂: "圭", 成銀: "全" } as Partial<Record<Kind, string>>)[kind] ?? kind;
}
