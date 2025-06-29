import {
  formatWithBreaks,
  sanitizeLatexEquation,
  applyDisplayStyle,
  formatDifficultyStars,
  getEquationSnippet
} from "../utils/helpers.js";

export function getProblemFrom4step() {
  const modeId = "2";

  const selectedUnits = Array.from(
    document.querySelectorAll(`#sidebar-${modeId} .unit-checkbox[data-value]:checked`)
  ).map(cb => cb.dataset.value);

  const selectedDifficulties = Array.from(
    document.querySelectorAll(`#difficult-${modeId} .unit-checkbox:checked`)
  ).map(cb => cb.dataset.difficulty);

  if (selectedUnits.length === 0) {
    document.getElementById(`error-message-${modeId}`).style.display = "block";
    return;
  } else {
    document.getElementById(`error-message-${modeId}`).style.display = "none";
  }

  const body = {
    units: selectedUnits,
    difficulties: selectedDifficulties
  };

  fetch("/get_problem_4step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
        return;
      }

      // ✅ 類題の前回表示をクリア（全コンテナ）
      ['similar_container-1', 'similar_container-2', 'similar_container-selected'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
      });

      const unitName = data.unit_name;
      const problemNumber = data.problem_number;

      document.getElementById(`unit_name-${modeId}`).innerText = unitName;
      document.getElementById(`problem_number-${modeId}`).innerText = problemNumber;
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
        <td>${problemNumber}</td>
        <td><div class="tex2jax_process">${snippet}...</div></td>
      `;
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        container.innerHTML = `<div class="tex2jax_process">${formatted}</div>`;
        MathJax.typesetPromise([container]);
      });

      table.prepend(row);
      MathJax.typesetPromise([row]);

      // ✅ 類題数のリアル取得でボタン更新
      fetch("/get_similar_problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_mode: "4step",
          unit: unitName,
          problem_number: problemNumber,
          book: "4step"
        })
      })
        .then(res => res.json())
        .then(result => {
          const btn = document.getElementById(`similar_button-${modeId}`);
          const count = result?.similar_problems?.length || 0;
          if (btn) {
            if (count > 0) {
              btn.style.display = "inline-block";
              btn.textContent = `類題を見る（${count}問）`;
              btn.onclick = () =>
                showSimilarProblems("4step", unitName, problemNumber, "4step");
            } else {
              btn.style.display = "none";
            }
          }
        });
    })
    .catch(err => {
      console.error(err);
      alert("問題の取得中にエラーが発生しました。");
    });
}

// ✅ アコーディオン初期化＆スイッチ連動処理
document.addEventListener("DOMContentLoaded", () => {

  // アコーディオンが親スイッチで開閉しないようにする
  document.querySelectorAll('.parent-toggle-switch input[type="checkbox"]').forEach(input => {
    input.addEventListener('click', e => {
      e.stopPropagation();
    });
  });

  // 親スイッチ → 子スイッチ連動
  document.querySelectorAll(".unit-toggle").forEach(parent => {
    parent.addEventListener("change", () => {
      const targetId = parent.dataset.target;
      const container = document.getElementById(targetId);
      if (!container) return;
      const children = container.querySelectorAll(".unit-checkbox");
      children.forEach(cb => cb.checked = parent.checked);
    });
  });

  // 子スイッチ → 親スイッチ連動
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
});
