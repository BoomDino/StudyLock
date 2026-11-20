const OVERLAY_ID = "studylock-access-overlay";

function showLockScreen() {
  if (document.getElementById(OVERLAY_ID)) return;
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.attachShadow({ mode: "open" }).innerHTML = `
    <style>
      :host { all: initial; }
      .cover { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; background: #101114; color: #f4f4f5; font: 16px/1.5 system-ui, sans-serif; text-align: center; }
      .card { max-width: 360px; padding: 32px; }
      h1 { margin: 0 0 10px; font-size: 25px; }
      p { margin: 0; color: #b4b4be; }
    </style>
    <div class="cover"><div class="card"><h1>Crunchyroll is locked</h1><p>Submit today’s study report or resume your paused access in StudyLock.</p></div></div>`;
  (document.documentElement || document).append(overlay);
}

function removeLockScreen() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function applyState(state) {
  if (state.isBlocked || state.isPaused || (!state.unlockUntil && !state.remainingMs)) showLockScreen();
  else removeLockScreen();
}

chrome.runtime.sendMessage({ type: "GET_STATUS" }).then(applyState).catch(() => showLockScreen());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !["isBlocked", "unlockUntil", "pausedRemainingMs"].some((key) => key in changes)) return;
  chrome.runtime.sendMessage({ type: "GET_STATUS" }).then(applyState).catch(() => showLockScreen());
});
