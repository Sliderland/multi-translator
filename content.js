chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "GET_SELECTION") {
    return undefined;
  }

  sendResponse({
    text: window.getSelection()?.toString().trim() || ""
  });

  return undefined;
});
