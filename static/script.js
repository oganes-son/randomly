/**
 * script.js
 * このアプリケーション全体の動作を制御する司令塔となるメインのJavaScriptファイルです。
 * - 各モードの専用JSファイルをモジュールとして読み込みます。
 * - 全てのモードで共通して使われる機能（ナビゲーション、アコーディオン初期化など）を管理します。
 * - データベースからの類題表示機能、AIによる類題生成機能のイベント処理を担当します。
 */

// ===== モジュールの読み込み =====
import { getProblemFromAochart } from "/static/modes/random_aochart.js";
import { getProblemFrom4step } from "/static/modes/random_4step.js";
import { getSelectedProblem } from "/static/modes/selection.js";
import { setupAccordion } from "/static/components/accordion.js";
import { toggleHistory } from "/static/components/history.js";
import {
  formatDifficultyStars,
  applyDisplayStyle,
  formatWithBreaks,
  sanitizeLatexEquation
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
        // 既存の選択肢をクリア
        chartSelect.innerHTML = '';
        data.chart.forEach(unit => {
          const option = document.createElement("option");
          option.value = unit.label;
          option.textContent = `${unit.label}`; // レンジ表示はplaceholderで行うため、ここではラベルのみ
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
 * この関数はグローバルスコープ（window）に登録され、他のファイルからも呼び出せます。
 * @param {string} sourceMode - 呼び出し元のモード ('aochart', '4step', 'selection')
 * @param {string} unitName - 単元名
 * @param {string} problemNumber - 問題番号
 * @param {string} book - 問題集の種類 ('chart', 'ex')
 */
window.showSimilarProblems = function (sourceMode, unitName, problemNumber, book) {
  const modeId = sourceMode === "selection" ? "selected" : (sourceMode === "aochart" ? "1" : "2");
  const container = document.getElementById(`similar_container-${modeId}`);
  if (!container) return;

  // 選択モードの場合、AIが生成した問題のエリアを非表示にする
  if (sourceMode === 'selection') {
    const aiProblemArea = document.getElementById('ai-generated-problem-area');
    if(aiProblemArea) aiProblemArea.style.display = 'none';
  }
  
  // DB類題コンテナを表示して、読み込み中のメッセージを出す
  container.style.display = 'block';
  container.innerHTML = "<p>読み込み中...</p>";

  // バックエンドに類題をリクエスト
  fetch("/get_similar_problems", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_mode: sourceMode, unit: unitName, problem_number: problemNumber, book })
  })
    .then(res => res.json())
    .then(data => {
      container.innerHTML = ""; // 中身をリセット

      if (!data.similar_problems || data.similar_problems.length === 0) {
        container.innerHTML = "<p>類題は見つかりませんでした。</p>";
        return;
      }
      
      // 取得した類題を一つずつ表示
      data.similar_problems.forEach((item, idx) => {
        const difficulty = item.book === "4step" ? item.difficulty : formatDifficultyStars(item.difficulty);
        const numberLabel = item.book === "ex" ? `EXERCISES ${item.problem_number}` : item.problem_number;
        const formatted = applyDisplayStyle(formatWithBreaks(sanitizeLatexEquation(item.equation)));
        const block = document.createElement("div");
        block.classList.add("similar-block");
        
        // ★追加：画像表示用のHTMLを条件付きで生成
        let imageHtml = '';
        if (item.image_path) {
            imageHtml = `<img src="${item.image_path}" class="problem-image" alt="類題の図">`;
        }

        block.innerHTML = `
          <h4>類題 ${idx + 1}</h4>
          <p>単元：${item.unit_name}</p>
          <p>問題番号：${numberLabel}</p>
          <p>難易度：${difficulty}</p>
          <div class="tex2jax_process">${formatted}</div>
          ${imageHtml} 
          <hr>
        `; // ★修正：生成した画像HTMLを挿入
        container.appendChild(block);
      });

      MathJax.typesetPromise([container]); // 数式をレンダリング
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

  // --- グローバルに関数を登録し、HTMLから呼び出せるようにする ---
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


  // --- 上部ナビゲーションのモード切り替え処理 ---
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const targetId = link.getAttribute("href").replace("#", "");
      
      // 全てのモードセクションを一旦非表示にする
      document.querySelectorAll('.mode-section').forEach(sec => {
        sec.style.display = 'none';
      });
      // クリックされたリンクに対応するセクションだけを表示
      document.getElementById(targetId).style.display = 'block';
      
      // アクティブなナビゲーションリンクのスタイルを更新
      navLinks.forEach(l => l.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      // ページトップへスクロール
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  // 初期表示として「aochart」モードを表示
  document.getElementById('aochart').style.display = 'block';


  // --- AI類題生成機能のイベントリスナー設定 ---
  
  // 必要なHTML要素への参照を取得
  const generateBtn = document.getElementById('generate-ai-problem-btn');
  const aiProblemArea = document.getElementById('ai-generated-problem-area');
  const aiProblemContainer = document.getElementById('ai-problem-container');
  const answerBtn = document.getElementById('ai-answer-btn');
  const answerContainer = document.getElementById('ai-answer-container');
  const dbSimilarContainer = document.getElementById('similar_container-selected');
  
  // AI生成に関する状態を管理する変数
  let aiGeneratedData = {}; // 現在表示中のAI問題の答えと解説を保持
  let aiGeneratedHistory = []; // 生成されたAI類題の履歴（問題文の配列）
  let currentOriginalProblemForAI = null; // 現在AI生成の「元」となっている問題文

  // 「AIで類題を作る」ボタンがクリックされた時の処理
  if (generateBtn) {
      generateBtn.addEventListener('click', async () => {
          // selection.jsで設定されたグローバル変数から元の問題データを取得
          const originalProblem = window.RANDOMLY_APP_DATA;
          if (!originalProblem || !originalProblem.equation) {
              alert('元となる問題データが見つかりません。問題を選択し直してください。');
              return;
          }

          // 元の問題が変わったかチェック
          if (currentOriginalProblemForAI !== originalProblem.equation) {
              // 元の問題が変わった場合、AIの生成履歴をリセット
              aiGeneratedHistory = [];
              currentOriginalProblemForAI = originalProblem.equation;
          }

          // DB類題コンテナが表示されていれば非表示にする
          if (dbSimilarContainer) dbSimilarContainer.style.display = 'none';
          
          // UIを「生成中」の状態にする
          generateBtn.disabled = true;
          generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
          aiProblemArea.style.display = 'block'; 
          aiProblemContainer.innerHTML = '<p>AIが類題を生成しています...</p>';
          answerBtn.style.display = 'none';
          answerContainer.style.display = 'none';

          try {
              // バックエンドにこれまでの生成履歴も送信
              const response = await fetch('/generate_similar_problem', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      problem_text: originalProblem.equation,
                      history: aiGeneratedHistory // 履歴の配列を渡す
                  }),
              });

              const result = await response.json();
              if (!response.ok || result.error) throw new Error(result.error || 'サーバーエラーが発生しました。');
              
             // ★★★修正：AIが生成した問題文も、ヘルパー関数を使って整形する★★★
              const rawProblem = sanitizeLatexEquation(result.problem);
              const formattedProblem = applyDisplayStyle(formatWithBreaks(rawProblem));
              aiProblemContainer.innerHTML = `<div class="tex2jax_process">${formattedProblem}</div>`;
              MathJax.typesetPromise([aiProblemContainer]);

              // 返ってきた答えと解説を保持
              aiGeneratedData = { answer: result.answer, explanation: result.explanation };
              
              // 今回生成した問題を履歴に追加
              aiGeneratedHistory.push(result.problem);
              
              // 「答えを見る」ボタンを表示
              answerBtn.style.display = 'inline-block';

          } catch (error) {
              alert(`エラー: ${error.message}`);
              aiProblemContainer.innerHTML = '<p>エラーが発生しました。</p>';
          } finally {
              // ボタンの「生成中」状態を解除
              generateBtn.disabled = false;
              generateBtn.innerHTML = '<i class="fas fa-magic"></i> AIで類題を作る';
          }
      });
  }

  // 「答えを見る」ボタンがクリックされた時の処理
  if (answerBtn) {
      answerBtn.addEventListener('click', () => {
          if (aiGeneratedData.answer && aiGeneratedData.explanation) {
              // 保持しておいた答えと解説を表示エリアに書き込む

              // ★★★修正：答えと解説も、ヘルパー関数を使って整形する★★★
              const formattedAnswer = applyDisplayStyle(formatWithBreaks(sanitizeLatexEquation(aiGeneratedData.answer)));
              const formattedExplanation = applyDisplayStyle(formatWithBreaks(sanitizeLatexEquation(aiGeneratedData.explanation)));

              answerContainer.innerHTML = `
                  <h4>答え</h4>
                  <div class="tex2jax_process">${formattedAnswer}</div>
                  <hr>
                  <h4>解説</h4>
                  <div class="tex2jax_process">${formattedExplanation}</div>
              `;
              answerContainer.style.display = 'block';
              MathJax.typesetPromise([answerContainer]);
              // 一度表示したらボタンは非表示にする
              answerBtn.style.display = 'none';
          }
      });
  }
});
