let storageMode = chrome.storage.local;

async function preInstallShortcuts() {
    const shortcutsToInstall = [{"href":"https://google.com","image":"https://google.com/favicon.ico","name":"Google"},{"href":"https://chromewebstore.google.com/detail/infinitecopy/pdpmaoljompdbigcclpkkhjoiompjpkc","image":"../assets/infinitecopy_icon.png","name":"InfiniteCopy - Clipboard Manager"}];
    storageMode.set({"shortcuts": shortcutsToInstall});
}

chrome.runtime.onInstalled.addListener(async (details) => {
     if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        preInstallShortcuts();
     }
});