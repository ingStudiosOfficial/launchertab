let storageMode = chrome.storage.local;

async function preInstallShortcuts() {
    const shortcutsToInstall = [{"href":"https://google.com","image":"https://google.com/favicon.ico","name":"Google"},{"href":"https://chromewebstore.google.com/detail/infinitecopy/pdpmaoljompdbigcclpkkhjoiompjpkc","image":"../assets/infinitecopy_icon.png","name":"InfiniteCopy - Clipboard Manager"}];
    await storageMode.set({"shortcuts": shortcutsToInstall});
}

async function preInstallWidgets() {
    const widgetsToInstall = [{"cssClass":"time-container","font":"Google Sans","id":"widget-0","showSeconds":false,"timeFormat":"12hour","type":"digitalClock"}];
    await storageMode.set({"widgets": widgetsToInstall});
}

chrome.runtime.onInstalled.addListener(async (details) => {
     if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        preInstallShortcuts();
        preInstallWidgets();
     }
});