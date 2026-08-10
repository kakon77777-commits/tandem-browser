// zh-TW (Traditional Chinese) translation dictionary for the Tandem shell.
// One file per language (see shell/js/i18n.js's module comment for why) —
// loaded via its own <script src="js/i18n/zh-TW.js"> tag, which MUST appear
// BEFORE <script src="js/i18n.js"> in every shell HTML document, so
// window.__TANDEM_I18N_DICTS__['zh-TW'] exists when i18n.js's IIFE runs.
//
// Keyed by the exact (trimmed) English source text — see i18n.js for how
// matching works and for the t(key, params) interpolation form used by a
// handful of entries below (keys containing {name}-style placeholders).
// Organized by which shell page/section a string comes from purely to keep
// this file navigable; the lookup itself is one flat namespace.

window.__TANDEM_I18N_DICTS__ = window.__TANDEM_I18N_DICTS__ || {};
window.__TANDEM_I18N_DICTS__['zh-TW'] = {
  // ─── index.html: region capture / recording overlay ───
  'Drag to capture a region inside Tandem. Press Esc to cancel.': '拖曳以擷取 Tandem 內的區域，按 Esc 取消。',
  'Toggle microphone': '切換麥克風',
  '🎤 On': '🎤 開啟',
  '🎤 Off': '🎤 關閉',
  'Stop recording (Esc)': '停止錄製（Esc）',
  '■ Stop': '■ 停止',

  // ─── index.html: tab bar / window controls ───
  'Menu': '選單',
  // shortcut-labels.js (loaded later, but async platform-detect races
  // against our own async config load) may rewrite Cmd+X/⌘X to Ctrl+X
  // (non-mac) before we ever see the original — every shortcut-bearing
  // string below needs both forms, see i18n.js module comment.
  'New tab (Cmd+T)': '開新分頁（Cmd+T）',
  'New tab (Ctrl+T)': '開新分頁（Ctrl+T）',
  'Minimize': '最小化',
  'Maximize': '最大化',
  'Close': '關閉',

  // ─── index.html: navigation toolbar (source strings are Dutch —
  // pre-existing, unrelated to i18n; keyed on the literal text so the
  // TreeWalker can still match it) ───
  'Terug': '上一頁',
  'Vooruit': '前進',
  'Herladen': '重新整理',
  'Search or enter URL...': '搜尋或輸入網址…',
  'Bookmark (⌘D)': '加入書籤（⌘D）',
  'Bookmark (Ctrl+D)': '加入書籤（Ctrl+D）',
  'Screenshot (⌘⇧S)': '截圖（⌘⇧S）',
  'Screenshot (Ctrl+Shift+S)': '截圖（Ctrl+Shift+S）',
  'Extensions': '擴充功能',
  'Connected to Wingman API': '已連線至 Wingman API',

  // ─── index.html: bookmark popup ───
  'Bookmark': '書籤',
  'Name': '名稱',
  'Page title': '頁面標題',
  'Folder': '資料夾',
  'Remove': '移除',
  'Cancel': '取消',
  'Save': '儲存',

  // ─── index.html: sidebar ───
  'Collapse': '收合',
  'Customize': '自訂',
  'Tips & Tutorials': '提示與教學',
  'Reload': '重新整理',
  'Pin panel': '釘選面板',

  // ─── index.html: find bar ───
  'Find on page...': '在頁面中尋找…',
  'Previous': '上一個',
  'Next': '下一個',
  'Close (Esc)': '關閉（Esc）',

  // ─── index.html: draw toolbar ───
  'Arrow': '箭頭',
  'Rectangle': '矩形',
  'Circle': '圓形',
  'Freehand': '手繪',
  'Text': '文字',
  'Annotate — box a region and attach a message': '標註 — 框選區域並附加訊息',
  'Red': '紅',
  'Yellow': '黃',
  'Green': '綠',
  'Blue': '藍',
  'Clear': '清除',
  '📸 Snap for Wingman': '📸 為 Wingman 擷取畫面',

  // ─── index.html: voice indicator ───
  '🎙️ Listening...': '🎙️ 聆聽中…',

  // ─── index.html: onboarding overlay ───
  '👋 Welcome to Tandem Browser': '👋 歡迎使用 Tandem Browser',
  'You + Wingman = browse together. You drive, Wingman watches and helps.': '你 + Wingman = 一起瀏覽。你操作，Wingman 在旁觀察並協助。',
  'Open Wingman Panel': '開啟 Wingman 面板',
  '📸 Screenshots & Annotations': '📸 截圖與標註',
  'Draw on the page and take screenshots for Wingman.': '在頁面上繪圖，並為 Wingman 拍攝截圖。',
  'Draw Mode': '繪圖模式',
  'Screenshot': '截圖',
  '🎙️ Voice Input': '🎙️ 語音輸入',
  'Talk to Wingman with your voice.': '用你的聲音與 Wingman 對話。',
  'Start Voice Input': '開始語音輸入',
  '🚀 Ready to get started!': '🚀 準備好開始了！',
  'All shortcuts are in the menu (⌘?) if you need them.': '所有快捷鍵都在選單（⌘?）中，需要時可以查看。',
  'All shortcuts are in the menu (Ctrl+?) if you need them.': '所有快捷鍵都在選單（Ctrl+?）中，需要時可以查看。',
  'Skip': '略過',

  // ─── index.html: password vault ───
  '🔒 Password Vault': '🔒 密碼保險箱',
  'Master password is required to decrypt your local vault. No data is ever synced to the cloud.': '需要主控密碼才能解密本機保險箱。資料絕不會同步至雲端。',
  'Master Password': '主控密碼',
  'Unlock Vault': '解鎖保險箱',
  'Vault Unlocked': '保險箱已解鎖',
  'You can now autofill and generate passwords using the right-click context menu on any login field.': '你現在可以在任何登入欄位使用右鍵選單自動填入與產生密碼。',
  'Lock Vault': '鎖定保險箱',
  'Password Vault': '密碼保險箱',

  // ─── index.html: Wingman panel ───
  'Activity': '活動',
  'Chat': '聊天',
  'Emergency stop — stop all AI activity (Escape)': '緊急停止 — 停止所有 AI 活動（Escape）',
  'Open handoffs': '待處理交接',
  'No open handoffs.': '目前沒有待處理的交接。',
  'Disconnected': '已中斷連線',
  'Wingman is typing...': 'Wingman 正在輸入…',
  'Message to Wingman...': '傳訊息給 Wingman…',
  'No screenshots yet. Use Cmd+D → 📸': '尚無截圖。使用 Cmd+D → 📸',
  'No screenshots yet. Use Ctrl+D → 📸': '尚無截圖。使用 Ctrl+D → 📸',

  // ─── index.html: ClaroNote (currently unreachable — tab button is
  // commented out — but the panel markup still exists, so it's cheap
  // to translate now in case it's re-enabled) ───
  'Log in with your ClaroNote account': '使用你的 ClaroNote 帳號登入',
  'Email': '電子郵件',
  'Password': '密碼',
  'Log in': '登入',
  'Ready to record': '準備錄音',
  'Recording...': '錄音中…',
  'Recent notes': '最近的筆記',
  'Loading...': '載入中…',

  // ─── index.html: keyboard shortcuts overlay ───
  '⌨️ Keyboard Shortcuts': '⌨️ 鍵盤快捷鍵',
  'Search shortcuts...': '搜尋快捷鍵…',
  'Navigation': '導覽',
  'New tab': '開新分頁',
  'Close tab': '關閉分頁',
  'Go to tab 1-9': '切換至分頁 1-9',
  'History': '瀏覽紀錄',
  'Find on page': '在頁面中尋找',
  'Wingman panel toggle': '切換 Wingman 面板',
  'Voice input': '語音輸入',
  'Picture-in-Picture': '子母畫面',
  'Tools': '工具',
  'Bookmark page': '將頁面加入書籤',
  'Drawing mode': '繪圖模式',
  'Record audio': '錄製音訊',
  'Browser': '瀏覽器',
  'Settings': '設定',
  'Help & shortcuts': '說明與快捷鍵',
  'Zoom in': '放大',
  'Zoom out': '縮小',
  'Reset zoom': '重設縮放',

  // ─── settings.html: header + nav (each nav link's text also matches
  // its section's <h2> exactly, so one entry covers both) ───
  'Tandem Settings': 'Tandem 設定',
  '⚙️ General': '⚙️ 一般',
  '📸 Screenshots': '📸 截圖',
  '🎙️ Voice': '🎙️ 語音',
  '🎨 Theme': '🎨 主題',
  '🛡️ Stealth': '🛡️ 隱身',
  '🔄 Sync': '🔄 同步',
  '🧬 Behavioral Learning': '🧬 行為學習',
  '🤖 AI Autonomy': '🤖 AI 自主性',
  '💾 Data': '💾 資料',
  '🧩 Extensions': '🧩 擴充功能',
  '🔗 Connected Agents': '🔗 已連接的 Agent',

  // ─── settings.html: General section ───
  'Basic settings for Tandem Browser': 'Tandem Browser 的基本設定',
  'Start page': '起始頁',
  'Which page opens on a new tab?': '新分頁要開啟哪個頁面？',
  'Wingman (New Tab)': 'Wingman（開新分頁）',
  'Custom URL': '自訂網址',
  'Custom start URL': '自訂起始網址',
  'Quick links': '快速連結',
  'Choose the shortcuts shown on the new tab page': '選擇顯示在新分頁頁面上的捷徑',
  '+ Add link': '+ 新增連結',
  'Label': '標籤',
  'No quick links configured yet.': '尚未設定任何快速連結。',
  'Language': '語言',
  'Interface language': '介面語言',
  'Wingman panel default open': 'Wingman 面板預設開啟',
  '— Coming soon': '— 即將推出',
  'Panel auto-open on startup': '啟動時自動開啟面板',
  'Show bookmarks bar': '顯示書籤列',
  'Show the bookmarks bar below the address bar (Cmd+Shift+B)': '在網址列下方顯示書籤列（Cmd+Shift+B）',
  'Show the bookmarks bar below the address bar (Ctrl+Shift+B)': '在網址列下方顯示書籤列（Ctrl+Shift+B）',

  // ─── settings.html: Screenshots section ───
  'Where are screenshots saved?': '截圖要儲存在哪裡？',
  'To clipboard': '複製到剪貼簿',
  'Always on — every screenshot goes to your clipboard': '永遠開啟 — 每張截圖都會複製到你的剪貼簿',
  'Local folder': '本機資料夾',
  'Save screenshots as files': '將截圖另存為檔案',
  'Storage path': '儲存路徑',
  'Choose folder…': '選擇資料夾…',
  'Auto-import screenshots to Apple Photos (macOS only)': '自動將截圖匯入 Apple Photos（僅限 macOS）',
  'Auto-upload screenshots to your Google Photos library': '自動將截圖上傳至你的 Google Photos 相簿',
  'Desktop OAuth Client ID': '桌面版 OAuth 用戶端 ID',
  'Use your own Google desktop app client ID. Stored locally only.': '使用你自己的 Google 桌面應用程式用戶端 ID。僅儲存在本機。',
  'Connection': '連線',
  'Not connected': '尚未連線',
  'Connect': '連接',
  'Disconnect': '中斷連線',
  'Connected and ready to auto-upload screenshots': '已連線，可自動上傳截圖',
  'Connected, but auto-upload is currently disabled': '已連線，但目前已停用自動上傳',
  'Client ID saved. Connect Google Photos to finish setup.': '用戶端 ID 已儲存。請連接 Google Photos 以完成設定。',
  'Add a Google desktop OAuth client ID to connect.': '請新增 Google 桌面版 OAuth 用戶端 ID 以進行連接。',

  // ─── settings.html: Voice section ───
  'Voice input settings': '語音輸入設定',
  'Input language': '輸入語言',
  'Language for speech recognition': '語音辨識使用的語言',
  'Dutch (Belgium)': '荷蘭文（比利時）',
  'Dutch (Netherlands)': '荷蘭文（荷蘭）',
  'English (US)': '英文（美國）',
  'English (UK)': '英文（英國）',
  'German': '德文',
  'French': '法文',
  'Auto-send after silence': '靜音後自動傳送',
  'Auto-send message after a pause in speaking': '說話停頓後自動傳送訊息',
  'Silence timeout': '靜音逾時',
  'Wait this long after last word before auto-send': '最後一個字之後等待這麼久才自動傳送',

  // ─── settings.html: Theme section ───
  'Color scheme and visual settings': '配色與視覺設定',
  'Color scheme': '配色方案',
  'Choose between dark, light or system preference': '選擇深色、淺色或跟隨系統偏好設定',
  '🌙 Dark': '🌙 深色',
  '☀️ Light': '☀️ 淺色',
  '🔄 System': '🔄 系統',
  'Help link': '說明連結',
  'Quick access to help and shortcuts': '快速前往說明與快捷鍵',
  '📖 Open Help Page': '📖 開啟說明頁面',
  '✨ Liquid Glass Effects': '✨ 液態玻璃效果',
  'Advanced glass morphism with subtle lensing and depth. Creates semi-transparent UI that shows through to content below.':
    '進階玻璃擬態效果，具備細膩的透鏡感與層次深度。呈現半透明介面，可透視底下的內容。',
  'Enable Liquid Glass': '啟用液態玻璃',
  'Apply glass effects to browser chrome (tab bar, toolbar, panels)': '為瀏覽器介面（分頁列、工具列、面板）套用玻璃效果',
  'Glass blur intensity': '玻璃模糊強度',
  'How much blur to apply to glass surfaces (': '套用於玻璃表面的模糊程度(',
  'Refraction strength': '折射強度',
  'WebGL lensing intensity (': 'WebGL 透鏡強度(',
  '%) — requires full LGL package': '%) — 需要完整版 LGL 套件',
  '⚠️ Performance Note': '⚠️ 效能說明',
  'CSS-first glass (T1 Static tier) is currently active. Full WebGL lensing will be available when @mblock/liquid-glass package is integrated.':
    '目前使用的是 CSS 優先的玻璃效果（T1 靜態層級）。整合 @mblock/liquid-glass 套件後即可使用完整的 WebGL 透鏡效果。',

  // ─── settings.html: Stealth section (Cmd/Ctrl handled separately by
  // shortcut-labels.js — see i18n.js ordering note at the top) ───
  'Anti-detection settings — keep Tandem invisible': '防偵測設定 — 讓 Tandem 保持隱形',
  'Automatically matches the latest Chrome version': '自動比對最新的 Chrome 版本',
  'Auto (match Chrome)': '自動（比對 Chrome）',
  'Custom': '自訂',
  'Custom User-Agent': '自訂 User-Agent',
  'Stealth Level': '隱身等級',
  'Hover for explanation per level': '將滑鼠移到此處查看各等級說明',
  'Low: Basic UA + header patches\nMedium: + navigator/chrome mocks, fingerprint patches\nHigh: + canvas/WebGL randomization, timing humanization':
    '低：基本 UA ＋標頭修改\n中：＋ navigator/chrome 模擬、指紋修改\n高：＋ canvas/WebGL 隨機化、時間人性化',
  'Low': '低',
  'Medium': '中',
  'High': '高',
  'Auto follows your language setting': '自動跟隨你的語言設定',
  'Auto': '自動',
  'Custom Accept-Language': '自訂 Accept-Language',

  // ─── settings.html: Sync section ───
  'Sync data from Chrome': '從 Chrome 同步資料',
  'Chrome bookmarks sync': 'Chrome 書籤同步',
  'Auto-import and sync bookmarks from Google Chrome': '自動從 Google Chrome 匯入並同步書籤',
  'Chrome profile': 'Chrome 設定檔',
  'Select which Chrome profile to sync': '選擇要同步的 Chrome 設定檔',
  'Default': '預設',
  'Sync status': '同步狀態',
  'Not active': '未啟用',
  '🔄 Sync now': '🔄 立即同步',

  // ─── settings.html: Behavioral Learning section (source strings are
  // Dutch in a few spots — pre-existing, unrelated to i18n) ───
  'Tandem learns your browsing patterns for natural automation': 'Tandem 會學習你的瀏覽模式，以實現自然的自動化',
  'Tracking on': '啟用追蹤',
  'Record mouse, scroll, keyboard and navigation patterns': '記錄滑鼠、捲動、鍵盤與導覽模式',
  'Clear behavioral data': '清除行為資料',
  'Delete all stored behavioral data': '刪除所有已儲存的行為資料',
  'Clear data': '清除資料',
  '📊 Statistieken': '📊 統計資料',
  'Events vandaag': '今日事件',
  'Dagen gelogd': '已記錄天數',
  'Sessie events': '本次工作階段事件',
  'Gem. keypress (ms)': '平均按鍵間隔（ms）',
  'Gem. click delay (ms)': '平均點擊延遲（ms）',

  // ─── settings.html: AI Autonomy section ───
  'Configure what Wingman/Claude can do automatically without asking': '設定 Wingman/Claude 可以自動執行、不需詢問的動作',
  'Read pages without asking': '不詢問即可讀取頁面',
  'Screenshots, scrolling, reading text': '截圖、捲動、讀取文字',
  'Navigate without asking': '不詢問即可導覽',
  'Navigate to URLs, open/close tabs': '前往網址、開啟／關閉分頁',
  'Click without asking': '不詢問即可點擊',
  'Click links and buttons': '點擊連結與按鈕',
  'Type text without asking': '不詢問即可輸入文字',
  'Fill text in search fields and inputs': '在搜尋欄與輸入欄填入文字',
  'Fill forms without asking': '不詢問即可填寫表單',
  'Auto-fill and submit forms': '自動填寫並送出表單',
  'Vertrouwde sites': '信任的網站',
  'On these sites the AI can do more automatically': 'AI 在這些網站上可以自動執行更多動作',

  // ─── settings.html: Data section ───
  'Export, import or clear all your Tandem data': '匯出、匯入或清除你所有的 Tandem 資料',
  'Export all data': '匯出所有資料',
  'Bookmarks, history, chat, behavioral data — als JSON': '書籤、瀏覽紀錄、聊天記錄、行為資料 — 以 JSON 格式',
  '📦 Export': '📦 匯出',
  'Import data': '匯入資料',
  'Restore a previously exported Tandem backup': '還原先前匯出的 Tandem 備份',
  '📥 Import': '📥 匯入',
  'Clear all data': '清除所有資料',
  '⚠️ This deletes EVERYTHING — chat, config, behavioral data': '⚠️ 這會刪除所有資料 — 聊天記錄、設定、行為資料',
  '🗑 Clear all': '🗑 全部清除',

  // ─── settings.html: Extensions section ───
  'Manage browser extensions, import from Chrome, or discover new ones': '管理瀏覽器擴充功能、從 Chrome 匯入，或探索新的擴充功能',
  'Installed': '已安裝',
  'From Chrome': '來自 Chrome',
  'Gallery': '商店',
  'Checking for updates...': '正在檢查更新…',
  'Check for Updates': '檢查更新',
  'Update All': '全部更新',
  'Import extensions from your Chrome browser': '從你的 Chrome 瀏覽器匯入擴充功能',
  'Import All': '全部匯入',

  // ─── settings.html: Connected Agents section ───
  '🔗 Connect your AI to Tandem': '🔗 將你的 AI 連接至 Tandem',
  'Let your AI agent work with you in Tandem Browser': '讓你的 AI agent 在 Tandem Browser 中與你協作',
  'Agent API settings': 'Agent API 設定',
  'Changing the port requires restarting Tandem.': '變更連接埠需要重新啟動 Tandem。',
  'API port': 'API 連接埠',
  'Default: 8765': '預設：8765',
  'Local endpoint:': '本機端點：',
  'Remote endpoint:': '遠端端點：',
  'Listen host:': '監聽主機：',
  'Checking Tailscale...': '正在檢查 Tailscale…',
  'Where is your AI running?': '你的 AI 執行在哪裡？',
  'On this machine': '在這台機器上',
  'On another machine': '在另一台機器上',
  'Give this to your AI': '把這個提供給你的 AI',
  'Copy the text below and paste it into your AI agent. It contains everything your AI needs to connect.':
    '複製下方文字並貼給你的 AI agent。內含 AI 連接所需的所有資訊。',
  'Copy instructions': '複製操作說明',
  'Connected agents': '已連接的 Agent',
  'No agents connected yet.': '尚未連接任何 Agent。',
  'Generate connection instructions': '產生連接說明',

  // ─── settings.html: toast + confirm modal ───
  'Saved ✓': '已儲存 ✓',
  'Are you sure?': '你確定嗎？',
  'This cannot be undone.': '此動作無法復原。',
  'Confirm': '確認',

  // ─── about.html ───
  'First-Party OpenClaw Companion Browser': 'OpenClaw 官方協作瀏覽器',
  'Developer Preview': '開發者預覽版',
  'Built specifically for human-AI collaboration with OpenClaw.': '專為與 OpenClaw 進行人機協作而打造。',
  'Maintained in the same ecosystem as OpenClaw, with security and local control built in.':
    '與 OpenClaw 同屬一個生態系維護，內建安全防護與本機控制權。',

  // ─── extensions.js: renderAboutPanel() — a second, separate "About"
  // surface (sidebar panel), text overlaps about.html but isn't
  // identical (word order differs in one sentence — pre-existing
  // source drift, kept as separate keys rather than "fixed" since
  // that's outside this task's scope) ───
  'About Tandem': '關於 Tandem',
  'Public developer preview for serious OpenClaw workflows': '為認真的 OpenClaw 工作流程打造的公開開發者預覽版',
  'Maintained in the same ecosystem as OpenClaw, with local control and security built in.':
    '與 OpenClaw 同屬一個生態系維護，內建本機控制權與安全防護。',
  'A first-party companion browser for OpenClaw': 'OpenClaw 的官方協作瀏覽器',

  // ─── help.html: header + nav (nav link text and its section's <h2>
  // are often different strings — Wingman Panel vs. "Wingman Panel —
  // Your AI Assistant" — kept as separate keys where they differ) ───
  'First-party OpenClaw companion browser — public developer preview': 'OpenClaw 官方協作瀏覽器 — 公開開發者預覽版',
  'Overview': '總覽',
  'Wingman Panel': 'Wingman 面板',
  'Drawing & Annotation': '繪圖與標註',
  'Voice Input': '語音輸入',
  'Tabs & Groups': '分頁與群組',
  'Memory & Data': '記憶與資料',
  'Stealth & Privacy': '隱身與隱私',
  'Tips & Tricks': '提示與技巧',

  // ─── help.html: #overview ───
  'What is Tandem Browser?': '什麼是 Tandem Browser？',
  "Tandem Browser is a browser built specifically for collaboration with OpenClaw. While you browse normally, Wingman can watch along, help, and perform actions through Tandem's local browser API while staying outside the page context.":
    'Tandem Browser 是一款專為與 OpenClaw 協作而打造的瀏覽器。你正常瀏覽的同時，Wingman 可以在旁觀看、提供協助，並透過 Tandem 的本機瀏覽器 API 執行動作，同時不介入頁面內容本身。',
  'Tandem is maintained in the same ecosystem as OpenClaw and should be understood as a first-party companion browser, not a gimmick integration or a generic browser shell with chat bolted on later.':
    'Tandem 與 OpenClaw 同屬一個生態系維護，應被視為官方協作瀏覽器，而非噱頭式整合，也不是事後加裝聊天功能的通用瀏覽器外殼。',
  '🤖 Wingman Panel': '🤖 Wingman 面板',
  'Your AI assistant has its own panel where it can chat, track activities, and view screenshots.':
    '你的 AI 助理擁有專屬面板，可以在其中聊天、追蹤活動並檢視截圖。',
  '🖍️ Drawing & Annotation': '🖍️ 繪圖與標註',
  'Draw directly on web pages to highlight important elements for Wingman.': '直接在網頁上繪圖，為 Wingman 標示出重要的元素。',
  'Talk to Wingman via voice input — faster than typing!': '用語音輸入與 Wingman 對話 — 比打字更快！',
  '🛡️ Stealth Browsing': '🛡️ 隱身瀏覽',
  'Advanced anti-detection ensures websites cannot distinguish Tandem from real Chrome.':
    '進階防偵測技術確保網站無法將 Tandem 與真正的 Chrome 區分開來。',
  '💾 Smart Memory': '💾 智慧記憶',
  'Tandem remembers all websites you visit and can detect patterns and changes.': 'Tandem 會記住你造訪過的所有網站，並能偵測其中的模式與變化。',
  '📸 Screenshots & PiP': '📸 截圖與子母畫面',
  'Take screenshots with annotations and use Picture-in-Picture mode for always-visible overview.':
    '拍攝含標註的截圖，並使用子母畫面模式讓總覽畫面隨時可見。',
  '💡 Pro Tip': '💡 專業提示',
  // Fragment keys below (Press/Use/Hold/through) are text nodes split
  // off by an inline <span class="shortcut"> chip mid-sentence — see
  // e.g. 'Press <span>Cmd+?</span> to open...'. Reused verbatim
  // wherever the same connective word precedes/follows a shortcut chip.
  'Press': '按',
  'to open the shortcuts overlay — the fastest way to learn Tandem!': '即可開啟快捷鍵總覽 — 這是認識 Tandem 最快的方式！',

  // ─── help.html: #shortcuts ───
  'All Shortcuts': '所有快捷鍵',
  'Tandem has many useful shortcuts for efficient browsing. Grouped by function:': 'Tandem 提供許多實用的快捷鍵，讓瀏覽更有效率，依功能分組如下：',
  'Live captcha/login help': '即時圖形驗證碼／登入協助',

  // ─── help.html: #wingman ───
  'Wingman Panel — Your AI Assistant': 'Wingman 面板 — 你的 AI 助理',
  'The Wingman panel (': 'Wingman 面板（',
  ') is where your AI assistant lives. It has multiple tabs:': '）就是你的 AI 助理所在之處，內含多個分頁：',
  'Chat directly with Wingman via text or voice. It can help with browsing, answer questions, and perform actions.':
    '直接透過文字或語音與 Wingman 聊天。它能協助瀏覽、回答問題並執行動作。',
  'Activity Log': '活動紀錄',
  'Wingman follows all your browsing activity in real-time: which pages you visit, what you click, what you type. This helps it understand context.':
    'Wingman 會即時追蹤你所有的瀏覽活動：造訪的頁面、點擊的項目、輸入的內容，藉此理解情境脈絡。',
  'Screenshots': '截圖',
  'All screenshots you take are visible here with thumbnails. Click to view the full image.': '你拍攝的所有截圖都會以縮圖顯示在這裡，點擊即可檢視完整圖片。',
  'Memory': '記憶',
  'Wingman remembers important information about websites you visit — perfect for finding information later.':
    'Wingman 會記住你造訪網站的重要資訊 — 方便你之後查找。',
  '💡 Voice Tip': '💡 語音提示',
  'Hold': '按住',
  'to talk. Release and Wingman processes your speech automatically!': '即可說話，放開後 Wingman 就會自動處理你的語音！',

  // ─── help.html: #drawing ───
  'to toggle drawing mode. You can then draw directly on web pages.': '即可切換繪圖模式，接著就能直接在網頁上繪圖。',
  'Available Tools': '可用工具',
  '✏️ Free Line': '✏️ 自由畫線',
  'Draw freehand shapes, circles, underlines.': '手繪形狀、圓形、底線。',
  '🔸 Rectangles': '🔸 矩形',
  'Highlight sections and blocks with rectangles.': '用矩形標示區塊與段落。',
  '⭕ Circles': '⭕ 圓形',
  'Highlight specific elements with circles.': '用圓形標示特定元素。',
  '📝 Text Labels': '📝 文字標籤',
  'Add text notes to your annotations.': '為你的標註加上文字備註。',
  'Choose from different colors: red (default), yellow, green, and blue. Press "📸 Snap for Wingman" to take a screenshot with all your annotations.':
    '可選擇不同顏色：紅（預設）、黃、綠、藍。按下「📸 為 Wingman 擷取畫面」即可拍攝含所有標註的截圖。',

  // ─── help.html: #voice ───
  'Tandem has built-in speech recognition for Dutch and English input.': 'Tandem 內建荷蘭文與英文輸入的語音辨識功能。',
  'How to use': '使用方式',
  'to activate voice input': '即可啟動語音輸入',
  "You'll see a red pulsing indicator — start talking": '你會看到紅色的閃爍指示燈 — 開始說話即可',
  'Wingman transcribes your speech live in the chat panel': 'Wingman 會在聊天面板中即時轉錄你的語音',
  'After a brief silence the message is sent automatically': '短暫靜音後，訊息會自動送出',
  'Voice input works perfectly with annotations — draw something and explain it via voice!': '語音輸入與標註完美搭配 — 畫個東西，再用語音說明！',

  // ─── help.html: #tabs ───
  'Tandem supports advanced tab management with colors and groups.': 'Tandem 支援進階分頁管理，可使用顏色與群組。',
  'Tab Navigation': '分頁導覽',
  'Use': '使用',
  'through': '到',
  'to quickly switch between tabs.': '可快速切換分頁。',
  'opens a new tab,': '會開啟新分頁，',
  'closes the current tab.': '則會關閉目前的分頁。',
  'Tab Indicators': '分頁指示圖示',
  'Tabs show different indicators:': '分頁會顯示不同的指示圖示：',
  '👤 — Tab controlled by you': '👤 — 由你操控的分頁',
  '🤖 — Tab controlled by Wingman (AI)': '🤖 — 由 Wingman（AI）操控的分頁',
  '🎵 — Tab is playing audio': '🎵 — 分頁正在播放音訊',
  '🔴 — Audio is being recorded': '🔴 — 正在錄製音訊',

  // ─── help.html: #memory ───
  'Tandem remembers everything you do to help you better later.': 'Tandem 會記住你所做的一切，以便日後更好地協助你。',
  'Site Memory': '網站記憶',
  'For every website Tandem stores: title, content, forms, links, and changes over time. Search through your browse history via the Memory tab in the Wingman panel.':
    'Tandem 會為每個網站儲存：標題、內容、表單、連結，以及隨時間發生的變化。你可以透過 Wingman 面板中的記憶分頁搜尋瀏覽紀錄。',
  'Form Memory': '表單記憶',
  'Tandem remembers which forms you fill in and can auto-fill them later. Sensitive data like passwords is stored encrypted.':
    'Tandem 會記住你填寫過的表單，並可在之後自動填入。密碼等敏感資料會經過加密儲存。',
  'Behavioral Learning': '行為學習',
  'Tandem learns your browsing behavior (timing, mouse movements, typing patterns) to mimic more human-like behavior during automated actions.':
    'Tandem 會學習你的瀏覽行為（時間節奏、滑鼠移動、打字模式），讓自動化操作時的行為更貼近真人。',

  // ─── help.html: #stealth ───
  'Tandem is designed to be completely invisible to websites. It looks exactly like a normal Chrome browser.':
    'Tandem 的設計讓網站完全無法察覺，看起來就跟一般的 Chrome 瀏覽器一模一樣。',
  'Anti-Detection Features': '防偵測功能',
  'Canvas fingerprint randomization': 'Canvas 指紋隨機化',
  'WebGL renderer/vendor spoofing': 'WebGL 繪圖引擎／廠商偽裝',
  'Audio context fingerprint spoofing': '音訊環境指紋偽裝',
  'Timing protection': '時序保護',
  'Font enumeration masking': '字型列舉遮罩',
  'Humanized delays and behavior simulation': '人性化延遲與行為模擬',
  '🛡️ Privacy': '🛡️ 隱私',
  'All data stays local on your computer. Tandem NEVER sends data to external servers.':
    '所有資料都保留在你的電腦本機。Tandem 絕不會將資料傳送至外部伺服器。',

  // ─── help.html: #tips ───
  'Workflow Tips': '工作流程小技巧',
  'Screenshot + Voice': '截圖 + 語音',
  'Take a screenshot with annotations and explain via voice — perfect for complex questions to Wingman.':
    '拍攝含標註的截圖並用語音說明 — 非常適合向 Wingman 提出複雜的問題。',
  'PiP Monitoring': '子母畫面監看',
  "for Picture-in-Picture to monitor Wingman's activity while you do other work.": '可開啟子母畫面，讓你在忙其他事時監看 Wingman 的活動。',
  'Tab Groups': '分頁群組',
  'Organize related tabs by color — blue for work, green for research, etc.': '用顏色整理相關分頁 — 藍色代表工作、綠色代表研究，依此類推。',
  'Let Tandem remember forms so Wingman can auto-fill them later.': '讓 Tandem 記住表單，Wingman 之後就能自動填入。',
  'Advanced Features': '進階功能',
  'Tandem has many advanced features not visible in the UI:': 'Tandem 還有許多不會顯示在介面上的進階功能：',
  'Headless Browsing:': '無頭瀏覽：',
  'Wingman can invisibly visit websites': 'Wingman 能夠隱形造訪網站',
  'Scheduled Watches:': '排程監看：',
  'Automatically monitor websites for changes': '自動監控網站的變化',
  'Network Inspector:': '網路檢查器：',
  'API discovery and request monitoring': 'API 探索與請求監控',
  'Extension Support:': '擴充功能支援：',
  'Load Chrome extensions': '載入 Chrome 擴充功能',
  'Audio Capture:': '音訊擷取：',
  'Record tab audio for later': '錄製分頁音訊供之後使用',

  // ─── help.html: floating shortcuts button (Cmd/Ctrl pair, see
  // i18n.js module comment on shortcut-labels.js race) ───
  'Shortcuts (Cmd+?)': '快捷鍵（Cmd+?）',
  'Shortcuts (Ctrl+?)': '快捷鍵（Ctrl+?）',

  // ─── bookmarks.html + pages/bookmarks.js (standalone bookmarks
  // manager page — distinct from the sidebar bookmarks panel).
  // 'Alle Bookmarks'/'Geen resultaten' are pre-existing Dutch source
  // strings, unrelated to i18n; keyed on the literal text so the
  // TreeWalker can still match it. {count}/{name}/'Delete "{name}"?'
  // use the t(key, params) interpolation form — see i18n.js's t() ───
  'Edit': '編輯',
  'Delete': '刪除',
  '{count} items': '{count} 個項目',
  'Alle Bookmarks': '所有書籤',
  'No bookmarks in this folder': '此資料夾內沒有書籤',
  'Delete "{name}"?': '刪除「{name}」？',
  'New': '新增',
  'New Folder': '新增資料夾',
  'New Bookmark': '新增書籤',
  'Geen resultaten': '沒有結果',
  'Importing...': '匯入中…',
  'Chrome Import': '匯入 Chrome',
  '{count} bookmarks imported!': '已匯入 {count} 個書籤！',
  'Import failed: ': '匯入失敗：',
  'Unknown error': '未知錯誤',
  '+ Folder': '+ 資料夾',
  '+ Bookmark': '+ 書籤',
  'Search bookmarks...': '搜尋書籤…',
  'URL': '網址',

  // ─── newtab.html + pages/newtab.js ───
  'Co-Pilot Browser': '副駕駛瀏覽器',
  'Search or type a URL...': '搜尋或輸入網址…',
  'Edit Quick Links': '編輯快速連結',
  'Loading shortcuts...': '正在載入捷徑…',
  'Recent tabs': '最近的分頁',
  'No quick links configured': '尚未設定任何快速連結',
  'No recent tabs': '尚無最近的分頁',

  // ─── pages/settings.js: quick links / general ───
  'Each quick link needs both a label and a URL.': '每個快速連結都需要標籤和網址。',

  // ─── pages/settings.js: Google Photos ───
  'Connect failed': '連線失敗',
  'Popup blocked': '快顯視窗遭封鎖',
  'Connect failed ✕': '連線失敗 ✕',
  'Disconnected ✓': '已中斷連線 ✓',
  'Disconnect failed ✕': '中斷連線失敗 ✕',
  'Google Photos connected ✓': 'Google Photos 已連線 ✓',

  // ─── pages/settings.js: Chrome sync ───
  ' (no bookmarks)': ' (無書籤)',
  'Active — syncing with {profile}': '運作中 — 正在與 {profile} 同步',
  '{count} bookmarks synced ✓': '已同步 {count} 個書籤 ✓',
  'Sync failed ✕': '同步失敗 ✕',

  // ─── pages/settings.js: behavioral data ───
  'Clear behavioral data?': '清除行為資料？',
  'All stored behavioral patterns will be deleted. This cannot be undone.': '所有已儲存的行為模式都將被刪除，此動作無法復原。',
  'Behavioral data cleared ✓': '行為資料已清除 ✓',
  'Clear failed ✕': '清除失敗 ✕',

  // ─── pages/settings.js: export / import / wipe ───
  'Data exported ✓': '資料已匯出 ✓',
  'Export failed ✕': '匯出失敗 ✕',
  'Data imported ✓': '資料已匯入 ✓',
  'Import failed ✕': '匯入失敗 ✕',
  '⚠️ Clear ALL data?': '⚠️ 清除所有資料？',
  'This will delete your chat history, config, behavioral data and more. This CANNOT be undone!':
    '這會刪除你的聊天記錄、設定、行為資料等所有內容，此動作無法復原！',
  'All data cleared ✓': '所有資料已清除 ✓',

  // ─── pages/settings.js: Extensions — Installed tab ───
  'No extensions installed yet. Use the Gallery tab to discover extensions.': '尚未安裝任何擴充功能。請至商店分頁探索擴充功能。',
  'Error': '錯誤',
  'Loaded': '已載入',
  'Not loaded': '尚未載入',
  'Update': '更新',
  'Update: v{oldVersion} → v{newVersion}': '更新：v{oldVersion} → v{newVersion}',
  'Updating...': '更新中…',
  'Removing...': '移除中…',
  'Updated {name}: v{oldVersion} → v{newVersion}': '已更新 {name}：v{oldVersion} → v{newVersion}',
  'Update failed': '更新失敗',
  'Remove extension?': '移除擴充功能？',
  'This will uninstall "{id}" and remove its files.': '這會解除安裝「{id}」並移除其檔案。',
  'Extension removed': '已移除擴充功能',
  'Remove failed': '移除失敗',
  'Failed to load extensions.': '無法載入擴充功能。',
  'Installed ({count})': '已安裝（{count}）',
  // 'Installed' (bare) already covered — see settings.html: Extensions
  // section entry above.
  '{count} updates available': '{count} 個更新可用',
  'All up to date (checked {ago})': '已是最新版本（檢查於 {ago}）',
  'Updates not checked yet': '尚未檢查更新',
  'just now': '剛剛',
  '{minutes}m ago': '{minutes} 分鐘前',
  '{hours}h ago': '{hours} 小時前',
  '{days}d ago': '{days} 天前',
  'Checking...': '檢查中…',
  'All {count} extensions are up to date': '所有 {count} 個擴充功能皆為最新版本',
  'Update check failed': '檢查更新失敗',
  '{success} extensions updated, {failed} failed': '已更新 {success} 個擴充功能，{failed} 個失敗',
  '{success} extensions updated': '已更新 {success} 個擴充功能',
  '{failed} updates failed': '{failed} 個更新失敗',
  'No updates to apply': '沒有可套用的更新',

  // ─── pages/settings.js: Extensions — Chrome import tab ───
  'Chrome not found on this system.': '在此系統上找不到 Chrome。',
  'No extensions found in Chrome.': '在 Chrome 中找不到擴充功能。',
  'Imported': '已匯入',
  'Import': '匯入',
  'Extension imported': '已匯入擴充功能',
  'Import failed': '匯入失敗',
  'Failed to load Chrome extensions.': '無法載入 Chrome 擴充功能。',
  '{imported} imported, {skipped} skipped': '已匯入 {imported} 個，略過 {skipped} 個',

  // ─── pages/settings.js: Extensions — Gallery tab ───
  'All': '全部',
  'No extensions found.': '找不到擴充功能。',
  'Works': '可運作',
  'Partial': '部分支援',
  'Needs Setup': '需要設定',
  'DNR Overlap': 'DNR 衝突',
  'Native Messaging': '原生訊息傳遞',
  'Featured': '精選',
  'Install': '安裝',
  'Extension installed': '已安裝擴充功能',
  'Install failed': '安裝失敗',
  'Install failed — check connection': '安裝失敗 — 請檢查網路連線',
  'Failed to load gallery.': '無法載入商店。',

  // ─── pages/settings.js: Connected Agents — port + mode selection ───
  'Agent API port is required.': '必須提供 Agent API 連接埠。',
  'Agent API port must contain digits only.': 'Agent API 連接埠只能包含數字。',
  'Agent API port must be between 1 and 65535.': 'Agent API 連接埠必須介於 1 到 65535 之間。',
  'Remote access disabled in local-only mode.': '僅限本機模式下，遠端存取已停用。',
  'No Tailscale address detected.': '未偵測到 Tailscale 位址。',
  'Saved. Restart Tandem to use the new port.': '已儲存。請重新啟動 Tandem 以套用新的連接埠。',
  'Your AI and Tandem are on the same machine.': '你的 AI 與 Tandem 在同一台機器上。',
  'Tandem will generate a ready-to-paste instruction block for your AI.': 'Tandem 會產生一段可直接貼上的操作說明給你的 AI。',
  'Tandem address:': 'Tandem 網址：',
  // 'Generate connection instructions' already covered — see
  // settings.html: Connected Agents section entry above.
  'Remote agent access is disabled.': '遠端 Agent 存取已停用。',
  'The Agent API is listening on loopback only.': 'Agent API 目前僅監聽本機回送位址。',
  'Remote access disabled': '遠端存取已停用',
  'Your AI runs on another machine in your Tailscale network.': '你的 AI 執行在 Tailscale 網路中的另一台機器上。',
  'Tandem will generate a ready-to-paste instruction block for your remote AI.': 'Tandem 會產生一段可直接貼上的操作說明給你的遠端 AI。',
  'Both machines must be on the same Tailscale network. Tandem is never exposed to the public internet.':
    '兩台機器必須位於同一個 Tailscale 網路中。Tandem 絕不會曝露於公開網際網路。',
  'No Tailscale connection detected.': '未偵測到 Tailscale 連線。',
  'Remote connections require Tailscale. Make sure Tailscale is running and this machine is connected to your tailnet.':
    '遠端連線需要 Tailscale。請確認 Tailscale 正在執行，且這台機器已連接至你的 tailnet。',
  'Tandem only supports remote connections over private Tailscale networks, never over the public internet.':
    'Tandem 僅支援透過私人 Tailscale 網路進行遠端連線，絕不透過公開網際網路。',
  'Tailscale not available': 'Tailscale 無法使用',

  // ─── pages/settings.js: Connected Agents — buildInstructionText()
  // (assigned to a <textarea>.value, never observed — see the function's
  // own comment in settings.js). API-contract lines (HTTP verb/path,
  // JSON bodies) are deliberately left untranslated, see that comment. ───
  'Connect to Tandem Browser on this machine.': '連接至這台機器上的 Tandem Browser。',
  'Tandem address: {addr}': 'Tandem 網址：{addr}',
  'Setup code: {code}': '設定代碼：{code}',
  'Read {addr}/agent first. It explains how this Tandem instance works.': '請先閱讀 {addr}/agent，其中說明了這個 Tandem 執行個體的運作方式。',
  'Then exchange the setup code for a connection token:': '接著用設定代碼交換連接權杖：',
  'Use the returned token as: Authorization: Bearer <token>': '請將取得的權杖用作：Authorization: Bearer <token>',
  'Store it securely.': '請妥善保存。',
  'Connect to Tandem Browser on another machine via Tailscale.': '透過 Tailscale 連接至另一台機器上的 Tandem Browser。',
  'Both machines must be on the same Tailscale network.': '兩台機器必須位於同一個 Tailscale 網路中。',
  'MCP access (recommended for Claude Code, Cursor, etc.):': 'MCP 存取（建議用於 Claude Code、Cursor 等）：',
  'After pairing, add this to your MCP client config:': '配對完成後，將以下內容加入你的 MCP 用戶端設定：',
  'This connection works only over Tailscale. Tandem is not exposed to the public internet.':
    '此連線僅能透過 Tailscale 運作。Tandem 不會曝露於公開網際網路。',

  // ─── pages/settings.js: Connected Agents — setup code / timer / bindings ───
  'Failed to generate code': '產生代碼失敗',
  'Expires in {m}:{s}': '將於 {m}:{s} 後過期',
  'Expired': '已過期',
  'Agent connected': 'Agent 已連接',
  'Failed to generate setup code': '產生設定代碼失敗',
  'Instructions copied': '已複製說明',
  'never': '從未',
  '{machineName} · {agentType} · last used: {lastUsed}': '{machineName}．{agentType}．上次使用：{lastUsed}',
  'Pause': '暫停',
  'Resume': '繼續',
  'Revoke': '撤銷',
  'Agent removed': '已移除 Agent',
  'Agent paused': 'Agent 已暫停',
  'Agent resumed': 'Agent 已繼續',
  'Agent revoked': 'Agent 已撤銷',
  'Failed to pause': '暫停失敗',
  'Failed to resume': '繼續失敗',
  'Failed to revoke': '撤銷失敗',
  'Failed to remove agent': '移除 Agent 失敗',
  'Failed to pause agent': '暫停 Agent 失敗',
  'Failed to resume agent': '繼續 Agent 失敗',
  'Failed to revoke agent': '撤銷 Agent 失敗',

  // ─── shell/js/extensions.js: remove-request confirm ───
  'Remove "{name}" from Tandem?': '從 Tandem 移除「{name}」？',

  // ─── shell/js/modal.js ───
  'OK': '確定',

  // ─── shell/js/tabs.js ───
  'New Tab': '開新分頁',

  // ─── shell/js/window-chrome.js ───
  'Restore': '還原',

  // ─── shell/js/video-recorder.js ───
  'Screen recording is not available. No capture source found.': '螢幕錄製功能無法使用，找不到可擷取的來源。',
  'Screen Recording permission is required.\n\nGo to System Settings → Privacy & Security → Screen Recording and enable Tandem.':
    '需要「螢幕錄製」權限。\n\n請前往「系統設定」→「隱私權與安全性」→「螢幕錄製」，並開啟 Tandem 的權限。',

  // ─── shell/js/claronote.js (currently unreachable — see i18n.js's own
  // note on this surface near the top of the file — translated anyway
  // for whenever it's re-enabled) ───
  'Connection error with ClaroNote API': 'ClaroNote API 連線錯誤',
  'Logging in...': '登入中…',
  'Login failed': '登入失敗',
  'Network error': '網路錯誤',
  'Microphone not available': '麥克風無法使用',
  'Uploading...': '上傳中…',
  'Processing...': '處理中…',
  'Upload failed': '上傳失敗',
  'No notes recorded yet': '尚無錄製的筆記',
  'Ready': '就緒',
  // 'Error' (bare) already covered — see pages/settings.js: Extensions
  // — Installed tab entry above.
  'Note': '筆記',
  'Duration: {value}': '時長：{value}',
  'Date: {value}': '日期：{value}',
  'Summary': '摘要',
  'Transcript': '逐字稿',
  'Transcript not available yet': '逐字稿尚未產生',

  // ─── shell/js/draw.js: annotate/text tool inline prompt (pre-existing
  // uncommitted feature from an earlier, unrelated SRW-line session —
  // only these two placeholder strings needed translating) ───
  'Text label': '文字標籤',
  'What is this?': '這是什麼？',

  // ─── shell/js/wingman/chat.js ───
  "Use Tandem's built-in MCP/API chat": '使用 Tandem 內建的 MCP/API 聊天',
  'Use the local OpenClaw gateway': '使用本機 OpenClaw 閘道',
  'Use MCP activity polling': '使用 MCP 活動輪詢',
  'Send to every connected backend': '傳送給所有已連線的後端',
  // 'All' already covered — see pages/settings.js: Extensions — Gallery
  // tab entry above.
  'Wingman + Claude Connected': 'Wingman + Claude 已連線',
  'Wingman Connected, Claude Disconnected': 'Wingman 已連線，Claude 已中斷連線',
  'Wingman Disconnected, Claude Connected': 'Wingman 已中斷連線，Claude 已連線',
  'Wingman + Claude Disconnected': 'Wingman + Claude 已中斷連線',
  '{name} Connected': '{name} 已連線',
  '{name} Disconnected': '{name} 已中斷連線',
  'Message to Wingman & Claude... (@wingman/@claude for specific)': '傳訊息給 Wingman 與 Claude…（@wingman/@claude 可指定對象）',
  'Message to Claude...': '傳訊息給 Claude…',
  'Message to Tandem Wingman...': '傳訊息給 Tandem Wingman…',
  'AI is thinking...': 'AI 正在思考…',
  'Claude is thinking...': 'Claude 正在思考…',
  'Tandem Wingman is thinking...': 'Tandem Wingman 正在思考…',
  '{name} is typing...': '{name} 正在輸入…',
  'Preview': '預覽',
  'Remove image': '移除圖片',
  '⚠️ Wingman could not reach OpenClaw.': '⚠️ Wingman 無法連上 OpenClaw。',

  // ─── shell/js/wingman/index.js ───
  'Wingman needs you': 'Wingman 需要你',
  'Agent is waiting for input.': 'Agent 正在等待你的輸入。',
  'Needs Human': '需要人工',
  'Blocked': '受阻',
  'Waiting Approval': '等待核准',
  'Ready To Resume': '可繼續執行',
  'Completed Review': '已完成審查',
  'Resolved': '已解決',
  'Activity ({count})': '活動（{count}）',
  '{count} open handoffs': '{count} 個待處理交接',
  '{count} open handoffs: {title}': '{count} 個待處理交接：{title}',
  'Right-click for settings': '按右鍵開啟設定',
  '{base}. Wingman panel is open.': '{base}。Wingman 面板已開啟。',
  '{base}. Wingman is still waiting for you.': '{base}。Wingman 仍在等待你。',
  '{base}. Wingman needs you.': '{base}。Wingman 需要你。',
  '{base}. Open when you are ready.': '{base}。準備好後再開啟。',
  'Toggle Wingman panel': '切換 Wingman 面板',
  'Reason: {value}': '原因：{value}',
  'Workspace: {value}': '工作區：{value}',
  'Tab: {value}': '分頁：{value}',
  'Source: {value}': '來源：{value}',
  'Open Context': '開啟內容',
  'Approve': '核准',
  'Reject': '拒絕',
  'Resume Agent': '繼續執行 Agent',
  'Mark Ready': '標記為就緒',
  'Mark Reviewed': '標記為已審查',
  'Resolve': '解決',
  'Untitled handoff': '未命名交接',
  'handoff: ': '交接：',
  '{source} controls this tab — click to take over': '{source} 正在操控此分頁 — 點擊以取回控制權',
  'Hoog risico': '高風險',
  'Medium risico': '中風險',
  '🤖 Wingman wants to perform an action:': '🤖 Wingman 想要執行一個動作：',
  '✅ Goedkeuren': '✅ 核准',
  '❌ Afwijzen': '❌ 拒絕',

  // ─── shell/js/sidebar/panels/bookmarks.js ───
  'Empty folder': '空資料夾',
  'Bookmarks': '書籤',
  'Search bookmarks…': '搜尋書籤…',
  'Add bookmark': '新增書籤',
  'Add folder': '新增資料夾',
  'Loading…': '載入中…',
  'Search results': '搜尋結果',
  'Bookmark name': '書籤名稱',
  'URL (https://...)': '網址（https://...）',
  'Add': '新增',
  'Folder name': '資料夾名稱',

  // ─── shell/js/sidebar/panels/history.js ───
  'Search history…': '搜尋瀏覽紀錄…',
  'Your Devices': '你的裝置',
  'Failed to load history': '無法載入瀏覽紀錄',
  'No history': '沒有瀏覽紀錄',
  'Untitled': '無標題',

  // ─── shell/js/sidebar/panels/pinboard.js ───
  'Pinboard: {action} failed — {msg}': '釘選看板：{action} 失敗 — {msg}',
  'rename board': '重新命名看板',
  'delete board': '刪除看板',
  'save layout': '儲存版面',
  'save background': '儲存背景',
  'add note': '新增筆記',
  'remove item': '移除項目',
  'save edit': '儲存編輯',
  'save title': '儲存標題',
  'reorder items': '重新排序項目',
  'save item': '儲存項目',
  'create board': '建立看板',
  'Pinboards': '釘選看板',
  'New board': '新增看板',
  'Failed to load boards': '無法載入看板',
  'No boards yet. Click + to create one.': '尚無看板。點擊 + 即可建立。',
  'Rename board': '重新命名看板',
  'Delete board': '刪除看板',
  'Add text note': '新增文字筆記',
  'Appearance': '外觀',
  'Board name…': '看板名稱…',
  'Type your note here…': '在這裡輸入你的筆記…',
  'Layout': '版面',
  'Dense': '緊湊',
  'Spacious': '寬鬆',
  'Background': '背景',
  'Dark': '深色',
  'Light': '淺色',
  'Failed to load items': '無法載入項目',
  'All items removed.': '所有項目已移除。',
  'Edit pin': '編輯釘選項目',
  'Headline': '標題',
  'Type something...': '輸入內容…',
  'No items on this board yet.': '此看板尚無項目。',
  'Right-click on a page, link, image, or text selection → "Save to Pinboard".': '在頁面、連結、圖片或選取的文字上按右鍵 → 「儲存至釘選看板」。',
  '✏️ Edit': '✏️ 編輯',
  'Link': '連結',
  'Image': '圖片',
  'Quote': '引用',
  'Board emoji (optional)': '看板表情符號（選填）',
  'e.g. 📌': '例如 📌',

  // ─── shell/js/sidebar/panels/setup.js (shared with sidebar/index.js —
  // same three group-header strings appear in both files) ───
  'Workspaces': '工作區',
  'Communication': '通訊',
  'Browser Utilities': '瀏覽器工具',
  'Sidebar Setup': '側邊欄設定',

  // ─── shell/js/sidebar/panels/workspaces.js ───
  'Workspace {n}': '工作區 {n}',
  'Edit workspace': '編輯工作區',
  'Create workspace': '建立工作區',
  'Create': '建立',
  'Icon': '圖示',
  'Delete workspace': '刪除工作區',
  'Are you sure? Tabs will move to Default.': '你確定嗎？分頁將移至 Default。',
  'No': '否',
  'Yes, delete': '是，刪除',
  '+ Add workspace': '+ 新增工作區',

  // ─── shell/js/sidebar/index.js ───
  'Add workspace': '新增工作區',
  'Expand': '展開',

  // ─── shell/js/sidebar/tab-context-menu.js ───
  // 'New Tab' already covered — see shell/js/tabs.js entry above.
  'Duplicate Tab': '複製分頁',
  'Copy Page Address': '複製頁面網址',
  'Copied!': '已複製！',
  'Remove from Quick Links': '從快速連結移除',
  'Add to Quick Links': '加入快速連結',
  'Move to Workspace': '移至工作區',
  '📌 Add to Pinboard': '📌 加入至釘選看板',
  'No boards yet': '尚無看板',
  'Mute Tab': '靜音分頁',
  'Unmute Tab': '取消靜音分頁',
  'Emoji: ': 'Emoji：',
  'Set Emoji...': '設定 Emoji…',
  'Remove Emoji': '移除 Emoji',
  'Close Tab': '關閉分頁',
  'Close Other Tabs': '關閉其他分頁',
  'Close Tabs to the Right': '關閉右側分頁',
};
