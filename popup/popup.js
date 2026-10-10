import { PROVIDERS, getProviderClass, loadSettings, saveSettings } from "../providers/index.js";

const $ = (id) => document.getElementById(id);

const providerSelect = $("provider");
const targetSelect = $("targetLanguage");
const setupNotice = $("setupNotice");
const setupText = $("setupText");
const pageButton = $("pageButton");
const selectionSection = $("selectionSection");
const selectedTextElement = $("selectedText");
const translateButton = $("translateButton");
const resultSection = $("resultSection");
const translationElement = $("translation");
const statusElement = $("status");

let settings;
let tab;
let selectedText = "";
let pageState = { reachable: false, active: false, target: null };

initialize();

async function initialize() {
  for (const Provider of PROVIDERS) {
    providerSelect.add(new Option(Provider.label, Provider.id));
  }

  settings = await loadSettings();
  providerSelect.value = settings.provider;
  targetSelect.value = settings.targetLanguage;

  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await connectToPage();
  updateView();
}

// ---------- page connection ----------

async function connectToPage() {
  if (!tab?.id) {
    return;
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() || ""
    });
    selectedText = result;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content/page-translator.js"]
    });

    const status = await chrome.tabs.sendMessage(tab.id, { type: "PAGE_STATUS" });
    pageState = { reachable: true, active: status.active, target: status.target };
  } catch {
    pageState = { reachable: false, active: false, target: null };
  }
}

// ---------- view ----------

function updateView() {
  const Provider = getProviderClass(providerSelect.value);
  const configured = Provider.isConfigured(settings[Provider.id]);

  setupNotice.hidden = configured;
  setupText.textContent = Provider.setupHint;

  const showingTranslation = pageState.active && pageState.target === targetSelect.value;
  pageButton.textContent = showingTranslation ? "Show original" : "Translate this page";
  pageButton.disabled = !pageState.reachable || (!configured && !showingTranslation);

  if (!pageState.reachable) {
    setStatus("This page can't be translated in place.");
  }

  selectionSection.hidden = !selectedText;
  selectedTextElement.textContent = selectedText;
  translateButton.disabled = !configured;
}

function setStatus(text) {
  statusElement.textContent = text;
}

// ---------- events ----------

providerSelect.addEventListener("change", async () => {
  settings = await saveSettings({ provider: providerSelect.value });
  resultSection.hidden = true;
  setStatus("");
  updateView();
});

targetSelect.addEventListener("change", async () => {
  settings = await saveSettings({ targetLanguage: targetSelect.value });
  updateView();
});

pageButton.addEventListener("click", async () => {
  if (pageState.active && pageState.target === targetSelect.value) {
    await chrome.tabs.sendMessage(tab.id, { type: "PAGE_RESTORE" });
    window.close();
    return;
  }

  // The page shows its own progress, so the popup can close straight away.
  // Don't await the result: on Safari the popup may already be gone.
  chrome.tabs
    .sendMessage(tab.id, { type: "PAGE_TRANSLATE", target: targetSelect.value })
    .catch(() => {});
  window.close();
});

translateButton.addEventListener("click", async () => {
  translateButton.disabled = true;
  translateButton.textContent = "Translating…";
  setStatus("");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TRANSLATE_TEXTS",
      texts: [selectedText],
      source: "auto",
      target: targetSelect.value
    });

    if (!response?.success) {
      throw new Error(response?.error || "Translation failed.");
    }

    translationElement.textContent = response.translations[0];
    resultSection.hidden = false;
  } catch (error) {
    setStatus(error.message);
  } finally {
    translateButton.disabled = false;
    translateButton.textContent = "Translate selection";
  }
});

$("googleButton").addEventListener("click", async () => {
  if (!tab?.url?.startsWith("http")) {
    setStatus("Google Translate can only open web pages.");
    return;
  }

  const target = encodeURIComponent(targetSelect.value);
  const url =
    `https://translate.google.com/translate?sl=auto&tl=${target}&hl=${target}` +
    `&u=${encodeURIComponent(tab.url)}`;

  await chrome.tabs.create({ url });
  window.close();
});

for (const id of ["settingsButton", "setupButton"]) {
  $(id).addEventListener("click", () => chrome.runtime.openOptionsPage());
}
