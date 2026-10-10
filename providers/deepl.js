import { TranslationProvider, readErrorBody } from "./provider.js";

// DeepL wants a regional variant for a few target languages.
const TARGET_OVERRIDES = {
  en: "EN-US",
  pt: "PT-PT",
  zh: "ZH-HANS"
};

export class DeepLProvider extends TranslationProvider {
  static id = "deepl";
  static label = "DeepL";
  static setupHint = "Add your DeepL API key to translate with it.";

  static isConfigured(config) {
    return Boolean(config?.apiKey?.trim());
  }

  constructor({ apiKey = "" } = {}) {
    super();
    this.apiKey = apiKey.trim();
  }

  // DeepL allows up to 50 texts per request and roughly 128 KiB of body.
  get maxBatchItems() {
    return 50;
  }

  get maxBatchChars() {
    return 30000;
  }

  /** Free-plan keys end in ":fx" and use a different host. */
  get baseURL() {
    return this.apiKey.endsWith(":fx")
      ? "https://api-free.deepl.com/v2"
      : "https://api.deepl.com/v2";
  }

  requireKey() {
    if (!this.apiKey) {
      throw new Error("Add your DeepL API key in Settings.");
    }
  }

  headers() {
    return {
      Authorization: `DeepL-Auth-Key ${this.apiKey}`,
      "Content-Type": "application/json"
    };
  }

  static toTarget(code) {
    return TARGET_OVERRIDES[code] ?? code.toUpperCase();
  }

  async translate(texts, { source = "auto", target = "en" } = {}) {
    this.requireKey();

    const body = { text: texts, target_lang: DeepLProvider.toTarget(target) };

    if (source && source !== "auto") {
      body.source_lang = source.toUpperCase();
    }

    const response = await fetch(`${this.baseURL}/translate`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(await DeepLProvider.describeError(response));
    }

    const result = await response.json();
    const items = result.translations ?? [];

    return {
      translations: items.map((item) => item.text),
      detectedLanguage: items[0]?.detected_source_language?.toLowerCase() ?? null
    };
  }

  async testConnection() {
    this.requireKey();

    const response = await fetch(`${this.baseURL}/usage`, { headers: this.headers() });

    if (!response.ok) {
      throw new Error(await DeepLProvider.describeError(response));
    }

    const usage = await response.json();
    const used = usage.character_count ?? 0;
    const limit = usage.character_limit;
    const detail = limit
      ? `Connected, ${used.toLocaleString()} of ${limit.toLocaleString()} characters used this period`
      : "Connected";

    return { ok: true, detail };
  }

  static async describeError(response) {
    switch (response.status) {
      case 403:
        return "DeepL rejected the API key.";
      case 429:
        return "DeepL is rate-limiting requests. Try again in a moment.";
      case 456:
        return "Your DeepL character quota is used up for this period.";
      default: {
        const detail = await readErrorBody(response);
        return `DeepL returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`;
      }
    }
  }
}
