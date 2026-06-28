# slate user guide

Everything slate can do and how to use it. slate is a phone-driven Stream Deck for your Mac: the
phone shows a grid of buttons, you tap (or swipe / long-press) one, and a small macOS menu-bar helper
runs the action on your Mac. Local network only - no account, no cloud.

If you have not installed it yet, see the [README install steps](../README.md#install) first (download
the DMG + APK, drag the helper to Applications, clear quarantine).

Contents:

- [1. First connection and pairing](#1-first-connection-and-pairing)
- [2. Permissions on the Mac](#2-permissions-on-the-mac)
- [3. The deck screen](#3-the-deck-screen)
- [4. Buttons: add, edit, delete](#4-buttons-add-edit-delete)
- [5. Action reference (every command)](#5-action-reference-every-command)
- [6. Per-button gestures](#6-per-button-gestures)
- [7. Pages and decks](#7-pages-and-decks)
- [8. Live profile switching (auto-switch decks)](#8-live-profile-switching-auto-switch-decks)
- [9. Pairing, security, and devices](#9-pairing-security-and-devices)
- [10. Connection, discovery, and settings](#10-connection-discovery-and-settings)
- [11. The Mac helper menu](#11-the-mac-helper-menu)
- [12. Troubleshooting](#12-troubleshooting)

---

## 1. First connection and pairing

1. Make sure the Mac helper is running (menu-bar icon) and the phone is on the **same Wi-Fi**.
2. Open the app. On the home screen it scans for the Mac ("Scanning your Wi-Fi for the Mac..."). Tap
   the Mac when it appears, or use **Manual connection** and type the IP and port shown in the Mac
   menu (default port `8765`).
3. The app moves to the pairing screen. Tap **Pair**.
4. On the Mac menu, read the 6-digit code under **PAIRING CODE**. Type it on the phone and tap
   **Confirm**.
5. Done - the app jumps to the deck. The phone stores a per-device token, so it auto-connects next
   time without a code.

The code refreshes automatically about every 2 minutes; if it expires before you finish, just read
the new one. Five wrong codes locks pairing for 30 seconds (growing up to 5 minutes) - see
[section 9](#9-pairing-security-and-devices).

## 2. Permissions on the Mac

Some actions synthesize input and need macOS **Accessibility** permission; others do not.

| Needs Accessibility | Works without it |
| --- | --- |
| Keystroke, Space switch, Switch app, Activate app, media transport (Play/Pause, Next, Previous) | Launch app, volume (Vol +/-, Mute), AppleScript, Run Shortcut |

To grant it: open the Mac helper menu; if you see an orange "Accessibility off", tap **Grant** (opens
System Settings -> Privacy and Security -> Accessibility) and enable **slate helper**. Actions that
need it are greyed out in the button editor until it is granted. The grant persists across restarts.

Shell commands are a separate opt-in (off by default) - see [section 11](#11-the-mac-helper-menu).

## 3. The deck screen

- **Grid.** Your buttons, 4 columns x 6 rows in portrait (6 columns in landscape). A dashed `+` cell
  at the end adds a button.
- **Deck tabs** (top): one chip per deck; tap to switch. `+` adds a deck.
- **Page dots** (below the tabs): one dot per page; tap to switch. `+` adds a page.
- **Pencil** (top-right): toggles **edit mode** (reorder buttons). It becomes a checkmark; tap to
  exit.
- **Gear** (top-right): Settings (theme, logs, clear data).
- **Status pill** (top-left): green = Connected, orange = Reconnecting, gray = Offline.
- **Landscape:** rotate the phone and the top bar collapses into a left rail (status dot, deck name,
  page position like `2/5`, and edit/settings/disconnect). The grid widens to 6 columns.
- The deck screen **keeps the screen awake** for hands-free use.

## 4. Buttons: add, edit, delete

- **Add:** tap the `+` cell. The editor opens. Pick an action, then optionally set icon, label,
  color, and gestures. Tap **Save**.
- **Edit:** tap the pencil to enter edit mode, then tap a button (in view mode a tap *runs* the
  button). Change anything and **Save**.
- **Delete:** open the button in the editor, scroll down, tap **Delete**, confirm.
- **Reorder:** enter edit mode, hold a button (~0.2s) and drag; others rearrange live; release to
  drop. (Releasing immediately opens the editor instead.)

Each button has four parts:

- **Action** - what it does (see [section 5](#5-action-reference-every-command)). Required.
- **Icon** - one of:
  - **App**: tap "Choose app" to pick an installed Mac app; its real icon is used (and its name fills
    the label).
  - **Emoji**: type a single emoji.
  - **Glyph**: search a built-in icon set (Material Community Icons) by name (e.g. `play`, `gear`,
    `rocket`) and tap one.
  - If you set neither, slate auto-picks a sensible icon for the action (and a lettermark fallback).
- **Label** - optional text under the icon. Left blank, slate generates one from the action
  (e.g. `Cmd C`, `Play/Pause`, the app name).
- **Color** - `None` (theme default) or one of six tints: Red, Amber, Green, Blue, Purple, Pink.

## 5. Action reference (every command)

| Action | What it does | Options | Accessibility |
| --- | --- | --- | --- |
| **Launch app** | Open an app (or focus it if already running) | App name or bundle ID (use "Choose app") | No |
| **Activate app** | Bring an already-running app to the front | Bundle ID | Yes |
| **Quit app** | Quit an app (gesture slots only, not the primary tap) | Bundle ID | No |
| **Run Shortcut** | Run a Shortcuts.app shortcut | Exact shortcut name; optional Input text (piped to its "Receive input" step) | No |
| **AppleScript** | Run AppleScript | Script text (multiline ok) | No |
| **Shell** | Run a shell command (only if enabled on the Mac) | Command text | No (but opt-in) |
| **Media** | Transport + volume | Play/Pause, Next, Previous, Vol +, Vol -, Mute | Transport: Yes; volume: No |
| **Keystroke** | Send a key combo | Modifiers cmd/shift/option/control (combinable) + a key | Yes |
| **Space** | Switch Mission Control space | Next / Previous | Yes |
| **Switch app** | Cycle running apps | Next / Previous | Yes |
| **Macro** | Run several commands in order | Steps (any action except Macro) + optional per-step delay (ms) | Depends on steps |

Notes on the fiddly ones:

- **Keystroke key field:** a single letter `a`-`z`, digit `0`-`9`, function key `f1`-`f12`, or a named
  key: `left right up down home end pageup pagedown return enter tab space delete escape esc`. Example:
  modifiers `cmd` + key `c` = copy; `option` + `space` = Spotlight.
- **Space:** needs Mission Control's "Move left/right a space" shortcuts enabled on the Mac (System
  Settings -> Keyboard -> Keyboard Shortcuts -> Mission Control). slate sends Ctrl+Left / Ctrl+Right.
- **Switch app:** cycles running apps in a stable alphabetical order (more reliable than Cmd+Tab on
  newer macOS). Needs at least two regular apps open.
- **Macro:** steps run top to bottom; a step's delay waits before it runs; execution stops at the
  first failing step. Macros cannot contain macros. Good for "launch app, wait 500ms, send a
  keystroke".
- **Run Shortcut Input:** only used if the shortcut starts with a "Receive input" step; handy for
  passing a URL, query, or address.

## 6. Per-button gestures

Besides the primary **tap**, each button has optional gesture slots that each run their own command:

| Gesture | Trigger |
| --- | --- |
| Tap | quick press (up to ~250ms) - the primary action |
| Long press | hold >= 450ms |
| Double tap | two taps within 280ms |
| Swipe up / down / left / right | drag >= 36 points in that direction |

To assign one:

1. **Save the button first** (gestures cannot be added to an unsaved button).
2. Open the button in the editor and scroll to **Gestures**.
3. Tap a slot (e.g. "Long press"), choose an action, configure it, **Save**, then **Save** the
   button.

Notes:

- Any action can go on a gesture, including **Quit app** (which is gesture-only).
- A button with a swipe gesture **takes priority over page navigation** - swiping on it fires the
  gesture instead of changing pages.
- Gestures only fire in view mode (not while the edit pencil is on). Each gesture gives a haptic
  pulse.

## 7. Pages and decks

A **deck** is a set of **pages**; each page is a grid of buttons. Use multiple decks for different
contexts (e.g. one per app).

**Decks** (top tabs):

- **Switch:** tap a deck chip.
- **Create:** tap the `+` right of the last chip; the rename sheet opens for the new deck.
- **Rename / configure:** long-press a deck chip -> rename sheet (also has auto-switch, see
  [section 8](#8-live-profile-switching-auto-switch-decks)).
- **Delete:** in that sheet, tap **Delete** (only if you have 2+ decks), confirm. You cannot delete
  the last deck.

**Pages** (dots under the tabs):

- **Switch:** tap a dot.
- **Create:** tap the `+` after the last dot.
- **Delete:** long-press a dot, confirm (only if the deck has 2+ pages).

**Swipe navigation** (view mode only, off in edit mode):

- **One-finger** horizontal swipe (>= 48 pt) on the grid changes **page**.
- **Two-finger** horizontal swipe changes **deck**.
- Neither wraps past the first/last.

## 8. Live profile switching (auto-switch decks)

Bind a deck to a Mac app so the phone jumps to that deck automatically when the app comes to the
front.

1. Long-press the deck's chip to open its sheet.
2. Under **Auto-switch**, tap **Choose** (or **Change**), pick an app from the list, then **Save**.
3. Now, whenever that app becomes frontmost on the Mac, the phone switches to this deck and its first
   page.

To stop it, open the sheet and tap **Clear**. Notes: one app per deck; if two decks bind the same
app, the first in the tab order wins; needs the helper's live-state support and an active connection;
no Mac permission is required (foreground app is public info). You can still switch decks manually at
any time.

## 9. Pairing, security, and devices

- **Pairing** uses a 6-digit code shown on the Mac (see [section 1](#1-first-connection-and-pairing)).
  The code lasts 120 seconds and auto-regenerates; the Mac always shows a live one.
- **Lockout:** 5 wrong codes locks pairing, starting at 30 seconds and doubling up to 5 minutes.
  Spamming Pair does not reset it; a successful pair or restarting the helper does.
- **Token:** on success the phone stores a per-device bearer token (iOS Keychain). The Mac stores
  tokens in `~/Library/Application Support/slate-helper/devices.json` (owner-only). The token, not the
  code, authorizes every later command.
- **Re-pair** any time by tapping Pair again - this rotates the token (the old one stops working).
- **Revoke a device** from the Mac menu under **PAIRED DEVICES** -> **Revoke** -> **Confirm**. The
  device's token is deleted and its connection drops immediately; it must re-pair.
- **Clear all data** on the phone (Settings -> Data -> Clear all data) wipes decks, token, and saved
  connection. You will need to re-pair.

**Security posture (read this):** slate runs over plain `ws://` plus the bearer token on your local
network. Traffic is **not yet end-to-end encrypted**, so on an untrusted Wi-Fi it is open to
man-in-the-middle / replay. Keep the helper's port off untrusted networks; revoke + re-pair if you
suspect a token was exposed. Application-layer end-to-end encryption (code-authenticated X25519 +
ChaCha20-Poly1305) is the next roadmap item.

## 10. Connection, discovery, and settings

- **Auto-discovery:** on the home screen the app probes the last-known Mac, browses mDNS / Bonjour,
  and scans the local subnet. Tap a found Mac to connect. Requires the Local Network permission on
  iOS.
- **Manual connection:** enter the Mac's IP and port (default `8765`) and tap **Connect**.
- **Test connection:** probes a host:port before connecting. "Reachable" (ok), "No response - is the
  helper running?" (timeout), or "Connection refused - check the port".
- **Reconnect:** automatic with backoff (1s, 2s, ... up to 30s); a heartbeat ping every 5s detects a
  dead link within 10s. After repeated failures it rediscovers the Mac by name (so it follows the Mac
  to a new IP after a network change).
- **Disconnect:** the Disconnect control on the deck screen (top-right, or the left rail in
  landscape).
- **Settings** (gear icon):
  - **Appearance:** System, Light, or Dark.
  - **Logs:** errors/warnings (newest first), with Clear. Kept in memory only.
  - **Clear all data:** see [section 9](#9-pairing-security-and-devices).

## 11. The Mac helper menu

Click the slate icon in the menu bar:

- **Status:** green "Listening", orange "Starting...", or a red error (e.g. port in use).
- **Phone connects to:** the Mac's LAN IP and port (auto-detected, updates on network change).
- **Port:** type a value `1024`-`65535` and tap **Apply** to restart the listener on it.
- **Pairing code:** the live 6-digit code + countdown while pairing; the clipboard icon copies it.
- **Accessibility:** an orange warning + **Grant** if it is off (see
  [section 2](#2-permissions-on-the-mac)).
- **Open at login:** start the helper automatically when you log in.
- **Allow shell commands:** opt-in; when on, paired phones can run shell commands. Off by default -
  only enable if you trust every paired device. (Read live at run time; restart the helper so the
  phone's editor shows the Shell action.)
- **Paired devices:** each device with its name and pairing date, plus **Revoke**.
- **Logs:** recent errors/warnings with Clear.
- **Quit slate helper** (or Cmd+Q): stops the server and drops all connections.

## 12. Troubleshooting

- **macOS will not open the helper / "cannot be opened".** The DMG is self-signed, not notarized.
  Run once: `xattr -dr com.apple.quarantine /Applications/SlateHelper.app`, then open it.
- **Phone cannot find the Mac.** Confirm both are on the same Wi-Fi; allow the Local Network prompt
  on iOS; or use Manual connection with the IP/port from the Mac menu. Use Test connection to check
  reachability.
- **Keystroke / media / Spaces / Switch app do nothing.** Grant Accessibility to the helper
  (section 2). For Spaces, also enable the Mission Control "Move left/right a space" shortcuts on the
  Mac.
- **"Activate app" fails.** That action only focuses an already-running app; use **Launch app** to
  also start it.
- **The Shell action is missing in the editor.** Enable "Allow shell commands" on the Mac, then
  restart the helper.
- **Pairing says "locked".** Too many wrong codes - wait out the lockout (30s and up) or restart the
  helper.
- **Reconnects say "invalid token".** The device was revoked (or the token rotated). Tap Pair and
  enter a fresh code.
- **Android will not install the APK.** Allow installing from your browser/files app when prompted
  (install from unknown sources).
