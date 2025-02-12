let popupPort = null;
let updateListener = false
let activateListener = false
let onMessageListener = false
let portListerActive = false
let contentListenerFlag = false

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
    } else if (url.includes('dzen')) {
        urlParams = url.split('watch/')[1];
    } else if (url.includes('music.youtube')) {
        const queryParam = url.split('?')[1];
        urlParams = new URLSearchParams(queryParam).get('v');
    } else if (url.includes('open.spotify.com')) {
        urlParams = 'spotify';
    } else if (allowedUrls && allowedUrls.includes(url)) {
        urlParams = url
    }
    return urlParams
}



!portListerActive && chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "popup") {
        popupPort = port;
        console.log("Popup opened");

        port.onDisconnect.addListener(() => {
            console.log("Popup closed");
            popupPort = null;
        });

    }
    portListerActive = true
});

!updateListener &&  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    updateListener = true
    console.log("From background - Tab updated:", tabId, changeInfo, tab);
    if (changeInfo.status === 'complete') {
        const handleUpdate = async () => {

            const urlParams = await getUrlParams(tab.url)
            console.log("From background on updated - urlParams:", urlParams);
            urlParams && await chrome.tabs.sendMessage(tabId, {
                type: 'NEW',
                videoId: urlParams
            }, (response) => {
                if (response === false) {
                    console.log("From background - Message not sent on updated:", response);
                    return
                }
                if (chrome.runtime.lastError) {
                    console.log("From background - Error sending message:", chrome.runtime.lastError);
                } else {
                    console.log("From background - Message sent successfully on updated:", response);
                }
            });
        }
        handleUpdate().catch(console.error);
    }
})

!activateListener && chrome.tabs.onActivated.addListener((activeInfo) => {
    activateListener = true
    console.log("From background - Tab activated:", activeInfo);
    try {
        const handleActivation = async () => {

            const tab = await chrome.tabs.get(activeInfo.tabId);
            const urlParams = await getUrlParams(tab.url)
            console.log("From background - urlParams:", urlParams);
            if (urlParams) {
                chrome.tabs.onUpdated.addListener((tabId, changeInfo, updatedTab) =>{
                    if (changeInfo.status === 'complete') {
                        const handleUpdate = async () => {
                            console.log("From background - sending message on activated:");
                            await chrome.tabs.sendMessage(activeInfo.tabId, {
                                type: 'NEW',
                                videoId: urlParams
                            }, (response) => {
                                if (response === false) {
                                    console.log("From background - Message not sent on updated in activated:", response);
                                    return
                                }
                                if (chrome.runtime.lastError) {
                                    console.log("From background - Error sending message:", chrome.runtime.lastError);
                                } else {
                                    console.log("From background - Message sent successfully:", response);
                                }
                            });
                            chrome.tabs.onUpdated.removeListener();
                        }
                        handleUpdate().catch(console.error);
                    }
                });
                await chrome.tabs.sendMessage(activeInfo.tabId, {
                    type: 'NEW',
                    videoId: urlParams
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("From background - Error sending message:", chrome.runtime.lastError);
                    } else {
                        console.log("From background - Message sent successfully:", response);
                    }
                });
            }
        }
        handleActivation().catch(console.error);
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
    } else if (request.type === "ELEMENT_FOUND") {
        const handleElementFound = async () => {
            const urlParams = await getUrlParams(sender.tab.url)

            console.log("From background - Element found, sending 'NEW' message again");
            chrome.tabs.sendMessage(sender.tab.id, { type: 'NEW', videoId: urlParams }, (response) => {
                if (response === false) {
                    console.log("From background - Message not sent on element found:", response);
                    return
                }
                if (chrome.runtime.lastError) {
                    console.log("From background - Error sending message:", chrome.runtime.lastError);
                } else {
                    console.log("From background - Message sent successfully on element found:", response);
                }
            });
        }
        handleElementFound().catch(console.error);
    } 
});