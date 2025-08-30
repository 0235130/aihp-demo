"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

// --- Types ---
interface Styles {
  color?: string;                // 文字色
  fontSize?: string;             // px
  fontWeight?: number | string;  // 例: 700
  marginTop?: string;            // px
  marginBottom?: string;         // px
  textAlign?: "left" | "center" | "right"; // 見出し/本文の横揃え
  justifyContent?: "flex-start" | "center" | "flex-end"; // ボタン配置
}

interface ElementModel {
  id: string;
  type: "heading" | "paragraph" | "button";
  content: string;
  styles: Styles;
}

interface Patch {
  content?: string; // 特殊：__ADD__テキスト① などで追加命令を渡す
  styles?: Styles;
}

// --- Helpers ---
const px = (n: number) => `${Math.max(0, Math.round(n))}px`;
const clampFont = (pxVal: number) => Math.min(72, Math.max(10, pxVal));
const parsePx = (v?: string, fallback = 16) => (v ? parseInt(v, 10) : fallback);

const placeholderStyle: Styles = {
  color: "#9ca3af", // text-gray-400
  fontSize: "16px",
  marginTop: "8px",
  marginBottom: "8px",
  textAlign: "left",
};

// アンカー解決用の型
type Anchor = { index: number; place: "before" | "after" } | null;

// 自然言語 → patch 変換（色・サイズ・太さ・整列・余白・テキスト・ボタン配置・テキスト欄追加）
function parseCommandToPatch(cmdRaw: string, current: ElementModel): Patch {
  const cmd = cmdRaw.trim().toLowerCase();
  const patch: Patch = { styles: {} };

  // ▼ テキスト欄追加（先に拾う）
  // 例："テキスト1を追加" / "テキスト①を追加" / "見出しの下にテキスト2" / "ボタンの前にテキスト3"
  const addMatch = cmdRaw.match(/テキスト[①-⑳0-9]+/);
  if (addMatch && /(追加|入れて|挿入|置いて)/.test(cmd)) {
    const label = normalizeLabel(addMatch[0]); // 例: テキスト① → テキスト1
    // content に特殊フラグを入れて、applyCommand 側で実際の挿入処理を行う
    return { content: `__ADD__${label}` };
  }
  // "の上/下/前/後" 指定があっても、挿入自体は上のフラグでハンドリング

  // ▼ サイズ
  const curSize = parsePx(current.styles.fontSize, current.type === "heading" ? 36 : 16);
  if (/大きく|bigger|larger|increase size|\+\+/.test(cmd)) patch.styles!.fontSize = px(clampFont(curSize + 6));
  if (/小さく|smaller|decrease size|--/.test(cmd)) patch.styles!.fontSize = px(clampFont(curSize - 6));
  const sizePxMatch = cmd.match(/(\d{2,3})\s*px/);
  if (sizePxMatch) patch.styles!.fontSize = px(clampFont(parseInt(sizePxMatch[1], 10)));

  // ▼ 色
  if (/赤|red/.test(cmd)) patch.styles!.color = "#e11d48";
  if (/青|blue/.test(cmd)) patch.styles!.color = "#2563eb";
  if (/緑|green/.test(cmd)) patch.styles!.color = "#16a34a";
  if (/黒|black/.test(cmd)) patch.styles!.color = "#111827";
  if (/白|white/.test(cmd)) patch.styles!.color = "#ffffff";

  // ▼ 太さ
  if (/太く|bold/.test(cmd)) patch.styles!.fontWeight = 700;
  if (/細く|light|lighter/.test(cmd)) patch.styles!.fontWeight = 300;

  // ▼ 整列（ボタン以外は textAlign、ボタンは justifyContent）
  const wantsLeft = /(左|left)/.test(cmd);
  const wantsCenter = /(中央|center)/.test(cmd);
  const wantsRight = /(右|right)/.test(cmd);

  if (current.type === "button") {
    if (wantsLeft) patch.styles!.justifyContent = "flex-start";
    if (wantsCenter) patch.styles!.justifyContent = "center";
    if (wantsRight) patch.styles!.justifyContent = "flex-end";
  } else {
    if (wantsLeft) patch.styles!.textAlign = "left";
    if (wantsCenter) patch.styles!.textAlign = "center";
    if (wantsRight) patch.styles!.textAlign = "right";
  }

  // ▼ 余白（曖昧語 → 数値化）
  const mt = parsePx(current.styles.marginTop, 16);
  const mb = parsePx(current.styles.marginBottom, 16);
  if (/余白.*(広|増|大)/.test(cmd) || /(more|increase).*(space|margin)/.test(cmd)) {
    const delta = /かなり|significant/.test(cmd) ? 32 : /もっと|more/.test(cmd) ? 20 : 8;
    patch.styles!.marginTop = px(mt + delta);
    patch.styles!.marginBottom = px(mb + delta);
  }
  if (/余白.*(狭|減|小)/.test(cmd) || /(reduce|less).*(space|margin)/.test(cmd)) {
    const delta = /かなり|significant/.test(cmd) ? 32 : /もっと|more/.test(cmd) ? 20 : 8;
    patch.styles!.marginTop = px(Math.max(0, mt - delta));
    patch.styles!.marginBottom = px(Math.max(0, mb - delta));
  }

  // ▼ テキスト差し替え（「文字を…」「テキストを…」）
  const contentMatch = cmdRaw.match(/(文字|テキスト)を(.+)/);
  if (contentMatch) patch.content = contentMatch[2].trim();

  // 空オブジェクトなら削除
  if (patch.styles && Object.keys(patch.styles).length === 0) delete patch.styles;
  return patch;
}

