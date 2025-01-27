let popupPort = null;
let updateListener = false
let activateListener = false
let onMessageListener = false

const fetchAllowedUrls = () => {
    return new Promise((resolve, _reject) => {
        chrome.storage.sync.get(['allowedUrls'], (obj) => {
            resolve(obj.allowedUrls ? JSON.parse(obj.allowedUrls) : [])
        })
    })
}

const getUrlParams = async (url) => {
    let urlParams = null
    let allowedUrls = await fetchAllowedUrls()
    console.log('From background - allowedUrls:', allowedUrls, url);
    if (url.includes('www.youtube.com/watch')) {
        const queryParam = url.split('?')[1];
        urlParams = new URLSearchParams(queryParam).get('v');
    } else if (/vk(video\.ru|\.com)\/video/.test(url)) {
        urlParams = url.split('/video-')[1];
    } else if (allowedUrls && allowedUrls.includes(url)) {
        urlParams = url
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

!updateListener &&  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    updateListener = true
    console.log("From background - Tab updated:", tabId, changeInfo, tab);
    const urlParams = await getUrlParams(tab.url)
    urlParams && changeInfo.status === 'complete' && await chrome.tabs.sendMessage(tabId, {
        type: 'NEW',
        videoId: urlParams
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.log("From background - Error sending message:", chrome.runtime.lastError);
        } else {
            console.log("From background - Message sent successfully on updated:", response);
        }
    });
})

!activateListener && chrome.tabs.onActivated.addListener(async (activeInfo) => {
    activateListener = true
    console.log("From background - Tab activated:", activeInfo);
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        const urlParams = await getUrlParams(tab.url)
        console.log("From background - urlParams:", urlParams);
        if (urlParams) {
            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, updatedTab) {
                if (tabId === activeInfo.tabId && changeInfo.status === 'complete') {
                    console.log("From background - sending message on activated:");
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
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            });
        }
    } catch (error) {
        console.error('From background - Error getting active tab:', error);
    }
});

!onMessageListener && chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    onMessageListener = true
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