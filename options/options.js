import { loadSettings, saveSettings } from "../providers/index.js";

const sections = [...document.querySelectorAll("section[data-provider]")];
const saveButton = document.getElementById("saveButton");
const saveStatus = document.getElementById("saveStatus");

initialize();

async function initialize() {
  const settings = await loadSettings();

  for (const section of sections) {
    const config = settings[section.dataset.provider] ?? {};

    for (const input of section.querySelectorAll("[data-field]")) {
      input.value = config[input.dataset.field] ?? "";
    }

    section.querySelector(".test").addEventListener("click", () => testSection(section));
  }
}

/** Read one provider section's form values. */
function readSection(section) {
  const config = {};

  for (const input of section.querySelectorAll("[data-field]")) {
    let value = input.value.trim();

    if (input.type === "url") {
      value = value.replace(/\/+$/, "");
    }

    config[input.dataset.field] = value;
  }

  return config;
}

async function testSection(section) {
  const button = section.querySelector(".test");
  const result = section.querySelector(".test-result");

  button.disabled = true;
  result.textContent = "Connecting…";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TEST_PROVIDER",
      provider: section.dataset.provider,
      config: readSection(section)
    });

    if (!response?.success) {
      throw new Error(response?.error || "Connection failed.");
    }

    result.textContent = `✓ ${response.detail}`;
  } catch (error) {
    result.textContent = `✗ ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

saveButton.addEventListener("click", async () => {
  const changes = {};

  for (const section of sections) {
    changes[section.dataset.provider] = readSection(section);
  }

  try {
    await saveSettings(changes);
    saveStatus.textContent = "Settings saved.";
  } catch (error) {
    saveStatus.textContent = `Could not save settings: ${error.message}`;
  }
});
