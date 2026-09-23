import { createClient } from "@supabase/supabase-js";
import { parseKif } from "./kif";
import { sampleKif } from "./sample";

export type Game = { id: string; title: string; kif: string; tags: string[]; favorite: boolean; note: string; created_at: string };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, { auth: { flowType: "pkce", detectSessionInUrl: true } }) : null;
export const LOCAL_KEY = "kifucho-games-v1";
export function newGame(kif: string, filename?: string): Game {
  const { headers } = parseKif(kif);
  return { id: crypto.randomUUID(), title: filename?.replace(/\.(kif|kifu)$/i, "") || headers["棋戦"] || "無題の棋譜", kif, tags: [], favorite: false, note: "", created_at: new Date().toISOString() };
}
export function sampleGame(): Game {
  return { id: "a392639f-bc73-4d53-8aa0-8f6042a94841", title: "横歩取りの研究", kif: sampleKif, tags: ["横歩取り", "研究"], favorite: true, note: "飛車先の交換から横歩取りへ。序盤の駒組みを振り返るためのサンプル棋譜です。", created_at: "2026-09-20T05:00:00.000Z" };
}
export function readLocal(): Game[] {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (raw === null) return [sampleGame()];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.some(g => !g || typeof g.id !== "string" || typeof g.title !== "string" || typeof g.kif !== "string" || !Array.isArray(g.tags) || g.tags.some((t: unknown) => typeof t !== "string") || typeof g.favorite !== "boolean" || typeof g.note !== "string" || typeof g.created_at !== "string")) throw new Error("ブラウザー保存データを読み込めません。元データを保護するため保存を停止しています。");
  value.forEach(g => parseKif(g.kif));
  return value as Game[];
}
