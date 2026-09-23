import assert from "node:assert/strict";
import test from "node:test";
import { initialPosition, parseKif } from "../lib/kif";
import { sampleKif } from "../lib/sample";

test("平手の初期局面には40枚の駒がある", () => {
  assert.equal(initialPosition().pieces.length, 40);
});

test("サンプル棋譜を終局まで再現する", () => {
  const parsed = parseKif(sampleKif);
  assert.equal(parsed.moves.length, 31);
  assert.equal(parsed.positions.length, 32);
  assert.equal(parsed.moves.at(-1)?.end, "中断");
  assert.equal(parsed.positions[15].hands[0].歩, 3);
  assert.equal(parsed.positions[19].hands[0].歩, 2);
});

test("同、成り、駒打ちを扱う", () => {
  const parsed = parseKif(`手合割：平手
先手：先手
後手：後手
1 ７六歩(77)
2 ３四歩(33)
3 ２二角成(88)
4 同　銀(31)
5 ８八角打
6 中断`);
  assert.equal(parsed.positions[3].pieces.find(p => p.x === 2 && p.y === 2)?.kind, "馬");
  assert.equal(parsed.positions[4].pieces.find(p => p.x === 2 && p.y === 2)?.kind, "銀");
  assert.equal(parsed.positions[5].pieces.find(p => p.x === 8 && p.y === 8)?.kind, "角");
  assert.equal(parsed.positions[5].hands[0].角, 0);
});

test("不正な手順を拒否する", () => {
  assert.throws(() => parseKif("手合割：平手\n1 ７六歩(66)"), /一致しません/);
  assert.throws(() => parseKif("これはKIFではありません"), /指し手が見つかりません/);
});
