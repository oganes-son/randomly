import {
  formatDifficultyStars,
  sanitizeLatexEquation,
  formatWithBreaks,
  applyDisplayStyle
} from "../utils/helpers.js";

let unitsData = {};

document.addEventListener("DOMContentLoaded", () => {
  fetch("/static/data/units.json")
    .then(res => res.json())
    .then(data => {
      unitsData = data;
      populateUnitOptions();
    })
    .catch(err => {
      console.error("単元データの取得に失敗しました:", err);
    });

  const bookType = document.getElementById("select_book_type");
  const unitSelect = document.getElementById("unit_select_chart");

  bookType?.addEventListener("change", populateUnitOptions);
  unitSelect?.addEventListener("change", updateNumberRangeHint);
});

function populateUnitOptions() {
  const book = document.getElementById("select_book_type")?.value;
  const unitSelect = document.getElementById("unit_select_chart");
  if (!book || !unitSelect || !unitsData) return;

  unitSelect.innerHTML = "";

  let list;
  if (book === 'ex') {
    list = unitsData.ex;
  } else if (book === '4step') {
    list = unitsData['4step']; 
  } else {
    list = unitsData.chart;
  }

  if (list) {
    list.forEach(unit => {
      const option = document.createElement("option");
      option.value = unit.label;
      option.textContent = unit.label;
      unitSelect.appendChild(option);
    });
  }

  updateNumberRangeHint();
}

function updateNumberRangeHint() {
  const book = document.getElementById("select_book_type")?.value;
  const unit = document.getElementById("unit_select_chart")?.value;
  const input = document.getElementById("problem_number_input");
  if (!book || !unit || !input || !unitsData) return;

  let list;
  if (book === 'ex') {
    list = unitsData.ex;
  } else if (book === '4step') {
    list = unitsData['4step'];
  } else {
    list = unitsData.chart;
  }
  
  const found = list?.find(item => item.label === unit);
  input.placeholder = found?.range ? `例: ${found.range}` : "問題番号を入力";
}

export function getSelectedProblem() {
  const book = document.getElementById("select_book_type")?.value;
  const unit = document.getElementById("unit_select_chart")?.value;
  const number = document.getElementById("problem_number_input")?.value;

  if (!unit || !number) {
    alert("単元と問題番号を入力してください");
    return;
  }

  fetch("/get_selected_problem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book, unit, number })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
        return;
      }
      
      const similarContainer = document.getElementById('similar_container-selected');
      const aiProblemArea = document.getElementById('ai-generated-problem-area');
      
      if(similarContainer) similarContainer.style.display = 'none';
      if(aiProblemArea) aiProblemArea.style.display = 'none';
      
      const numberLabel = book === "ex" ? `EXERCISES ${data.problem_number}` : (book === "4step" ? `4step ${data.problem_number}` : data.problem_number);
      document.getElementById("selected_problem_number").innerText = numberLabel;
      document.getElementById("selected_difficulty_display").innerText = formatDifficultyStars(data.difficulty);
      
      const container = document.getElementById("selected_equation_container");
      const raw = sanitizeLatexEquation(data.equation);
      const formatted = applyDisplayStyle(formatWithBreaks(raw));
      container.innerHTML = `<div class="tex2jax_process">${formatted}</div>`;
      MathJax.typesetPromise([container]);
      
      window.RANDOMLY_APP_DATA = { equation: data.equation };

      const aiButton = document.getElementById('generate-ai-problem-btn');
      if (aiButton) aiButton.style.display = 'inline-block';

      const similarBtn = document.getElementById('similar_button-selected');
      if (similarBtn) {
          if (data.similar_count > 0) {
              similarBtn.style.display = 'inline-block';
              similarBtn.textContent = `類題を見る（${data.similar_count}問）`;

              // ★★★ここから修正★★★
              // 「類題を見る」ボタンがクリックされた時の動作を定義します。
              // この設定により、どの問題集が選択されていても、
              // script.js内のshowSimilarProblems関数が呼び出されます。
              similarBtn.onclick = () => {
                // app.pyの類題検索APIを呼び出すための情報を渡します。
                // bookが '4step' の場合、バックエンド(app.py)は
                // 4stepの問題から青チャート/EXの類題を探すロジック（4stepランダムモードと同様の機構）を
                // 実行するように設計されています。
                window.showSimilarProblems(
                  "selection",          // 呼び出し元モード
                  data.unit_name,       // 単元名
                  data.problem_number,  // 問題番号
                  book                  // 問題集の種類 ('4step'など)
                );
              };
              // ★★★ここまで修正★★★

          } else {
              similarBtn.style.display = 'none';
          }
      }
    })
    .catch(err => {
      console.error(err);
      alert("問題の取得中にエラーが発生しました。");
    });
}
