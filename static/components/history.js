export function addProblemToHistory(modeId, problem) {
  const tableBody = document.getElementById(`history_table_body-${modeId}`);
  if (!tableBody || !problem) return;

  const tr = document.createElement("tr");

  const idTd = document.createElement("td");
  idTd.textContent = tableBody.children.length + 1;

  const numTd = document.createElement("td");
  numTd.textContent = problem.problem_number || "-";

  const contentTd = document.createElement("td");
  contentTd.textContent = extractTextFromHTML(problem.equation || "").slice(0, 30);

  const actionTd = document.createElement("td");
  const button = document.createElement("button");
  button.textContent = "再表示";
  button.className = "replay-button";
  button.addEventListener("click", () => {
    // ここに再表示の動作を入れる：MathJax再描画など
    const container = document.getElementById(`equation_container-${modeId}`);
    if (container) {
      container.innerHTML = problem.equation || "(式なし)";
      if (window.MathJax?.typesetPromise) {
        MathJax.typesetPromise([container]);
      }
    }

    // 問題詳細の表示エリアにも反映（あれば）
    const unit = document.getElementById(`unit_name-${modeId}`);
    const number = document.getElementById(`problem_number-${modeId}`);
    const diff = document.getElementById(`difficulty_level-${modeId}`);

    if (unit) unit.textContent = problem.unit || "-";
    if (number) number.textContent = problem.problem_number || "-";
    if (diff) diff.textContent = problem.difficulty || "-";
  });

  actionTd.appendChild(button);

  tr.appendChild(idTd);
  tr.appendChild(numTd);
  tr.appendChild(contentTd);
  tr.appendChild(actionTd);

  tableBody.appendChild(tr);
}

export function toggleHistory(modeId) {
  const section = document.getElementById(`history_section-${modeId}`);
  if (section) {
    section.style.display = section.style.display === "block" ? "none" : "block";
  }
}

function extractTextFromHTML(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}
