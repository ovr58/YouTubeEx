let popupPort = null;

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "popup") {
        popupPort = port;
        console.log("Popup opened");

        port.onDisconnect.addListener(() => {
            console.log("Popup closed");
            popupPort = null;
        });

    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
        console.log('Tab URL - ', tab.url);
        const queryParam = tab.url.split('?')[1];
        const urlParams = new URLSearchParams(queryParam);
        chrome.tabs.sendMessage(tabId, {
            type: 'NEW',
            videoId: urlParams.get('v')
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.log("From background - Error sending message:", chrome.runtime.lastError);
            } else {
                console.log("From background - Message sent successfully:", response);
            }
        });
    }
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url.includes('youtube.com/watch')) {
            console.log('From background - Activated Tab URL - ', tab.url);
            const queryParam = tab.url.split('?')[1];
            const urlParams = new URLSearchParams(queryParam);
            chrome.tabs.sendMessage(activeInfo.tabId, {
                type: 'NEW',
                videoId: urlParams.get('v')
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log("From background - Error sending message:", chrome.runtime.lastError);
                } else {
                    console.log("From background - Message sent successfully:", response);
                }
            });
        }
    } catch (error) {
        console.error('From background - Error getting active tab:', error);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "CREATING_BOOKMARK") {
        if (popupPort) {
            popupPort.postMessage({ type: 'TASK_STARTED' });
        }
    } else if (request.type === "STOP_CREATING_BOOKMARK") {
        if (popupPort) {
            popupPort.postMessage({ type: 'TASK_COMPLETED' });
        }
    }
});