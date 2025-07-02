// 難易度ラベルと★を合成して表示
export function getDifficultyText(level) {
  if (!level) return "";
  const levels = {
    1: "（教科書の例レベル）",
    2: "（教科書の例題レベル）",
    3: "（教科書の節末・章末レベル）",
    4: "（入試の基本～標準レベル）",
    5: "（入試の標準～やや難レベル）"
  };
  const stars = typeof level === "number" || /^\d$/.test(level)
    ? "★".repeat(level) + "☆".repeat(5 - level)
    : level;

  return levels[level] ? `${stars} ${levels[level]}` : level;
}

// ★表示のみのシンプルな難易度（詳細ラベル不要時）
export function formatDifficultyStars(level) {
  const num = parseInt(level, 10);
  const clamped = Math.max(1, Math.min(5, isNaN(num) ? 1 : num));
  return "★".repeat(clamped) + "☆".repeat(5 - clamped);
}

// LaTeXの二重括弧や空式をクリーニング
export function sanitizeLatexEquation(equation) {
  return equation
    .replace(/\\\(\s*\\\(/g, "\\(")
    .replace(/\\\)\s*\\\)/g, "\\)")
    .replace(/\\\(\s*\\\)/g, "");
}

// 段落分け＋小問番号インデント整形
export function formatWithBreaks(raw) {
  const text = sanitizeLatexEquation(raw);

  const mathBlocks = [];
  const placeholder = text.replace(/\\\((.+?)\\\)/g, (_, eq) => {
    const id = mathBlocks.length;
    mathBlocks.push(`\\(${eq}\\)`);
    return `[[MATH${id}]]`;
  });

  const patterns = [
    { type: "round", regex: /\((1[0-9]|20|[1-9])\)/g },
    { type: "kana", regex: /\([ア-ン]\)/g }
  ];

  let result = "";
  let cursor = 0;
  let lastType = null;
  let lastNum = null;

  while (cursor < placeholder.length) {
    let matched = false;

    for (const { type, regex } of patterns) {
      regex.lastIndex = cursor;
      const match = regex.exec(placeholder);
      if (match && match.index === cursor) {
        const token = match[0];
        const prev = placeholder[cursor - 1] || "";
        const num = token.match(/\d+/)?.[0];
        const isBackref = lastType === type && num && lastNum && Number(num) < Number(lastNum);

        const isIgnored = prev.match(/[a-zA-Z0-9_）)]/) || prev === "\\" || isBackref;

        if (!isIgnored) {
          if (!isIgnored) {
            result += "<br>";
          }
          if (type === "kana") result += "&emsp;";
          else if (lastType && lastType !== type) result += "&emsp;";
          lastType = type;
          lastNum = num;
        }

        result += token;
        cursor += token.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += placeholder[cursor];
      cursor++;
    }
  }

  return result.replace(/\[\[MATH(\d+)\]\]/g, (_, n) => mathBlocks[n]);
}

// 履歴用スニペット（途中でも閉じ括弧を補完）
export function getEquationSnippet(equation, maxLength = 50) {
  const clean = sanitizeLatexEquation(equation).replace(/<[^>]+>/g, "");
  let snippet = clean.slice(0, maxLength);
  const open = (snippet.match(/\\\(/g) || []).length;
  const close = (snippet.match(/\\\)/g) || []).length;
  if (open > close) snippet += "\\)";
  return snippet;
}

// displaystyle付加（分数・Σ・積分のみ）
export function applyDisplayStyle(latex) {
  return latex;
}



/**
 * ★追加：数式内外を判定しながら、日本語の読点「、」を置換する関数
 * @param {string} text - 元のテキスト
 * @returns {string} - 置換後のテキスト
 */
export function formatPunctuation(text) {
    let result = '';
    let inMath = false;
    // 数式デリミタ ($$, $, \[, \], \(, \)) と読点「、」で文字列を分割
    const tokens = text.split(/(\$\$|\$|\\\[|\\\]|\\\(|\\\)|、)/);

    for (const token of tokens) {
        if (token === '$$' || token === '$' || token === '\\[' || token === '\\(') {
            inMath = true;
        } else if (token === '$$' || token === '$' || token === '\\]' || token === '\\)') {
            inMath = false;
        }

        if (token === '、') {
            // 数式内なら「, \quad 」、外なら「, 」に置換
            result += inMath ? ', \\quad ' : ', ';
        } else {
            result += token;
        }
    }
    return result;
}