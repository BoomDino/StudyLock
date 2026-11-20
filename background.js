const BLOCK_RULE_ID = 1;
const ALARM_NAME = "studylock-expire";
const DEFAULTS = {
  minimumStudySeconds: 4 * 60 * 60,
  reportOpens: "17:00",
  reportCloses: "00:00"
};

function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  return hours * 60 + minutes;
}

function isWithinReportingWindow(now, opens, closes) {
  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(opens);
  const end = timeToMinutes(closes);
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

function durationToSeconds(value) {
  const parts = String(value || "").trim().split(":");
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (parts.some((part) => !/^\d{1,2}$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((part) => part > 59)) return null;
  if (parts.length === 3 && numbers[2] > 59) return null;
  const [hours, minutes, seconds = 0] = numbers;
  return hours * 3600 + minutes * 60 + seconds;
}

// Linear interpolation through the illustrative 0/25/50/75/100% reward points.
function rewardSeconds(studiedSeconds, minimumSeconds) {
  const ratio = Math.min(1, studiedSeconds / minimumSeconds);
  const points = [[0, 0], [0.25, 600], [0.5, 1200], [0.75, 1500], [1, 1800]];
  for (let i = 1; i < points.length; i++) {
    const [rightX, rightY] = points[i];
    if (ratio <= rightX) {
      const [leftX, leftY] = points[i - 1];
      return Math.round(leftY + (ratio - leftX) / (rightX - leftX) * (rightY - leftY));
    }
  }
  return 1800;
}

async function setBlocked(blocked) {
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: blocked ? [{
      id: BLOCK_RULE_ID,
      priority: 1,
      action: { type: "block" },
      condition: { requestDomains: ["crunchyroll.com"], resourceTypes: ["main_frame"] }
    }] : [],
    removeRuleIds: [BLOCK_RULE_ID]
  });
  await chrome.storage.local.set({ isBlocked: blocked });
}

async function statusAndEnforce() {
  const data = await chrome.storage.local.get(["dayKey", "unlockUntil", "pausedRemainingMs", "reportedSeconds"]);
  const today = localDayKey();
  if (data.dayKey !== today) {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.storage.local.set({ dayKey: today, reportedSeconds: null, unlockUntil: null, pausedRemainingMs: null, rewardSeconds: 0 });
    await setBlocked(true);
    return;
  }
  if (data.pausedRemainingMs !== null && data.pausedRemainingMs !== undefined) {
    await chrome.alarms.clear(ALARM_NAME);
    await setBlocked(true);
  } else if (data.unlockUntil && Date.now() < data.unlockUntil) {
    await setBlocked(false);
    chrome.alarms.create(ALARM_NAME, { when: data.unlockUntil });
  } else {
    await chrome.alarms.clear(ALARM_NAME);
    if (data.unlockUntil) await chrome.storage.local.set({ unlockUntil: null, rewardSeconds: 0 });
    await setBlocked(true);
  }
}

async function getCurrentStatus() {
  await statusAndEnforce();
  const data = await chrome.storage.local.get([
    "dayKey", "reportedSeconds", "unlockUntil", "pausedRemainingMs", "rewardSeconds", ...Object.keys(DEFAULTS)
  ]);
  const now = new Date();
  const canReport = isWithinReportingWindow(now, data.reportOpens || DEFAULTS.reportOpens, data.reportCloses || DEFAULTS.reportCloses) &&
    (data.dayKey !== localDayKey() || data.reportedSeconds == null);
  const remainingMs = data.pausedRemainingMs ?? (data.unlockUntil ? Math.max(0, data.unlockUntil - Date.now()) : 0);
  return { ...data, today: localDayKey(), canReport, remainingMs, isPaused: data.pausedRemainingMs != null, isBlocked: !data.unlockUntil || data.pausedRemainingMs != null || data.unlockUntil <= Date.now() };
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULTS));
  await chrome.storage.local.set(Object.fromEntries(Object.entries(DEFAULTS).filter(([key]) => current[key] === undefined)));
  await statusAndEnforce();
});
chrome.runtime.onStartup.addListener(statusAndEnforce);
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM_NAME) void statusAndEnforce(); });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "GET_STATUS") return getCurrentStatus();

    if (message?.type === "SAVE_SETTINGS") {
      const minimum = Number(message.minimumStudySeconds);
      const opens = String(message.reportOpens || "");
      const closes = String(message.reportCloses || "");
      if (!Number.isFinite(minimum) || minimum < 60 || minimum > 24 * 60 * 60 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(opens) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(closes)) {
        return { ok: false, error: "Enter a minimum from 1 minute to 24 hours and valid opening and closing times." };
      }
      await chrome.storage.local.set({ minimumStudySeconds: minimum, reportOpens: opens, reportCloses: closes });
      return { ok: true };
    }

    if (message?.type === "REPORT_STUDY") {
      const now = new Date();
      const today = localDayKey();
      const data = await chrome.storage.local.get(["dayKey", "reportedSeconds", ...Object.keys(DEFAULTS)]);
      if (!isWithinReportingWindow(now, data.reportOpens || DEFAULTS.reportOpens, data.reportCloses || DEFAULTS.reportCloses)) {
        return { ok: false, error: `Reporting is open from ${data.reportOpens || DEFAULTS.reportOpens} to ${data.reportCloses || DEFAULTS.reportCloses}.` };
      }
      if (data.dayKey === today && data.reportedSeconds != null) return { ok: false, error: "You have already submitted today's study report." };
      const studiedSeconds = durationToSeconds(message.duration);
      if (studiedSeconds === null) return { ok: false, error: "Enter study time as HH:MM or HH:MM:SS." };
      const reward = rewardSeconds(studiedSeconds, data.minimumStudySeconds || DEFAULTS.minimumStudySeconds);
      const unlockUntil = reward > 0 ? Date.now() + reward * 1000 : null;
      await chrome.storage.local.set({ dayKey: today, reportedSeconds: studiedSeconds, rewardSeconds: reward, unlockUntil, pausedRemainingMs: null });
      if (unlockUntil) {
        await setBlocked(false);
        chrome.alarms.create(ALARM_NAME, { when: unlockUntil });
      } else await setBlocked(true);
      return { ok: true, studiedSeconds, rewardSeconds: reward, unlockUntil };
    }

    if (message?.type === "PAUSE_ACCESS" || message?.type === "RESUME_ACCESS") {
      const data = await chrome.storage.local.get(["unlockUntil", "pausedRemainingMs"]);
      if (message.type === "PAUSE_ACCESS") {
        if (!data.unlockUntil || data.unlockUntil <= Date.now()) return { ok: false, error: "There is no active access time to pause." };
        await chrome.storage.local.set({ pausedRemainingMs: data.unlockUntil - Date.now(), unlockUntil: null });
        await chrome.alarms.clear(ALARM_NAME);
        await setBlocked(true);
      } else {
        if (data.pausedRemainingMs == null || data.pausedRemainingMs <= 0) return { ok: false, error: "There is no paused access time to resume." };
        const unlockUntil = Date.now() + data.pausedRemainingMs;
        await chrome.storage.local.set({ unlockUntil, pausedRemainingMs: null });
        await setBlocked(false);
        chrome.alarms.create(ALARM_NAME, { when: unlockUntil });
      }
      return { ok: true };
    }
    return { error: "Unknown request." };
  })().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
