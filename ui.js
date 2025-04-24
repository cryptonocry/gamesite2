import { fetchAllParticipantsFromXano } from "./api.js";

// Вариант без маскировки кошелька
export async function showRecordsOverlay(recordsTableContainer, recordsContainer, currentPlayer) {
  const records = await fetchAllParticipantsFromXano();
  if (!records || records.length === 0) {
    recordsTableContainer.innerHTML = "No records found.";
    recordsContainer.style.display = "block";
    return;
  }

  // 1) Сортируем по убыванию счёта
  records.sort((a, b) => b.score - a.score);

  // 2) Заголовок таблицы (#, BTC Wallet, Score)
  let html = "<table><tr><th>#</th><th>BTC Wallet</th><th>Score</th></tr>";

  // 3) Вывод строк
  records.forEach((rec, index) => {
    const rank = index + 1; // 1, 2, 3...
    let rowId = "";

    // Если это кошелёк текущего игрока — подсветим
    if (currentPlayer && rec.wallet === currentPlayer.wallet) {
      rowId = " id='currentPlayerRow'";
    }

    // Выводим кошелёк полностью (без звёздочек)
    html += `
      <tr${rowId}>
        <td>${rank}</td>
        <td>${rec.wallet}</td>
        <td>${rec.score}</td>
      </tr>
    `;
  });

  html += "</table>";
  recordsTableContainer.innerHTML = html;
  recordsContainer.style.display = "block";

  // Прокрутка к текущему игроку (если есть)
  setTimeout(() => {
    const row = document.getElementById("currentPlayerRow");
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 100);
}
