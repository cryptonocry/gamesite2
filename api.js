// api.js

// Leaderboard (как было)
const XANO_GET_URL  = "https://x8ki-letl-twmt.n7.xano.io/api:7fuLzq6k/gamerecords_get";

// NEW: сессия старта и отправка результата (замени на свои эндпойнты)
const XANO_START_URL  = "https://YOUR-XANO-BASE/api:XXXX/start";
const XANO_SUBMIT_URL = "https://YOUR-XANO-BASE/api:XXXX/submit";

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
    return await resp.json(); // { sessionId, token, issuedAt, ttl? }
  } catch (e) {
    console.error("startSession error:", e);
    return null;
  }
}

export async function submitScore(session, score, wallet) {
  try {
    const resp = await fetch(XANO_SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        token: session.token,
        wallet: wallet || null,
        score
      })
    });
    return await resp.json();
  } catch (e) {
    console.error("submitScore error:", e);
    return null;
  }
}
