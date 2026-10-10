# Multi Translator

A Safari/Chrome WebExtension for translating webpages in place and translating selected text, with a choice of translation providers.

## Features (0.2.0)

- **In-place page translation.** Text on the current page is replaced with its translation, visible text first, with progress shown on the page. A badge on the page offers **Show original** to restore it. Content added later (infinite scroll, expanding sections) is translated as it appears.
- **Selected-text translation** in the popup.
- **Providers:** LibreTranslate (your own or a hosted server) and DeepL (bring your own API key; free-plan keys work).
- **Google Translate fallback:** opens the page in Google's translation view in a new tab.
- Settings stored locally in extension storage.

Code, preformatted text, form fields, editable areas and anything marked `translate="no"` or `.notranslate` are left alone.

## Project structure

```text
multi-translator/
├── manifest.json
├── background.js              # routes translation requests to the selected provider
├── content/
│   └── page-translator.js     # in-place translation, injected on demand
├── popup/                     # provider/language picker, page + selection actions
├── options/                   # provider settings and connection tests
└── providers/
    ├── provider.js            # shared TranslationProvider base class + batching
    ├── index.js               # provider registry and settings helpers
    ├── libretranslate.js
    └── deepl.js
```

## Adding a provider

1. Create `providers/<name>.js` with a class extending `TranslationProvider`. Set `static id` and `static label`, and implement `translate(texts, { source, target })` returning `{ translations, detectedLanguage }` plus `testConnection()`. Override `isConfigured`, `setupHint`, `maxBatchItems` and `maxBatchChars` as needed. See the comment at the top of `providers/provider.js`.
2. Add the class to `PROVIDERS` and its default config to `DEFAULT_SETTINGS` in `providers/index.js`.
3. Add a settings section to `options/options.html` with `data-provider="<id>"` and an input per config field (`data-field="<key>"`). The options script picks it up automatically.

Batching, the popup menu and the background routing all come from the shared interface.

## Test in Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this folder.
3. Open the extension's settings, add a LibreTranslate server or DeepL key, and use **Test connection**.

## Test in Safari

Convert with Apple's tooling (`xcrun safari-web-extension-converter`) and run the generated Xcode project. The WebExtension folder stays the source of truth. The background script is a module service worker, which current Safari supports.

## Notes

- Host permissions are broad because LibreTranslate servers can live anywhere. Tighten them (or move them to optional permissions requested per server) before distributing.
- The DeepL key is stored in this browser's extension storage and sent only to DeepL's API.