// "テキスト①" → "テキスト1" に正規化（①〜⑳にも対応）
function normalizeLabel(raw: string): string {
  const map: Record<string, string> = {
    "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5",
    "⑥": "6", "⑦": "7", "⑧": "8", "⑨": "9", "⑩": "10",
    "⑪": "11", "⑫": "12", "⑬": "13", "⑭": "14", "⑮": "15",
    "⑯": "16", "⑰": "17", "⑱": "18", "⑲": "19", "⑳": "20",
  };
  let label = raw;
  Object.entries(map).forEach(([k, v]) => { label = label.replaceAll(k, v); });
  return label;
}

// コマンドから挿入アンカーを推測
function resolveAnchor(cmdRaw: string, elements: ElementModel[], selected: ElementModel | null): Anchor {
  const cmd = cmdRaw.trim();
  // 位置キーワード
  const wantsTop = /(一番上|先頭|top)/.test(cmd);
  const wantsBottom = /(一番下|末尾|bottom)/.test(cmd);
  const before = /(前|上|before)/.test(cmd);
  const after = /(後|下|after)/.test(cmd);

  // アンカー対象（見出し/段落/ボタン）
  const wantsHeading = /(見出し|ヘッダ|heading|h1)/.test(cmd);
  const wantsParagraph = /(段落|本文|paragraph|テキスト)/.test(cmd) && !/(ボタン)/.test(cmd);
  const wantsButton = /(ボタン|button)/.test(cmd);

  // 1) 先頭/末尾 指定
  if (wantsTop) return { index: 0, place: "before" };
  if (wantsBottom) return { index: elements.length - 1, place: "after" };

  // 2) 種別明示（最初に見つかったもの）
  if (wantsHeading) {
    const i = elements.findIndex((e) => e.type === "heading");
    if (i >= 0) return { index: i, place: before ? "before" : "after" };
  }
  if (wantsParagraph) {
    const i = elements.findIndex((e) => e.type === "paragraph");
    if (i >= 0) return { index: i, place: before ? "before" : "after" };
  }
  if (wantsButton) {
    const i = elements.findIndex((e) => e.type === "button");
    if (i >= 0) return { index: i, place: before ? "before" : "after" };
  }

  // 3) 明示なし → 選択中の前/後（デフォルトは後）
  if (selected) {
    const idx = elements.findIndex((e) => e.id === selected.id);
    return { index: idx, place: before ? "before" : "after" };
  }
  return null;
}

function applyPatch(el: ElementModel, patch: Patch): ElementModel {
  return {
    ...el,
    content: patch.content !== undefined ? patch.content : el.content,
    styles: { ...el.styles, ...(patch.styles || {}) },
  };
}

