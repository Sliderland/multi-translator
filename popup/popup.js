const provider = document.getElementById("provider");
const targetLanguage = document.getElementById("targetLanguage");
const googleSection = document.getElementById("googleSection");
const libretranslateSection = document.getElementById("libretranslateSection");
const googleButton = document.getElementById("googleButton");
const selectedTextElement = document.getElementById("selectedText");
const translateButton = document.getElementById("translateButton");
const resultSection = document.getElementById("resultSection");
const translationElement = document.getElementById("translation");
const statusElement = document.getElementById("status");
const settingsButton = document.getElementById("settingsButton");

let selectedText = "";

initialize();

async function initialize() {
  await loadSettings();
  updateProviderView();

  if (provider.value === "libretranslate") {
    await getSelectedText();
  }
}

async function loadSettings() {
  const { settings } = await chrome.storage.local.get("settings");

  if (settings?.provider) {
    provider.value = settings.provider;
  }

  if (settings?.targetLanguage) {
    targetLanguage.value = settings.targetLanguage;
  }
}

async function savePopupSettings() {
  const { settings = {} } = await chrome.storage.local.get("settings");

  settings.provider = provider.value;
  settings.targetLanguage = targetLanguage.value;

  await chrome.storage.local.set({ settings });
}

function updateProviderView() {
  const isGoogle = provider.value === "google";
  googleSection.hidden = !isGoogle;
  libretranslateSection.hidden = isGoogle;
  resultSection.hidden = true;
  statusElement.textContent = "";
}

async function getSelectedText() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab?.id) {
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() || ""
    });

    selectedText = results?.[0]?.result || "";

    if (selectedText) {
      selectedTextElement.textContent = selectedText;
      selectedTextElement.classList.remove("muted");
      translateButton.disabled = false;
    }
  } catch (error) {
    statusElement.textContent = "This page cannot be accessed.";
  }
}

provider.addEventListener("change", async () => {
  await savePopupSettings();
  updateProviderView();

  if (provider.value === "libretranslate") {
    await getSelectedText();
  }
});

targetLanguage.addEventListener("change", savePopupSettings);

googleButton.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab?.url) {
      throw new Error("Could not determine the current page.");
    }

    const target = targetLanguage.value;
    const googleURL =
      "https://translate.google.com/translate" +
      "?sl=auto" +
      `&tl=${encodeURIComponent(target)}` +
      `&hl=${encodeURIComponent(target)}` +
      `&u=${encodeURIComponent(tab.url)}`;

    await chrome.tabs.create({ url: googleURL });
    window.close();
  } catch (error) {
    statusElement.textContent = error.message;
  }
});

translateButton.addEventListener("click", async () => {
  if (!selectedText) {
    return;
  }

  translateButton.disabled = true;
  translateButton.textContent = "Translating…";
  statusElement.textContent = "";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TRANSLATE_SELECTION",
      text: selectedText,
      source: "auto",
      target: targetLanguage.value
    });

    if (!response?.success) {
      throw new Error(response?.error || "Translation failed.");
    }

    translationElement.textContent = response.translatedText;
    resultSection.hidden = false;
  } catch (error) {
    statusElement.textContent = error.message;
  } finally {
    translateButton.disabled = false;
    translateButton.textContent = "Translate selection";
  }
});

settingsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
