/**
 * script.js
 * このアプリケーション全体の動作を制御する司令塔となるメインのJavaScriptファイルです。
 * - 各モードの専用JSファイルをモジュールとして読み込みます。
 * - 全てのモードで共通して使われる機能（ナビゲーション、アコーディオン初期化など）を管理します。
 * - データベースからの類題表示機能、AIによる類題生成機能、選択モードのボタンなどのイベント処理を担当します。
 */

// ===== モジュールの読み込み =====
import { getProblemFromAochart } from "/static/modes/random_aochart.js";
import { getProblemFrom4step } from "/static/modes/random_4step.js";
import { getSelectedProblem } from "/static/modes/selection.js";
import { setupAccordion } from "/static/components/accordion.js";
import { toggleHistory } from "/static/components/history.js";
// ★修正：必要なヘルパー関数をすべてインポート
import {
  formatDifficultyStars,
  formatWithBreaks,
  sanitizeLatexEquation,
  formatPunctuation,
  getEquationSnippet
} from "./utils/helpers.js";


// ===== 共通ヘルパー関数 =====

/**
 * units.jsonから単元データを非同期で取得し、
 * 選択モードのドロップダウンメニューを初期化します。
 */
function loadUnitOptionsFromJSON() {
  fetch("/static/data/units.json")
    .then(res => res.json())
    .then(data => {
      const chartSelect = document.getElementById("unit_select_chart");
      if (chartSelect && Array.isArray(data.chart)) {
        chartSelect.innerHTML = '';
        data.chart.forEach(unit => {
          const option = document.createElement("option");
          option.value = unit.label;
          option.textContent = `${unit.label}`;
          chartSelect.appendChild(option);
        });
      }
    })
    .catch(err => {
      console.error("単元の取得に失敗しました:", err);
    });
}

/**
 * データベース（Excelファイル）から類題を検索し、表示します。
 */
window.showSimilarProblems = function (sourceMode, unitName, problemNumber, book) {
  const modeId = sourceMode === "selection" ? "selected" : (sourceMode === "aochart" ? "1" : "2");
  const container = document.getElementById(`similar_container-${modeId}`);
  if (!container) return;

  if (sourceMode === 'selection') {
    const aiProblemArea = document.getElementById('ai-generated-problem-area');
    if(aiProblemArea) aiProblemArea.style.display = 'none';
  }
  
  container.style.display = 'block';
  container.innerHTML = "<p>読み込み中...</p>";

  fetch("/get_similar_problems", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_mode: sourceMode, unit: unitName, problem_number: problemNumber, book })
  })
    .then(res => res.json())
    .then(data => {
      container.innerHTML = "";

      if (!data.similar_problems || data.similar_problems.length === 0) {
        container.innerHTML = "<p>類題は見つかりませんでした。</p>";
        return;
      }
      
      data.similar_problems.forEach((item, idx) => {
        const difficulty = item.book === "4step" ? item.difficulty : formatDifficultyStars(item.difficulty);
        const numberLabel = item.book === "ex" ? `EXERCISES ${item.problem_number}` : item.problem_number;
        // ★修正：applyDisplayStyleを削除し、formatPunctuationを追加
        const formatted = formatWithBreaks(formatPunctuation(sanitizeLatexEquation(item.equation)));
        
        let imageHtml = '';
        if (item.image_paths && item.image_paths.length > 0) {
            const gallery = document.createElement('div');
            gallery.className = 'problem-image-gallery';
            item.image_paths.forEach(path => {
                const img = document.createElement('img');
                img.src = path;
                img.className = 'problem-image';
                img.alt = '類題の図';
                gallery.appendChild(img);
            });
            imageHtml = gallery.outerHTML;
        }

        const block = document.createElement("div");
        block.classList.add("similar-block");
        block.innerHTML = `<h4>類題 ${idx + 1}</h4><p>単元：${item.unit_name}</p><p>問題番号：${numberLabel}</p><p>難易度：${difficulty}</p><div class="tex2jax_process">${formatted}</div>${imageHtml}`;
        container.appendChild(block);
      });

      MathJax.typesetPromise([container]);
    })
    .catch(err => {
      container.innerHTML = "<p>類題の取得中にエラーが発生しました。</p>";
      console.error(err);
    });
};


