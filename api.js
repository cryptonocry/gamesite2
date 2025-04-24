// api.js
const XANO_GET_URL  = "https://x8ki-letl-twmt.n7.xano.io/api:7fuLzq6k/gamerecords_get";
const XANO_POST_URL = "https://x8ki-letl-twmt.n7.xano.io/api:7fuLzq6k/gamerecords_post";

export async function addParticipantToXano(wallet, score) {
  try {
    const resp = await fetch(XANO_POST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, score })
    });
    return await resp.json();
  } catch (e) {
    console.error("Error sending data to Xano:", e);
    return null;
  }
}

export async function fetchAllParticipantsFromXano() {
  try {
    const resp = await fetch(XANO_GET_URL);
    return await resp.json();
  } catch (e) {
    console.error("Error fetching data from Xano:", e);
    return [];
  }
}
