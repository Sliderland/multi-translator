import { TranslationProvider, readErrorBody } from "./provider.js";

export class LibreTranslateProvider extends TranslationProvider {
  static id = "libretranslate";
  static label = "LibreTranslate";
  static setupHint = "Add a LibreTranslate server to translate with it.";

  static isConfigured(config) {
    return Boolean(config?.endpoint?.trim());
  }

  constructor({ endpoint = "", apiKey = "" } = {}) {
    super();
    this.endpoint = endpoint.trim().replace(/\/+$/, "");
    this.apiKey = apiKey.trim();
  }

  get maxBatchItems() {
    return 40;
  }

  get maxBatchChars() {
    return 4000;
  }

  requireEndpoint() {
    if (!this.endpoint) {
      throw new Error("Add a LibreTranslate server in Settings.");
    }
  }

  async translate(texts, { source = "auto", target = "en" } = {}) {
    this.requireEndpoint();

    // LibreTranslate accepts an array for q and returns arrays in the same order.
    const body = { q: texts, source, target, format: "text" };

    if (this.apiKey) {
      body.api_key = this.apiKey;
    }

    const response = await fetch(`${this.endpoint}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await readErrorBody(response);
      throw new Error(
        `LibreTranslate returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`
      );
    }

    const result = await response.json();
    const translated = result.translatedText;

    if (translated == null) {
      throw new Error("LibreTranslate returned no translation.");
    }

    const translations = Array.isArray(translated) ? translated : [translated];
    const detected = Array.isArray(result.detectedLanguage)
      ? result.detectedLanguage[0]
      : result.detectedLanguage;

    return {
      translations,
      detectedLanguage: detected?.language ?? (source === "auto" ? null : source)
    };
  }

  async testConnection() {
    this.requireEndpoint();

    const response = await fetch(`${this.endpoint}/languages`);

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const languages = await response.json();
    return { ok: true, detail: `Connected, ${languages.length} languages available` };
  }
}