// ===== メイン処理（ページのDOM読み込み完了時に実行） =====
document.addEventListener("DOMContentLoaded", () => {
  // --- アプリケーションの初期化 ---
  loadUnitOptionsFromJSON();
  setupAccordion();

  // --- グローバルに関数を登録 ---
  window.getProblem = (modeId) => {
    if (modeId === "1") getProblemFromAochart();
    else if (modeId === "2") getProblemFrom4step();
  };
  window.getSelectedProblem = getSelectedProblem;
  window.toggleProblemDetails = (modeId) => {
    const details = document.getElementById(`problem_details-${modeId}`);
    if (details) details.style.display = details.style.display === "none" ? "block" : "none";
  };
  window.toggleHistory = toggleHistory;

  // --- ナビゲーション処理 ---
  const navLinks = document.querySelectorAll(".nav-link");
  const menuToggleCheckbox = document.getElementById('menu-toggle');
  navLinks.forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const targetId = link.getAttribute("href").replace("#", "");
      document.querySelectorAll('.mode-section').forEach(sec => sec.style.display = 'none');
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.style.display = 'block';
      }
      navLinks.forEach(l => l.classList.remove('active'));
      e.currentTarget.classList.add('active');
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (menuToggleCheckbox) {
        menuToggleCheckbox.checked = false;
      }
    });
  });
  document.getElementById('aochart').style.display = 'block';

  // --- 選択モードの「前へ」「次へ」ボタンの処理 ---
  const prevBtn = document.getElementById('prev-problem-btn');
  const nextBtn = document.getElementById('next-problem-btn');
  const numberInput = document.getElementById('problem_number_input');
  prevBtn?.addEventListener('click', () => {
      let num = parseInt(numberInput.value, 10);
      if (isNaN(num) || num <= 1) return;
      numberInput.value = num - 1;
      getSelectedProblem();
  });
  nextBtn?.addEventListener('click', () => {
      let num = parseInt(numberInput.value, 10);
      numberInput.value = isNaN(num) ? 1 : num + 1;
      getSelectedProblem();
  });

  // --- AI類題生成機能のイベントリスナー設定 ---
  const generateBtn = document.getElementById('generate-ai-problem-btn');
  const aiProblemArea = document.getElementById('ai-generated-problem-area');
  const aiProblemContainer = document.getElementById('ai-problem-container');
  const answerBtn = document.getElementById('ai-answer-btn');
  const answerContainer = document.getElementById('ai-answer-container');
  const dbSimilarContainer = document.getElementById('similar_container-selected');
  let aiGeneratedData = {};
  let aiGeneratedHistory = [];
  let currentOriginalProblemForAI = null;

  if (generateBtn) {
      generateBtn.addEventListener('click', async () => {
          const originalProblem = window.RANDOMLY_APP_DATA;
          if (!originalProblem || !originalProblem.equation) {
              alert('元となる問題データが見つかりません。問題を選択し直してください。');
              return;
          }
          if (currentOriginalProblemForAI !== originalProblem.equation) {
              aiGeneratedHistory = [];
              currentOriginalProblemForAI = originalProblem.equation;
          }
          if (dbSimilarContainer) dbSimilarContainer.style.display = 'none';
          
          generateBtn.disabled = true;
          generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
          aiProblemArea.style.display = 'block'; 
          aiProblemContainer.innerHTML = '<p>AIが類題を生成しています...</p>';
          answerBtn.style.display = 'none';
          answerContainer.style.display = 'none';

          try {
              const response = await fetch('/generate_similar_problem', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      problem_text: originalProblem.equation,
                      history: aiGeneratedHistory
                  }),
              });
              const result = await response.json();
              if (!response.ok || result.error) throw new Error(result.error || 'サーバーエラーが発生しました。');
              
              // ★修正：applyDisplayStyleを削除し、formatPunctuationを追加
              const formattedProblem = formatWithBreaks(formatPunctuation(sanitizeLatexEquation(result.problem)));
              aiProblemContainer.innerHTML = `<div class="tex2jax_process">${formattedProblem}</div>`;
              MathJax.typesetPromise([aiProblemContainer]);

              aiGeneratedData = { answer: result.answer, explanation: result.explanation };
              aiGeneratedHistory.push(result.problem);
              answerBtn.style.display = 'inline-block';

          } catch (error) {
              alert(`エラー: ${error.message}`);
              aiProblemContainer.innerHTML = '<p>エラーが発生しました。</p>';
          } finally {
              generateBtn.disabled = false;
              generateBtn.innerHTML = '<i class="fas fa-magic"></i> AIで類題を作る';
          }
      });
  }

  if (answerBtn) {
      answerBtn.addEventListener('click', () => {
          if (aiGeneratedData.answer && aiGeneratedData.explanation) {
              // ★修正：applyDisplayStyleを削除し、formatPunctuationを追加
              const formattedAnswer = formatWithBreaks(formatPunctuation(sanitizeLatexEquation(aiGeneratedData.answer)));
              const formattedExplanation = formatWithBreaks(formatPunctuation(sanitizeLatexEquation(aiGeneratedData.explanation)));
              answerContainer.innerHTML = `<h4>答え</h4><div class="tex2jax_process">${formattedAnswer}</div><hr><h4>解説</h4><div class="tex2jax_process">${formattedExplanation}</div>`;
              answerContainer.style.display = 'block';
              MathJax.typesetPromise([answerContainer]);
              answerBtn.style.display = 'none';
          }
      });
  }
});
