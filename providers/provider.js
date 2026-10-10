/**
 * Shared shape for every translation provider.
 *
 * A provider is a class that extends TranslationProvider and implements:
 *
 *   static id          short identifier stored in settings ("deepl")
 *   static label       human-readable name for menus ("DeepL")
 *
 *   async translate(texts, { source, target })
 *     texts   string[]  one or more strings to translate, in order
 *     source  string    ISO 639-1 code, or "auto" to detect
 *     target  string    ISO 639-1 code
 *     returns { translations: string[], detectedLanguage: string|null }
 *             translations[i] is the translation of texts[i]
 *
 *   async testConnection()
 *     returns { ok: true, detail: string } or throws with a readable message
 *
 * Optional overrides:
 *   static isConfigured(config) / static setupHint   for the popup's setup prompt
 *   maxBatchItems / maxBatchChars   how much one request may carry
 *
 * Callers should go through translateAll(), which splits large inputs into
 * batches that respect those limits.
 */
export class TranslationProvider {
  static id = "base";
  static label = "Base provider";

  /** Whether saved settings are enough to try translating; override per provider. */
  // eslint-disable-next-line no-unused-vars
  static isConfigured(config) {
    return true;
  }

  /** Short hint shown when isConfigured() is false. */
  static setupHint = "This provider needs setting up.";

  get maxBatchItems() {
    return 50;
  }

  get maxBatchChars() {
    return 5000;
  }

  // eslint-disable-next-line no-unused-vars
  async translate(texts, options) {
    throw new Error(`${this.constructor.label} does not implement translate().`);
  }

  async testConnection() {
    throw new Error(`${this.constructor.label} does not implement testConnection().`);
  }

  /** Translate any number of strings, batching to stay within provider limits. */
  async translateAll(texts, options) {
    const translations = new Array(texts.length);
    let detectedLanguage = null;

    for (const batch of this.makeBatches(texts)) {
      const result = await this.translate(
        batch.map((index) => texts[index]),
        options
      );

      if (result.translations.length !== batch.length) {
        throw new Error(
          `${this.constructor.label} returned ${result.translations.length} translations for ${batch.length} texts.`
        );
      }

      batch.forEach((index, i) => {
        translations[index] = result.translations[i];
      });
      detectedLanguage ??= result.detectedLanguage;
    }

    return { translations, detectedLanguage };
  }

  /** Group indexes of texts into batches; a single oversized text gets its own batch. */
  makeBatches(texts) {
    const batches = [];
    let current = [];
    let chars = 0;

    texts.forEach((text, index) => {
      const length = text.length;
      const full =
        current.length >= this.maxBatchItems ||
        (current.length > 0 && chars + length > this.maxBatchChars);

      if (full) {
        batches.push(current);
        current = [];
        chars = 0;
      }

      current.push(index);
      chars += length;
    });

    if (current.length) {
      batches.push(current);
    }

    return batches;
  }
}

/** Read an error message from a JSON or text response body, if there is one. */
export async function readErrorBody(response) {
  try {
    const text = await response.text();

    try {
      const json = JSON.parse(text);
      return json.error || json.message || text;
    } catch {
      return text;
    }
  } catch {
    return "";
  }
}
