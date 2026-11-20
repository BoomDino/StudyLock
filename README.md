# StudyLock

[**Visit the StudyLock landing page →**](https://boomdino.github.io/StudyLock/)

StudyLock is a small Chrome and Chromium extension that helps you make room for study before opening Crunchyroll. It blocks Crunchyroll by default, lets you submit one daily study report during a schedule you choose, then grants a limited viewing session based on the amount of time you studied.

## What it does

- Set a personal minimum daily study duration and the opening and closing times for reports.
- Enter study time manually as `HH:MM` or `HH:MM:SS`.
- Earn up to 30 minutes of Crunchyroll access, scaled to your study time relative to your chosen minimum.
- Pause access to stop the timer and lock Crunchyroll, then resume later with the remaining time.
- Apply lock and unlock changes to already-open Crunchyroll tabs without refreshing them.
- Store settings and report state locally in the browser.

StudyLock uses a smooth, piecewise-linear reward curve based on these reference points:

| Study completed toward your minimum | Access earned |
| --- | ---: |
| 0% | 0 minutes |
| 25% | 10 minutes |
| 50% | 20 minutes |
| 75% | 25 minutes |
| 100% or more | 30 minutes |

For example, if your minimum is 4 hours, studying 2 hours earns 20 minutes. If your minimum is 6 hours, studying 3 hours earns 20 minutes. The reward is capped at 30 minutes.

## Install

1. Download or clone this repository and keep the folder on your computer.
2. Open `chrome://extensions` in Chrome or a Chromium-based browser.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the StudyLock folder.
5. Pin StudyLock from the extensions menu for quick access.

After pulling an update, select **Reload** for StudyLock on `chrome://extensions`.

## Use

1. Open the StudyLock popup and set your minimum study time and reporting window. The defaults are 4 hours and 5:00 PM–12:00 AM local time.
2. During the reporting window, enter your study duration as `HH:MM` or `HH:MM:SS`, then submit it.
3. Use **Pause access** and **Resume access** to choose when to spend the time you earned.

You can submit one report per local calendar day. The countdown starts when you submit, but you can pause it immediately. Your access expires when the earned time runs out; reporting becomes available again during the next eligible daily window.

## Scope and limitations

This version restricts Crunchyroll (`crunchyroll.com` and its subdomains). It uses browser request blocking for new navigations and a page overlay for tabs that are already open. Browser extensions cannot prevent someone with access to browser settings or developer tools from disabling or removing the extension.

## Privacy

StudyLock stores your settings, report, and access timer in `chrome.storage.local`. It does not send study data to a server.
