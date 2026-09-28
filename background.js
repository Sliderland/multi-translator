const DEFAULT_SETTINGS = {
  provider: "google",
  targetLanguage: "en",
  libretranslate: {
    endpoint: "",
    apiKey: ""
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get("settings");

  if (!settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "TRANSLATE_SELECTION") {
    return undefined;
  }

  translateSelection(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        success: false,
        error: error.message
      });
    });

  return true;
});

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    libretranslate: {
      ...DEFAULT_SETTINGS.libretranslate,
      ...settings?.libretranslate
    }
  };
}

async function translateSelection({ text, source = "auto", target }) {
  const settings = await getSettings();

  if (!text?.trim()) {
    throw new Error("There is no selected text to translate.");
  }

  if (settings.provider !== "libretranslate") {
    throw new Error("Select LibreTranslate to translate selected text.");
  }

  const endpoint = settings.libretranslate.endpoint.replace(/\/+$/, "");

  if (!endpoint) {
    throw new Error("Configure a LibreTranslate endpoint in Settings.");
  }

  const body = {
    q: text,
    source,
    target: target || settings.targetLanguage,
    format: "text"
  };

  if (settings.libretranslate.apiKey) {
    body.api_key = settings.libretranslate.apiKey;
  }

  const response = await fetch(`${endpoint}/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Translation server returned HTTP ${response.status}`);
  }

  const result = await response.json();

  if (!result.translatedText) {
    throw new Error("No translation was returned.");
  }

  return {
    success: true,
    translatedText: result.translatedText,
    detectedLanguage: result.detectedLanguage?.language ?? null
  };
}
