const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

(() => {

    let vkPlayer
    let currentVideoId = ""

    const fetchAllowedUrls = () => {
        return new Promise((resolve, _reject) => {
            chrome.storage.sync.get(['allowedUrls'], (obj) => {
                resolve(obj.allowedUrls)
            })
        })
    }

    chrome.runtime.onMessage.addListener(async (obj, _sender, _sendResponse) => {

        const { type, value, videoId } = obj
        
        if (type === 'SETUP') {
            const allowedUrls = await fetchAllowedUrls()
            await chrome.storage.sync.set({ allowedUrls: allowedUrls ? JSON.stringify([...allowedUrls, value]) : JSON.stringify([value]) }, () => {
                console.log("From content - Allowed URLs updated:", value)
            })
        }
        return true
    })
})();