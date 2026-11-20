const $ = (id) => document.getElementById(id);

function formatRemaining(milliseconds) {
  const total = Math.ceil(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

async function refresh() {
  const s = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  const active = !s.isBlocked && !s.isPaused && s.remainingMs > 0;
  const hasAccess = active || s.isPaused;
  $("statusDot").classList.toggle("open", active);
  $("statusTitle").textContent = s.isPaused ? "Access is paused" : active ? "Crunchyroll is unlocked" : "Crunchyroll is locked";
  $("statusText").textContent = hasAccess
    ? `${formatRemaining(s.remainingMs)} remaining${s.isPaused ? " · timer paused" : " · timer running"}`
    : "Your next unlock depends on today's study report.";
  $("accessControls").classList.toggle("hidden", !hasAccess);
  $("pause").classList.toggle("hidden", !active);
  $("resume").classList.toggle("hidden", !s.isPaused);

  $("minimum").value = (s.minimumStudySeconds || 14400) / 3600;
  $("opens").value = s.reportOpens || "17:00";
  $("closes").value = s.reportCloses || "00:00";
  if (s.canReport) {
    $("reportSection").classList.remove("hidden");
    $("waitSection").classList.add("hidden");
  } else {
    $("reportSection").classList.add("hidden");
    $("waitSection").classList.remove("hidden");
    if (s.reportedSeconds != null) {
      $("waitTitle").textContent = "Today's report is already submitted.";
      $("waitText").textContent = hasAccess ? `${formatRemaining(s.remainingMs)} remaining.` : "Your reward has ended. Come back during tomorrow's reporting window.";
    } else {
      $("waitTitle").textContent = "Reporting window is closed.";
      $("waitText").textContent = `Reports open ${s.reportOpens} and close ${s.reportCloses}.`;
    }
  }
}

$("saveSettings").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    minimumStudySeconds: Number($("minimum").value) * 3600,
    reportOpens: $("opens").value,
    reportCloses: $("closes").value
  });
  $("settingsMessage").textContent = result.ok ? "Settings saved." : result.error;
  if (result.ok) await refresh();
});

$("submit").addEventListener("click", async () => {
  $("submit").disabled = true;
  $("message").textContent = "";
  const result = await chrome.runtime.sendMessage({ type: "REPORT_STUDY", duration: $("duration").value });
  if (!result.ok) {
    $("message").textContent = result.error || "Could not submit.";
    $("submit").disabled = false;
    return;
  }
  $("message").textContent = `Report saved. ${formatDuration(result.rewardSeconds)} access earned.`;
  await refresh();
});

$("pause").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "PAUSE_ACCESS" });
  if (!result.ok) $("message").textContent = result.error;
  await refresh();
});

$("resume").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "RESUME_ACCESS" });
  if (!result.ok) $("message").textContent = result.error;
  await refresh();
});

refresh();
setInterval(() => {
  chrome.runtime.sendMessage({ type: "GET_STATUS" }).then((s) => {
    if (s.unlockUntil || s.isPaused) $("statusText").textContent = `${formatRemaining(s.remainingMs)} remaining${s.isPaused ? " · timer paused" : " · timer running"}`;
  }).catch(() => {});
}, 1000);
