import { LibreTranslateProvider } from "./libretranslate.js";
import { DeepLProvider } from "./deepl.js";

/** Every available provider. Add new ones here and in DEFAULT_SETTINGS. */
export const PROVIDERS = [LibreTranslateProvider, DeepLProvider];

export const DEFAULT_SETTINGS = {
  provider: LibreTranslateProvider.id,
  targetLanguage: "en",
  libretranslate: { endpoint: "", apiKey: "" },
  deepl: { apiKey: "" }
};

export function getProviderClass(id) {
  const Provider = PROVIDERS.find((P) => P.id === id);

  if (!Provider) {
    throw new Error(`Unknown translation provider: ${id}`);
  }

  return Provider;
}

/** Build a provider instance from stored settings (or an explicit provider id). */
export function createProvider(settings, id = settings.provider) {
  const Provider = getProviderClass(id);
  return new Provider(settings[id] ?? {});
}

/** Merge stored settings over defaults, and migrate older settings shapes. */
export function normalizeSettings(stored = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...stored };

  for (const Provider of PROVIDERS) {
    settings[Provider.id] = {
      ...DEFAULT_SETTINGS[Provider.id],
      ...stored[Provider.id]
    };
  }

  // Version 0.1 offered "google" as a provider; it is now a separate fallback action.
  if (!PROVIDERS.some((P) => P.id === settings.provider)) {
    settings.provider = DEFAULT_SETTINGS.provider;
  }

  return settings;
}

export async function loadSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return normalizeSettings(settings);
}

export async function saveSettings(changes) {
  const current = await loadSettings();
  const settings = normalizeSettings({ ...current, ...changes });
  await chrome.storage.local.set({ settings });
  return settings;
}
