export class LibreTranslateProvider {
  constructor({ endpoint, apiKey = "" }) {
    this.endpoint = endpoint.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  async translate(text, source = "auto", target = "en") {
    const body = {
      q: text,
      source,
      target,
      format: "text"
    };

    if (this.apiKey) {
      body.api_key = this.apiKey;
    }

    const response = await fetch(`${this.endpoint}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate returned HTTP ${response.status}`);
    }

    const result = await response.json();

    if (!result.translatedText) {
      throw new Error("No translation was returned.");
    }

    return {
      translatedText: result.translatedText,
      detectedLanguage: result.detectedLanguage?.language ?? source
    };
  }

  async testConnection() {
    const response = await fetch(`${this.endpoint}/languages`);

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    return {
      success: true,
      languages: await response.json()
    };
  }
}
