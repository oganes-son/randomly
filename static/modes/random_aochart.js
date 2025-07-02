/**
 * random_aochart.js
 * 青チャートランダムモードに関するフロントエンド処理を担当します。
 */
import {
  formatWithBreaks,
  sanitizeLatexEquation,
  formatDifficultyStars,
  getEquationSnippet,
  formatPunctuation // 必要な関数をインポート
} from "../utils/helpers.js";

// このファイルは、この関数をエクスポートすることに専念します。
// ページ全体の初期化はメインのscript.jsが行うため、このファイル内の初期化処理は不要です。
export function getProblemFromAochart() {
  const modeId = "1";

  const selectedUnits = Array.from(
    document.querySelectorAll(`#sidebar-${modeId} .unit-checkbox[data-value]:checked`)
  ).map(cb => cb.dataset.value);

  const selectedDifficulties = Array.from(
    document.querySelectorAll(`#difficult-${modeId} .unit-checkbox:checked`)
  ).map(cb => cb.dataset.difficulty);

  // ユーザーが選択した問題集の種類
  const bookSelection = document.querySelector(`input[name="book_select-${modeId}"]:checked`)?.value || "all";

  if (selectedUnits.length === 0) {
    document.getElementById(`error-message-${modeId}`).style.display = "block";
    return;
  } else {
    document.getElementById(`error-message-${modeId}`).style.display = "none";
  }

  const body = {
    units: selectedUnits,
    difficulties: selectedDifficulties,
    book: bookSelection
  };

  fetch("/get_problem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    .then(res => {
      if (!res.ok) throw new Error("ログインエラーまたは取得失敗");
      return res.json();
    })
    .then(data => {
      if (data.error) {
        alert(data.error);
        return;
      }

      // --- 表示処理 ---

      const container = document.getElementById(`equation_container-${modeId}`);
      container.innerHTML = ''; // 表示前にコンテナをクリア

      // テキスト整形処理
      const raw = sanitizeLatexEquation(data.equation);
      const punctuated = formatPunctuation(raw);
      const formatted = formatWithBreaks(punctuated);

      // 問題文の要素を作成してコンテナに追加
      const problemDiv = document.createElement('div');
      problemDiv.className = 'tex2jax_process';
      problemDiv.innerHTML = formatted;
      container.appendChild(problemDiv);

      // 画像があれば画像要素を作成して追加
      if (data.image_path) {
        const img = document.createElement('img');
        img.src = data.image_path;
        img.className = 'problem-image';
        img.alt = '問題の図';
        container.appendChild(img);
      }

      MathJax.typesetPromise([container]); // 数式をレンダリング

      // 問題詳細の表示を更新
      // ★修正: サーバーから返された実際のbookタイプを基にラベルを作成
      const numberLabel = data.book === "ex" ? `EXERCISES ${data.problem_number}` : `${data.problem_number}`;
      document.getElementById(`unit_name-${modeId}`).innerText = data.unit_name;
      document.getElementById(`problem_number-${modeId}`).innerText = numberLabel;
      document.getElementById(`difficulty_level-${modeId}`).innerText = formatDifficultyStars(data.difficulty);

      // 履歴テーブルに行を追加
      const table = document.getElementById(`history_table_body-${modeId}`);
      const row = document.createElement("tr");
      const index = table.rows.length + 1;
      const snippet = getEquationSnippet(data.equation);

      row.innerHTML = `<td>${index}</td><td>${numberLabel}</td><td><div class="tex2jax_process">${snippet}...</div></td>`;
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        container.innerHTML = `<div class="tex2jax_process">${formatted}</div>`;
        if (data.image_path) {
            const img = document.createElement('img');
            img.src = data.image_path;
            img.className = 'problem-image';
            img.alt = '問題の図';
            container.appendChild(img);
        }
        MathJax.typesetPromise([container]);
      });
      table.prepend(row);
      MathJax.typesetPromise([row]);

      // 類題ボタンの表示を制御
      const btn = document.getElementById(`similar_button-${modeId}`);
      if (btn) {
        if (data.similar_count > 0) {
          btn.style.display = "inline-block";
          btn.textContent = `類題を見る（${data.similar_count}問）`;
          // ★修正: サーバーから返された実際のbookタイプを類題検索に渡す
          btn.onclick = () => window.showSimilarProblems("aochart", data.unit_name, data.problem_number, data.book);
        } else {
          btn.style.display = "none";
        }
      }
    })
    .catch(err => {
      console.error(err);
      alert("問題の取得に失敗しました。ログイン状態または通信をご確認ください。");
    });
}