function RenderElement({ el, selectedId, setSelectedId, readOnly = false }: { el: ElementModel; selectedId: string | null; setSelectedId: (id: string) => void; readOnly?: boolean; }) {
  const wrapperClass = readOnly
    ? "px-2"
    : "cursor-pointer rounded-xl px-2 " + (selectedId === el.id ? "outline outline-2 outline-blue-500/60 ring-2 ring-blue-500/10" : "hover:outline hover:outline-1 hover:outline-slate-300/60");
  const onClick = readOnly ? undefined : () => setSelectedId(el.id);

  return (
    <motion.div key={el.id} layout onClick={onClick} className={wrapperClass}>
      {el.type === "heading" && (
        <h1 style={{
          color: el.styles.color,
          fontSize: el.styles.fontSize,
          fontWeight: el.styles.fontWeight as any,
          marginTop: el.styles.marginTop,
          marginBottom: el.styles.marginBottom,
          textAlign: el.styles.textAlign,
        }} className="tracking-tight">{el.content}</h1>
      )}
      {el.type === "paragraph" && (
        <p style={{
          color: el.styles.color,
          fontSize: el.styles.fontSize,
          marginTop: el.styles.marginTop,
          marginBottom: el.styles.marginBottom,
          textAlign: el.styles.textAlign,
        }} className="leading-relaxed">{el.content}</p>
      )}
      {el.type === "button" && (
        <div className="mt-4 flex" style={{ justifyContent: el.styles.justifyContent ?? "center" }}>
          <button style={{ fontSize: el.styles.fontSize as any }} className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow hover:bg-blue-700 transition">
            {el.content}
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function App() {
  const initial = useMemo<ElementModel[]>(() => [
    { id: "h1-1", type: "heading", content: "あなたのビジネスに、AI編集という相棒を。", styles: { color: "#111827", fontSize: "36px", fontWeight: 700, marginTop: "8px", marginBottom: "16px", textAlign: "left" } },
    { id: "p-1", type: "paragraph", content: "要素をクリックして、右のアシスタントに話しかけてください。例：『少し大きく』『青に』『中央に』『テキスト①を追加』", styles: { color: "#374151", fontSize: "16px", marginTop: "8px", marginBottom: "16px", textAlign: "left" } },
    { id: "btn-1", type: "button", content: "お問い合わせ", styles: { color: "#ffffff", fontSize: "16px", fontWeight: 600, marginTop: "16px", marginBottom: "0px", textAlign: "center", justifyContent: "center" } },
  ], []);

  const [elements, setElements] = useState<ElementModel[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [cmd, setCmd] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [history, setHistory] = useState<ElementModel[][]>([initial]);
  const [hIndex, setHIndex] = useState(0);
  const [isPreview, setIsPreview] = useState(false);

  const pushHistory = (next: ElementModel[]) => { const newStack = [...history.slice(0, hIndex + 1), next]; setHistory(newStack); setHIndex(newStack.length - 1); };
  const undo = () => { if (hIndex > 0) { setHIndex(hIndex - 1); setElements(history[hIndex - 1]); } };
  const redo = () => { if (hIndex < history.length - 1) { setHIndex(hIndex + 1); setElements(history[hIndex + 1]); } };
  const selected = elements.find((e) => e.id === selectedId) || null;

  const insertParagraph = (label: string, anchor: Anchor) => {
    const newEl: ElementModel = {
      id: `p-${Date.now()}`,
      type: "paragraph",
      content: label,
      styles: { ...placeholderStyle },
    };
    let next = [...elements];
    if (!anchor) {
      // 末尾に追加
      next.push(newEl);
    } else {
      const pos = anchor.place === "before" ? anchor.index : anchor.index + 1;
      next.splice(Math.max(0, Math.min(pos, next.length)), 0, newEl);
    }
    setElements(next);
    pushHistory(next);
    setCmd("");
  };

  const applyCommand = () => {
    if (!selected && !cmd.trim()) return;
    const patch = parseCommandToPatch(cmd, selected || elements[0]);

    // 追加命令の処理
    if (patch.content && patch.content.startsWith("__ADD__")) {
      const label = patch.content.replace("__ADD__", "").trim();
      const anchor = resolveAnchor(cmd, elements, selected);
      insertParagraph(label, anchor);
      return;
    }

    if (!selected) return;
    if (!patch.content && !patch.styles) return; // 何も変わらない
    const next = elements.map((e) => (e.id === selected.id ? applyPatch(e, patch) : e));
    setElements(next);
    pushHistory(next);
    setCmd("");
  };

  const applyContent = () => {
    if (!selected || !contentDraft.trim()) return;
    const next = elements.map((e) => (e.id === selected.id ? applyPatch(e, { content: contentDraft.trim() }) : e));
    setElements(next);
    pushHistory(next);
    setContentDraft("");
  };

  const applyPreset = (preset: string) => { setCmd(preset); setTimeout(applyCommand, 0); };

  return (
    <div className="min-h-screen w-full bg-slate-50 p-6">
      {/* ヘッダー：編集↔確認 */}
      <div className="mx-auto max-w-6xl flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-slate-700">AIHP – Text Edit MVP</h1>
        <div className="flex gap-2">
          {!isPreview ? (
            <button onClick={() => setIsPreview(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">確認へ（プレビュー）</button>
          ) : (
            <button onClick={() => setIsPreview(false)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-black">編集に戻る</button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl grid grid-cols-12 gap-4">
        {/* キャンバス */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-8">
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
            <div className="space-y-4">
              {elements.map((el) => (
                <RenderElement key={el.id} el={el} selectedId={selectedId} setSelectedId={setSelectedId} readOnly={isPreview} />
              ))}
            </div>
          </div>
        </div>

        {/* 右パネル（プレビュー時は非表示） */}
        {!isPreview && (
          <div className="col-span-12 lg:col-span-5 xl:col-span-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">AIアシスタント</h2>
                <div className="flex gap-2">
                  <button onClick={undo} className="px-3 py-1.5 rounded-lg bg-slate-100">戻す</button>
                  <button onClick={redo} className="px-3 py-1.5 rounded-lg bg-slate-100">やり直す</button>
                </div>
              </div>

              {/* テキスト差し替え */}
              <label className="block text-sm font-medium mb-1">テキスト差し替え</label>
              <input value={contentDraft} onChange={(e) => setContentDraft(e.target.value)} placeholder="ここに新しいテキスト" className="w-full mb-2 rounded-lg border border-slate-300 px-3 py-2" />
              <button onClick={applyContent} className="mb-4 w-full rounded-lg bg-slate-900 text-white px-3 py-2">文字を適用</button>

              {/* 会話コマンド */}
              <label className="block text-sm font-medium mb-1">会話で編集</label>
              <textarea value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="例：『テキスト①を追加』『見出しの下にテキスト2』『ボタンの前にテキスト3』『赤に』『少し大きく』『中央』" className="w-full rounded-lg border border-slate-300 px-3 py-2 h-28" />
              <button onClick={applyCommand} className="mt-2 w-full rounded-lg bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">AIで反映</button>

              {/* プリセット */}
              <div className="mt-5">
                <div className="text-sm font-medium mb-2">クイック操作</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("大きく")}>大きく</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("小さく")}>小さく</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("太く")}>太く</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("中央")}>中央</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("赤")}>赤</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("青")}>青</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("余白を少し広く")}>余白＋</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("余白を少し狭く")}>余白－</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("ボタンを左に")}>ボタン左</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("ボタンを中央に")}>ボタン中央</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("ボタンを右に")}>ボタン右</button>

                  {/* 追加用プリセット（デモ用） */}
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("テキスト1を追加")}>テキスト①追加</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("見出しの下にテキスト2を追加")}>見出し下に②</button>
                  <button className="rounded-lg border px-2 py-1" onClick={() => applyPreset("ボタンの前にテキスト3を追加")}>ボタン前に③</button>
                </div>
              </div>

              <div className="mt-6 text-xs text-slate-500">※ デモは簡易パーサで解釈しています。実運用ではAPI化して、アンカーの解像度（id指定・セクション指定）や並び替えにも対応します。</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
