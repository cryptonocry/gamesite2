// ui.js
import { fetchAllParticipantsFromXano } from "./api.js";

export async function showRecordsOverlay(recordsTableContainer, recordsContainer, currentPlayer) {
  const records = await fetchAllParticipantsFromXano();
  if (!records || records.length === 0) {
    recordsTableContainer.innerHTML = "No records found.";
    recordsContainer.style.display = "block";
    return;
  }
  records.sort((a, b) => b.score - a.score);
  let html = "<table><tr><th>#</th><th>Wallet</th><th>Score</th></tr>";
  records.forEach((rec, i) => {
    const rank = i + 1;
    const highlight = currentPlayer && rec.wallet === currentPlayer.wallet
      ? "id='currentPlayerRow'" : "";
    html += `
      <tr ${highlight}>
        <td>${rank}</td>
        <td>${rec.wallet}</td>
        <td>${rec.score}</td>
      </tr>
    `;
  });
  html += "</table>";
  recordsTableContainer.innerHTML = html;
  recordsContainer.style.display = "block";
  setTimeout(() => {
    const row = document.getElementById("currentPlayerRow");
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
}
