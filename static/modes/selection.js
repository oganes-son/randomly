/**
 * selection.js
 * 「選択モード」に関するすべてのフロントエンド処理を担当します。
 */

// ===== モジュールの読み込み =====
import {
  formatDifficultyStars,
  sanitizeLatexEquation,
  formatWithBreaks,
  formatPunctuation
} from "../utils/helpers.js";

// このファイル内で使用する単元データを格納するためのグローバル変数
let unitsData = {};

// ===== メイン処理（ページのDOM読み込み完了時に一度だけ実行） =====
document.addEventListener("DOMContentLoaded", () => {
  // --- 初期化処理 ---
  // units.jsonから単元データを非同期で取得し、ドロップダウンを初期化
  fetch("/static/data/units.json")
    .then(res => res.json())
    .then(data => {
      unitsData = data;
      populateUnitOptions();
    })
    .catch(err => {
      console.error("単元データの取得に失敗しました:", err);
    });

  // --- イベントリスナーの設定 ---
  // 必要なHTML要素への参照をまとめて取得
  const bookType = document.getElementById("select_book_type");
  const unitSelect = document.getElementById("unit_select_chart");
  const prevBtn = document.getElementById('prev-problem-btn');
  const nextBtn = document.getElementById('next-problem-btn');
  const numberInput = document.getElementById('problem_number_input');

  // 各要素にイベントリスナーを設定
  bookType?.addEventListener("change", populateUnitOptions);
  unitSelect?.addEventListener("change", updateNumberRangeHint);

  // 「前の問題」ボタンがクリックされた時の処理
  prevBtn?.addEventListener('click', () => {
      let currentNumber = parseInt(numberInput.value, 10);
      if (isNaN(currentNumber) || currentNumber <= 1) {
          return; 
      }
      numberInput.value = currentNumber - 1;
      getSelectedProblem();
  });

  // 「次の問題」ボタンがクリックされた時の処理
  nextBtn?.addEventListener('click', () => {
      let currentNumber = parseInt(numberInput.value, 10);
      numberInput.value = isNaN(currentNumber) ? 1 : currentNumber + 1;
      getSelectedProblem();
  });
});

/**
 * 問題集の選択（青チャート／EXERCISES／4step）に応じて、
 * 単元選択ドロップダウンの中身を動的に更新します。
 */
function populateUnitOptions() {
  const book = document.getElementById("select_book_type")?.value;
  const unitSelect = document.getElementById("unit_select_chart");
  if (!book || !unitSelect || !unitsData) return;

  unitSelect.innerHTML = ""; // 中身を一度クリア

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

/**
 * 単元の選択に応じて、問題番号入力欄のヒント（placeholder）を更新します。
 */
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

/**
 * 「問題を表示」ボタンがクリックされたときに実行されるメインの関数です。
 */
export function getSelectedProblem() {
  const mainButton = document.querySelector(`#selection .main-button-group .main-action-button`);
  const prevBtn = document.getElementById('prev-problem-btn');
  const nextBtn = document.getElementById('next-problem-btn');

  const book = document.getElementById("select_book_type")?.value;
  const unit = document.getElementById("unit_select_chart")?.value;
  const number = document.getElementById("problem_number_input")?.value;
  if (!unit || !number) { alert("単元と問題番号を入力してください"); return; }

  // --- ローディング表示開始 ---
  if(mainButton) { mainButton.classList.add('is-loading'); mainButton.disabled = true; }
  if(prevBtn) prevBtn.disabled = true;
  if(nextBtn) nextBtn.disabled = true;

  fetch("/get_selected_problem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book, unit, number })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) { alert(data.error); return; }
    
    document.getElementById('similar_container-selected').style.display = 'none';
    document.getElementById('ai-generated-problem-area').style.display = 'none';
    
    const container = document.getElementById("selected_equation_container");
    container.innerHTML = '';

    const formatted = formatWithBreaks(formatPunctuation(sanitizeLatexEquation(data.equation)));
    const problemDiv = document.createElement('div');
    problemDiv.className = 'tex2jax_process';
    problemDiv.innerHTML = formatted;
    container.appendChild(problemDiv);

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

    const numberLabel = book === "ex" ? `EXERCISES ${data.problem_number}` : (book === "4step" ? `4step ${data.problem_number}` : data.problem_number);
    document.getElementById("selected_problem_number").innerText = numberLabel;
    document.getElementById("selected_difficulty_display").innerText = formatDifficultyStars(data.difficulty);
    
    window.RANDOMLY_APP_DATA = { equation: data.equation };

    document.getElementById('generate-ai-problem-btn').style.display = 'inline-block';
    const similarBtn = document.getElementById('similar_button-selected');
    if (data.similar_count > 0) {
        similarBtn.style.display = 'inline-block';
        similarBtn.textContent = `類題を見る（${data.similar_count}問）`;
        similarBtn.onclick = () => window.showSimilarProblems("selection", data.unit_name, data.problem_number, book);
    } else {
        similarBtn.style.display = 'none';
    }
  })
  .catch(err => { console.error(err); alert("問題の取得中にエラーが発生しました。"); })
  .finally(() => {
    // --- ローディング表示終了 ---
    if(mainButton) { mainButton.classList.remove('is-loading'); mainButton.disabled = false; }
    if(prevBtn) prevBtn.disabled = false;
    if(nextBtn) nextBtn.disabled = false;
  });
}
