let popupPort = null;

const getUrlParams = (url) => {
    let urlParams = null
    if (url.includes('youtube.com/watch')) {
        const queryParam = url.split('?')[1];
        urlParams = new URLSearchParams(queryParam).get('v');
    } else if (url.includes('vkvideo.ru/video')) {
        urlParams = tab.url.split('/video-')[1];
    }
    return urlParams
}

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
    const urlParams = getUrlParams(tab.url)
    urlParams && changeInfo.status === 'complete' && chrome.tabs.sendMessage(tabId, {
        type: 'NEW',
        videoId: urlParams
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.log("From background - Error sending message:", chrome.runtime.lastError);
        } else {
            console.log("From background - Message sent successfully:", response);
        }
    });
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        const urlParams = getUrlParams(tab.url)
        chrome.tabs.sendMessage(activeInfo.tabId, {
            type: 'NEW',
            videoId: urlParams
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.log("From background - Error sending message:", chrome.runtime.lastError);
            } else {
                console.log("From background - Message sent successfully:", response);
            }
        });
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