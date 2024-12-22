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
                console.log("Error sending message:", chrome.runtime.lastError);
            } else {
                console.log("Message sent successfully:", response);
            }
        });
    }
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url.includes('youtube.com/watch')) {
            console.log('Activated Tab URL - ', tab.url);
            const queryParam = tab.url.split('?')[1];
            const urlParams = new URLSearchParams(queryParam);
            chrome.tabs.sendMessage(activeInfo.tabId, {
                type: 'NEW',
                videoId: urlParams.get('v')
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log("Error sending message:", chrome.runtime.lastError);
                } else {
                    console.log("Message sent successfully:", response);
                }
            });
        }
    } catch (error) {
        console.error('Error getting active tab:', error);
    }
});

chrome.runtime.onMessage.addListener(async (obj, sender, sendResponse) => {
    if (obj.type === 'CREATING_BOOKMARK') {
        sendResponse({ state: true })
        chrome.action.openPopup();

        const port = chrome.runtime.connect({ name: "popup" });
        port.postMessage({ type: 'CREATING' });

        port.onMessage.addListener((response) => {
            if (response.type === 'ACK') {
                console.log("Popup acknowledged the message");
            }
        });
        
    } else if (obj.type === 'STOP_CREATING_BOOKMARK') {
        sendResponse({ state: false })
        const port = chrome.runtime.connect({ name: "popup" });
        port.postMessage({ type: 'STOP_CREATING' });

        port.onMessage.addListener((response) => {
            if (response.type === 'ACK') {
                console.log("Popup acknowledged the message");
            }
        });
        
    }
    return true
})