/**
 * helpers.js
 * アプリケーション全体で使われる、表示整形などの補助関数をまとめたファイルです。
 */

/**
 * 難易度レベル（数値）を、★と説明文の形式に変換します。
 * @param {number|string} level - 難易度の数値 (1-5)
 * @returns {string} - 整形後のテキスト (例: ★★★☆☆（教科書の節末・章末レベル）)
 */
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

/**
 * 難易度レベル（数値）を、★表示のみのシンプルな形式に変換します。
 * @param {number|string} level - 難易度の数値 (1-5)
 * @returns {string} - ★と☆で構成された文字列
 */
export function formatDifficultyStars(level) {
  const num = parseInt(level, 10);
  if (isNaN(num)) return level; // 数値でない場合はそのまま返す (例: "A", "B")
  const clamped = Math.max(1, Math.min(5, num));
  return "★".repeat(clamped) + "☆".repeat(5 - clamped);
}

/**
 * LaTeXの数式文字列から、不要な二重括弧や空の数式をクリーニングします。
 * @param {string} equation - 元の数式文字列
 * @returns {string} - クリーニング後の文字列
 */
export function sanitizeLatexEquation(equation) {
  if (typeof equation !== 'string') return '';
  return equation
    .replace(/\\\(\s*\\\(/g, "\\(")
    .replace(/\\\)\s*\\\)/g, "\\)")
    .replace(/\\\(\s*\\\)/g, "");
}

/**
 * 問題文のテキストを、小問番号などに応じて改行やインデントを加えて整形します。
 * @param {string} raw - 整形前のテキスト
 * @returns {string} - <br>や&emsp;が挿入されたHTML文字列
 */
export function formatWithBreaks(raw) {
  const text = sanitizeLatexEquation(raw);
  const patterns = [
    { type: "round", regex: /\((1[0-9]|20|[1-9])\)/g },
    { type: "kana", regex: /\([ア-ン]\)/g }
  ];
  let result = "";
  let lastMatchEnd = 0;

  const matches = [];
  patterns.forEach(({ type, regex }) => {
    let match;
    const re = new RegExp(regex);
    while ((match = re.exec(text)) !== null) {
      matches.push({ type, match });
    }
  });

  matches.sort((a, b) => a.match.index - b.match.index);

  matches.forEach(({ type, match }) => {
    result += text.substring(lastMatchEnd, match.index);
    
    if (match.index > 0) {
      result += "<br>";
    }
    if (type === "kana") {
      result += "&emsp;";
    }

    result += match[0];
    lastMatchEnd = match.index + match[0].length;
  });

  result += text.substring(lastMatchEnd);

  return result;
}

/**
 * 履歴表示用に、問題文の冒頭部分を切り出すスニペットを生成します。
 * @param {string} equation - 元の問題文
 * @param {number} [maxLength=50] - 最大文字数
 * @returns {string} - 切り出された文字列
 */
export function getEquationSnippet(equation, maxLength = 50) {
  if (typeof equation !== 'string') return '';
  const clean = sanitizeLatexEquation(equation).replace(/<[^>]+>/g, "");
  let snippet = clean.slice(0, maxLength);
  const open = (snippet.match(/\\\(/g) || []).length;
  const close = (snippet.match(/\\\)/g) || []).length;
  if (open > close) snippet += "\\)";
  return snippet;
}

/**
 * Excelデータ側でdisplaystyleが指定されているため、この関数は現在何もしません。
 * @param {string} latex - 元のLaTeX文字列
 * @returns {string} - 処理後のLaTeX文字列
 */
export function applyDisplayStyle(latex) {
  return latex;
}

/**
 * 数式内外を判定しながら、日本語の読点「、」を置換する関数。
 * @param {string} text - 元のテキスト
 * @returns {string} - 置換後のテキスト
 */
export function formatPunctuation(text) {
    if (typeof text !== 'string') return '';
    let result = '';
    let inMath = false;
    const tokens = text.split(/(\$\$|\$|\\\[|\\\]|\\\(|\\\)|、)/);

    for (const token of tokens) {
        if (!token) continue;

        if (token === '$$' || token === '$') {
            inMath = !inMath;
        } else if (token === '\\[' || token === '\\(') {
            inMath = true;
        } else if (token === '\\]' || token === '\\)') {
            inMath = false;
        }

        if (token === '、') {
            // ★修正：数式内は「, \ 」、数式外は「, 」に置換
            result += inMath ? ', \\ ' : ', ';
        } else {
            result += token;
        }
    }
    return result;
}
