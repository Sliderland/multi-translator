# Multi Translator

A small Safari/Chrome WebExtension prototype for translating webpages and selected text.

## Current version

Version `0.1.0` supports:

- Google Translate page translation by redirecting to Google's website translation view.
- Target-language selection for Google page translation.
- Google Translate's interface language set to the selected target via `hl`.
- LibreTranslate selected-text translation.
- A configurable LibreTranslate endpoint and optional API key.
- Persistent settings using extension storage.

DeepL is intentionally not included yet. The planned implementation is a BYOK provider through a small proxy, but no working DeepL files had been created in this version of the project.

## Project structure

```text
multi-translator/
├── manifest.json
├── background.js
├── content.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
└── providers/
    └── libretranslate.js
```

## Test in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `multi-translator` folder.
5. Open the extension's settings and enter a LibreTranslate endpoint if you want to test selected-text translation.

Google page translation works without a LibreTranslate server.

## Test in Safari

Use Safari's developer extension workflow to load the folder temporarily, or package it later with Apple's Safari WebExtension tooling. The WebExtension folder is the source of truth.

## Notes

- The broad host permissions are convenient for this prototype because LibreTranslate endpoints may be local or hosted elsewhere. Tighten them before distributing the extension widely.
- Google page translation opens a new tab; it does not translate the current page in place.
- LibreTranslate selected-text translation requires an endpoint that permits requests from the extension origin.
