const endpointInput = document.getElementById("endpoint");
const apiKeyInput = document.getElementById("apiKey");
const testButton = document.getElementById("testButton");
const saveButton = document.getElementById("saveButton");
const testResult = document.getElementById("testResult");
const saveStatus = document.getElementById("saveStatus");

loadSettings();

async function loadSettings() {
  const { settings } = await chrome.storage.local.get("settings");

  endpointInput.value = settings?.libretranslate?.endpoint || "";
  apiKeyInput.value = settings?.libretranslate?.apiKey || "";
}

async function saveSettings() {
  const { settings = {} } = await chrome.storage.local.get("settings");

  settings.provider = settings.provider || "google";
  settings.targetLanguage = settings.targetLanguage || "en";
  settings.libretranslate = {
    endpoint: endpointInput.value.trim().replace(/\/+$/, ""),
    apiKey: apiKeyInput.value.trim()
  };

  await chrome.storage.local.set({ settings });
}

saveButton.addEventListener("click", async () => {
  try {
    await saveSettings();
    saveStatus.textContent = "Settings saved.";
  } catch (error) {
    saveStatus.textContent = `Could not save settings: ${error.message}`;
  }
});

testButton.addEventListener("click", async () => {
  const endpoint = endpointInput.value.trim().replace(/\/+$/, "");

  if (!endpoint) {
    testResult.textContent = "Enter a server endpoint first.";
    return;
  }

  testButton.disabled = true;
  testResult.textContent = "Connecting…";

  try {
    const response = await fetch(`${endpoint}/languages`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const languages = await response.json();
    testResult.textContent = `✓ Connected — ${languages.length} languages available`;
  } catch (error) {
    testResult.textContent = `✗ Connection failed: ${error.message}`;
  } finally {
    testButton.disabled = false;
  }
});
