import { createProvider, loadSettings, normalizeSettings } from "./providers/index.js";

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get("settings");
  await chrome.storage.local.set({ settings: normalizeSettings(settings) });
});

const handlers = {
  /**
   * Translate an array of strings with the selected (or a named) provider.
   * Used by the popup for selections and by the page translator for text nodes.
   */
  async TRANSLATE_TEXTS({ texts, source = "auto", target, provider }) {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error("There is no text to translate.");
    }

    const settings = await loadSettings();
    const translator = createProvider(settings, provider ?? settings.provider);

    const result = await translator.translateAll(texts, {
      source,
      target: target || settings.targetLanguage
    });

    return { ...result, provider: translator.constructor.id };
  },

  /** Check that a provider is reachable, using settings passed in (unsaved form values). */
  async TEST_PROVIDER({ provider, config }) {
    const settings = normalizeSettings({ [provider]: config });
    return createProvider(settings, provider).testConnection();
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message?.type];

  if (!handler) {
    return undefined;
  }

  handler(message)
    .then((result) => sendResponse({ success: true, ...result }))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true;
});
