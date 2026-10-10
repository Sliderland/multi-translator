/*
 * In-place page translation.
 *
 * Injected on demand by the popup. Collects visible text nodes, sends them to
 * the background worker in batches (which uses whichever provider is
 * selected), and swaps the translations into the page. Keeps the originals so
 * the page can be restored, and translates content that appears later.
 *
 * Safe to inject more than once: the second injection reuses the first.
 */
(() => {
  if (window.__multiTranslator) {
    return;
  }

  const SKIP_SELECTOR = [
    "script", "style", "noscript", "template", "svg", "math",
    "code", "pre", "kbd", "samp", "var",
    "textarea", "input", "select", "option",
    "[contenteditable]:not([contenteditable='false'])",
    "[translate='no']", ".notranslate",
    "[hidden]", "[aria-hidden='true']",
    "#multi-translator-badge"
  ].join(",");

  const LETTER = /\p{L}/u;
  const CHUNK_SIZE = 40; // unique strings per message, so the page fills in progressively

  const state = {
    active: false,
    generation: 0,
    target: null,
    records: new Map(), // Text node -> { original, translated }
    observer: null,
    pending: new Set(),
    pendingTimer: null
  };

  // ---------- collecting text ----------

  function isTranslatable(node) {
    const text = node.nodeValue;

    if (!text || text.trim().length < 2 || !LETTER.test(text)) {
      return false;
    }

    const parent = node.parentElement;
    return Boolean(parent) && !parent.closest(SKIP_SELECTOR);
  }

  function collectTextNodes(root) {
    const nodes = [];

    if (root.nodeType === Node.TEXT_NODE) {
      if (!state.records.has(root) && isTranslatable(root)) {
        nodes.push(root);
      }
      return nodes;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        !state.records.has(node) && isTranslatable(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT
    });

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    return nodes;
  }

  /** Put text the reader can see right now first, so it translates first. */
  function sortVisibleFirst(nodes) {
    const viewportBottom = window.innerHeight;

    const scored = nodes.map((node, index) => {
      const rect = node.parentElement.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < viewportBottom && rect.width > 0;
      return { node, index, visible };
    });

    scored.sort((a, b) => (b.visible - a.visible) || (a.index - b.index));
    return scored.map((entry) => entry.node);
  }

  /** Group nodes by their trimmed text so repeated strings are translated once. */
  function groupByText(nodes) {
    const groups = new Map();

    for (const node of nodes) {
      const key = node.nodeValue.trim();

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(node);
    }

    return groups;
  }

  // ---------- translating ----------

  async function requestTranslations(texts) {
    const response = await chrome.runtime.sendMessage({
      type: "TRANSLATE_TEXTS",
      texts,
      source: "auto",
      target: state.target
    });

    if (!response?.success) {
      throw new Error(response?.error || "Translation failed.");
    }

    return response.translations;
  }

  function applyTranslation(node, translation) {
    const original = node.nodeValue;
    const leading = original.match(/^\s*/)[0];
    const trailing = original.match(/\s*$/)[0];
    const translated = leading + translation.trim() + trailing;

    state.records.set(node, { original, translated });
    node.nodeValue = translated;
  }

  async function translateNodes(nodes, generation, { showProgress }) {
    const groups = groupByText(sortVisibleFirst(nodes));
    const keys = [...groups.keys()];
    let done = 0;

    for (let start = 0; start < keys.length; start += CHUNK_SIZE) {
      const chunk = keys.slice(start, start + CHUNK_SIZE);
      const translations = await requestTranslations(chunk);

      if (generation !== state.generation) {
        return; // restored or restarted while waiting
      }

      chunk.forEach((key, i) => {
        for (const node of groups.get(key)) {
          if (node.isConnected && node.nodeValue.trim() === key) {
            applyTranslation(node, translations[i]);
          }
        }
      });

      done += chunk.length;

      if (showProgress) {
        badge.show(`Translating… ${Math.round((done / keys.length) * 100)}%`, "progress");
      }
    }
  }

  async function translatePage(target) {
    if (state.active && state.target !== target) {
      restore({ silent: true });
    }

    state.active = true;
    state.target = target;
    const generation = ++state.generation;

    const nodes = collectTextNodes(document.body);

    if (nodes.length === 0) {
      badge.show("Nothing new to translate on this page.", "done");
      return { translated: state.records.size };
    }

    badge.show("Translating…", "progress");

    try {
      await translateNodes(nodes, generation, { showProgress: true });

      if (generation === state.generation) {
        badge.show("Translated", "done");
        watchForNewContent();
      }
    } catch (error) {
      if (generation === state.generation) {
        badge.show(error.message, "error");
      }
      throw error;
    }

    return { translated: state.records.size };
  }

  function restore({ silent = false } = {}) {
    state.generation++;
    state.active = false;
    stopWatching();

    for (const [node, { original, translated }] of state.records) {
      // Leave text alone if the page has since replaced it with something else.
      if (node.isConnected && node.nodeValue === translated) {
        node.nodeValue = original;
      }
    }

    state.records.clear();

    if (silent) {
      badge.hide();
    } else {
      badge.show("Showing original", "restored");
    }
  }

  // ---------- content added after translation ----------

  function watchForNewContent() {
    if (state.observer) {
      return;
    }

    // childList only: our own edits change nodeValue (characterData) and are not observed.
    state.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => state.pending.add(node));
      }

      clearTimeout(state.pendingTimer);
      state.pendingTimer = setTimeout(flushPending, 600);
    });

    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopWatching() {
    state.observer?.disconnect();
    state.observer = null;
    clearTimeout(state.pendingTimer);
    state.pending.clear();
  }

  async function flushPending() {
    const roots = [...state.pending].filter((node) => node.isConnected);
    state.pending.clear();

    const nodes = roots.flatMap((root) => collectTextNodes(root));

    if (!state.active || nodes.length === 0) {
      return;
    }

    try {
      await translateNodes(nodes, state.generation, { showProgress: false });
    } catch {
      // Background translation of late content is best-effort.
    }
  }

  // ---------- on-page badge ----------

  const badge = (() => {
    let host = null;
    let message = null;
    let action = null;
    let hideTimer = null;
    let currentKind = null;

    function build() {
      host = document.createElement("div");
      host.id = "multi-translator-badge";
      host.setAttribute("translate", "no");

      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>
          :host { all: initial; }
          .badge {
            position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
            display: flex; align-items: center; gap: 10px;
            max-width: min(360px, calc(100vw - 32px));
            padding: 8px 8px 8px 14px; border-radius: 999px;
            background: #222; color: #fff;
            font: 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            box-shadow: 0 4px 16px rgba(0,0,0,.25);
          }
          .badge.error { background: #a32020; border-radius: 12px; }
          .message { flex: 1; overflow-wrap: anywhere; }
          button {
            border: 0; border-radius: 999px; padding: 6px 10px; cursor: pointer;
            background: rgba(255,255,255,.16); color: inherit; font: inherit; font-weight: 600;
          }
          button:hover { background: rgba(255,255,255,.28); }
          .close { padding: 6px 9px; }
        </style>
        <div class="badge" role="status">
          <span class="message"></span>
          <button class="action" type="button"></button>
          <button class="close" type="button" aria-label="Dismiss">✕</button>
        </div>`;

      message = shadow.querySelector(".message");
      action = shadow.querySelector(".action");
      shadow.querySelector(".close").addEventListener("click", hide);
      action.addEventListener("click", () => {
        if (currentKind === "error") {
          translatePage(state.target).catch(() => {});
        } else if (state.active) {
          restore();
        } else if (state.target) {
          translatePage(state.target).catch(() => {});
        }
      });

      document.documentElement.appendChild(host);
    }

    function show(text, kind) {
      if (!host?.isConnected) {
        build();
      }

      clearTimeout(hideTimer);
      currentKind = kind;
      host.shadowRoot.querySelector(".badge").className = `badge ${kind}`;
      message.textContent = text;

      if (kind === "error") {
        action.textContent = "Retry";
      } else {
        action.textContent = state.active ? "Show original" : "Translate";
      }
    }

    function hide() {
      clearTimeout(hideTimer);
      host?.remove();
      host = null;
    }

    return { show, hide };
  })();

  // ---------- messages from the popup ----------

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const reply = (promise) => {
      promise
        .then((result) => sendResponse({ success: true, ...result }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    };

    switch (message?.type) {
      case "PAGE_TRANSLATE":
        return reply(translatePage(message.target));
      case "PAGE_RESTORE":
        restore();
        sendResponse({ success: true });
        return undefined;
      case "PAGE_STATUS":
        sendResponse({ success: true, active: state.active, target: state.target });
        return undefined;
      default:
        return undefined;
    }
  });

  window.__multiTranslator = { translatePage, restore, state };
})();
