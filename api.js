// api.js

// База твоего Xano API
const BASE = "https://x8ki-letl-twmt.n7.xano.io/api:7fuLzq6k";

// Leaderboard (как было)
const XANO_GET_URL    = `${BASE}/gamerecords_get`;

// Сессия старта и отправка результата (реальные эндпоинты)
const XANO_START_URL  = `${BASE}/start`;
const XANO_SUBMIT_URL = `${BASE}/gamerecords_post`;

// ===== Leaderboard =====
export async function fetchAllParticipantsFromXano() {
  try {
    const resp = await fetch(XANO_GET_URL);
    return await resp.json();
  } catch (e) {
    console.error("Error fetching data from Xano:", e);
    return [];
  }
}

// ===== Secure flow (Light) =====
export async function startSession(wallet) {
  try {
    const resp = await fetch(XANO_START_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: wallet || null })
    });
    if (!resp.ok) throw new Error("start failed");
    const data = await resp.json();
    // Вернём объект в твоём прежнем формате, чтобы остальной код не менять
    return {
      sessionId: data.id,        // маппим id -> sessionId
      token: data.token,
      createdAt: data.created_at, // мс
      issuedAt: data.issued_at,   // дата (если нужна)
      used: data.used,
      wallet: data.wallet,
      ip: data.ip
    };
  } catch (e) {
    console.error("startSession error:", e);
    return null;
  }
}

export async function submitScore(session, score, wallet) {
  try {
    // Xano ждёт только token/score/wallet — sessionId НЕ отправляем
    const resp = await fetch(XANO_SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: session?.token,
        wallet: wallet || null,
        score
      })
    });

    // Если на сервере Throw Error — тут может быть не-JSON
    let data;
    try { data = await resp.json(); } catch { data = await resp.text(); }

    if (!resp.ok) {
      console.error("submitScore failed:", data);
      return null;
    }
    return data;
  } catch (e) {
    console.error("submitScore error:", e);
    return null;
  }
}
