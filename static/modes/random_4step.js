/**
 * random_4step.js
 * 4stepランダムモードに関するすべてのフロントエンド処理を担当します。
 */

// ===== モジュールの読み込み =====
import {
  formatWithBreaks,
  sanitizeLatexEquation,
  getEquationSnippet,
  formatPunctuation
} from "../utils/helpers.js";

/**
 * 「問題を選ぶ」ボタンがクリックされたときに実行されるメインの関数です。
 * サーバーに問い合わせて4stepの問題データを取得し、画面に表示します。
 */
export function getProblemFrom4step() {
  const modeId = "2";
  const button = document.querySelector(`#step4 .main-action-button`);

  // --- ユーザーの選択内容を取得 ---
  const selectedUnits = Array.from(
    document.querySelectorAll(`#sidebar-${modeId} .unit-checkbox[data-value]:checked`)
  ).map(cb => cb.dataset.value);

  const selectedDifficulties = Array.from(
    document.querySelectorAll(`#difficult-${modeId} .unit-checkbox:checked`)
  ).map(cb => cb.dataset.difficulty);

  // --- 入力チェック ---
  if (selectedUnits.length === 0) {
    document.getElementById(`error-message-${modeId}`).style.display = "block";
    return;
  }
  document.getElementById(`error-message-${modeId}`).style.display = "none";

  // --- ローディング表示開始 ---
  button.classList.add('is-loading');
  button.disabled = true;

  // --- バックエンドにリクエストを送信 ---
  fetch("/get_problem_4step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      units: selectedUnits,
      difficulties: selectedDifficulties
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }

    // --- 画面表示処理 ---
    const container = document.getElementById(`equation_container-${modeId}`);
    container.innerHTML = ''; // 表示前にコンテナをクリア

    // テキスト整形
    const formatted = formatWithBreaks(formatPunctuation(sanitizeLatexEquation(data.equation)));

    // 問題文の要素を作成して表示
    const problemDiv = document.createElement('div');
    problemDiv.className = 'tex2jax_process';
    problemDiv.innerHTML = formatted;
    container.appendChild(problemDiv);

    // 複数画像のパスリスト(image_paths)を処理
    if (data.image_paths && data.image_paths.length > 0) {
        const gallery = document.createElement('div');
        gallery.className = 'problem-image-gallery';
        data.image_paths.forEach(path => {
            const img = document.createElement('img');
            img.src = path;
            img.className = 'problem-image';
            img.alt = '問題の図';
            gallery.appendChild(img);
        });
        container.appendChild(gallery);
    }

    MathJax.typesetPromise([container]); // 数式をレンダリング

    // 問題詳細エリアを更新
    document.getElementById(`unit_name-${modeId}`).innerText = data.unit_name;
    document.getElementById(`problem_number-${modeId}`).innerText = data.problem_number;
    document.getElementById(`difficulty_level-${modeId}`).innerText = data.difficulty; // 4stepは★表示ではない

    // 履歴テーブルに行を追加
    const table = document.getElementById(`history_table_body-${modeId}`);
    const row = document.createElement("tr");
    const index = table.rows.length + 1;
    const snippet = getEquationSnippet(data.equation);

    row.innerHTML = `<td>${index}</td><td>${data.problem_number}</td><td><div class="tex2jax_process">${snippet}...</div></td>`;
    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      container.innerHTML = `<div class="tex2jax_process">${formatted}</div>`;
      // 履歴クリック時の画像再表示も複数対応
      if (data.image_paths && data.image_paths.length > 0) {
          const gallery = document.createElement('div');
          gallery.className = 'problem-image-gallery';
          data.image_paths.forEach(path => {
              const img = document.createElement('img');
              img.src = path;
              img.className = 'problem-image';
              img.alt = '問題の図';
              gallery.appendChild(img);
          });
          container.appendChild(gallery);
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
        btn.onclick = () => window.showSimilarProblems("4step", data.unit_name, data.problem_number, "4step");
      } else {
        btn.style.display = "none";
      }
    }
  })
  .catch(err => {
    console.error(err);
    alert("問題の取得中にエラーが発生しました。");
  })
  .finally(() => {
    // --- ローディング表示終了 ---
    button.classList.remove('is-loading');
    button.disabled = false;
  });
}