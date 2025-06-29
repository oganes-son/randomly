import { setupAccordion } from "/static/components/accordion.js";
import {
  formatWithBreaks,
  sanitizeLatexEquation,
  applyDisplayStyle,
  formatDifficultyStars,
  getEquationSnippet
} from "../utils/helpers.js";

import { getProblemFrom4step } from "/static/modes/random_4step.js";
import { getSelectedProblem } from "/static/modes/selection.js";
import { toggleHistory } from "/static/components/history.js";

export function getProblemFromAochart() {
  const modeId = "1";

  const selectedUnits = Array.from(
    document.querySelectorAll(`#sidebar-${modeId} .unit-checkbox[data-value]:checked`)
  ).map(cb => cb.dataset.value);

  const selectedDifficulties = Array.from(
    document.querySelectorAll(`#difficult-${modeId} .unit-checkbox:checked`)
  ).map(cb => cb.dataset.difficulty);

  const book = document.querySelector(`input[name="book_select-${modeId}"]:checked`)?.value || "all";

  if (selectedUnits.length === 0) {
    document.getElementById(`error-message-${modeId}`).style.display = "block";
    return;
  } else {
    document.getElementById(`error-message-${modeId}`).style.display = "none";
  }

  const body = {
    units: selectedUnits,
    difficulties: selectedDifficulties,
    book: book
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

      // ✅ 類題コンテナ（選択中のものも含めすべて）をクリア
      ['similar_container-1', 'similar_container-2', 'similar_container-selected'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
      });

      const numberLabel = book === "ex"
        ? `EXERCISES ${data.problem_number}`
        : `${data.problem_number}`;

      document.getElementById(`unit_name-${modeId}`).innerText = data.unit_name;
      document.getElementById(`problem_number-${modeId}`).innerText = numberLabel;
      document.getElementById(`difficulty_level-${modeId}`).innerText = formatDifficultyStars(data.difficulty);

      const container = document.getElementById(`equation_container-${modeId}`);
      const raw = sanitizeLatexEquation(data.equation);
      const formatted = applyDisplayStyle(formatWithBreaks(raw));

      container.innerHTML = `<div class="tex2jax_process">${formatted}</div>`;
      MathJax.typesetPromise([container]);

      const table = document.getElementById(`history_table_body-${modeId}`);
      const row = document.createElement("tr");
      const index = table.rows.length + 1;
      const snippet = getEquationSnippet(data.equation);

      row.innerHTML = `
        <td>${index}</td>
        <td>${numberLabel}</td>
        <td><div class="tex2jax_process">${snippet}...</div></td>
      `;
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        container.innerHTML = `<div class="tex2jax_process">${formatted}</div>`;
        MathJax.typesetPromise([container]);
      });

      table.prepend(row);
      MathJax.typesetPromise([row]);

      // ✅ 類題数をリアル取得で確認し、ボタンに正しい値を反映
      fetch("/get_similar_problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_mode: "aochart",
          unit: data.unit_name,
          problem_number: data.problem_number,
          book: book
        })
      })
        .then(res => res.json())
        .then(result => {
          const btn = document.getElementById(`similar_button-${modeId}`);
          if (btn) {
            const count = result?.similar_problems?.length || 0;
            if (count > 0) {
              btn.style.display = "inline-block";
              btn.textContent = `類題を見る（${count}問）`;
              btn.onclick = () =>
                showSimilarProblems("aochart", data.unit_name, data.problem_number, book);
            } else {
              btn.style.display = "none";
            }
          }
        });
    })
    .catch(err => {
      console.error(err);
      alert("問題の取得に失敗しました。ログイン状態または通信をご確認ください。");
    });
}

document.addEventListener("DOMContentLoaded", () => {
  loadUnitOptionsFromJSON();
  setupAccordion();
  setupAccordion(document.getElementById("sidebar-1"));
  setupAccordion(document.getElementById("sidebar-2"));

  // ✅ 親スイッチクリック時のアコーディオン伝播防止（②）
  document.querySelectorAll('.parent-toggle-switch input[type="checkbox"]').forEach(input => {
    input.addEventListener('click', e => {
      e.stopPropagation();
    });
  });

  // ✅ 親→子 連動
  document.querySelectorAll(".unit-toggle").forEach(parent => {
    parent.addEventListener("change", () => {
      const targetId = parent.dataset.target;
      const container = document.getElementById(targetId);
      if (!container) return;

      const children = container.querySelectorAll(".unit-checkbox");
      children.forEach(cb => cb.checked = parent.checked);
    });
  });

  // ✅ 子→親 連動
  document.querySelectorAll(".unit-checkbox").forEach(child => {
    child.addEventListener("change", () => {
      const container = child.closest(".content");
      if (!container || !container.id) return;

      const all = container.querySelectorAll(".unit-checkbox");
      const parent = document.querySelector(`.unit-toggle[data-target='${container.id}']`);
      if (!parent) return;

      parent.checked = Array.from(all).every(cb => cb.checked);
    });
  });

  // その他関数の登録
  window.getProblem = (modeId) => {
    if (modeId === "1") {
      getProblemFromAochart();
    } else if (modeId === "2") {
      getProblemFrom4step();
    }
  };

  window.getSelectedProblem = getSelectedProblem;
  window.toggleProblemDetails = (modeId) => {
    const details = document.getElementById(`problem_details-${modeId}`);
    if (details) {
      details.style.display = details.style.display === "block" ? "none" : "block";
    }
  };

  window.toggleHistory = toggleHistory;
});

function loadUnitOptionsFromJSON() {
  fetch("/static/data/units.json")
    .then(res => res.json())
    .then(data => {
      const chartSelect = document.getElementById("unit_select_chart");
      data.chart?.forEach(unit => {
        const option = document.createElement("option");
        option.value = unit.label;
        option.textContent = `${unit.label} (${unit.range})`;
        chartSelect?.appendChild(option);
      });

      const exSelect = document.getElementById("unit_select_ex");
      data.ex?.forEach(unit => {
        const option = document.createElement("option");
        option.value = unit.label;
        option.textContent = `${unit.label} (${unit.range})`;
        exSelect?.appendChild(option);
      });
    })
    .catch(err => {
      console.error("単元データの読み込みに失敗しました：", err);
      alert("単元一覧の取得に失敗しました。");
    });
}
