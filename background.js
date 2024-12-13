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