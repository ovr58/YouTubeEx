const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

(() => {

    let videoPlayer
    let currentVideoId = ""

    const fetchAllowedUrls = () => {
        return new Promise((resolve, _reject) => {
            chrome.storage.sync.get(['allowedUrls'], (obj) => {
                resolve(obj.allowedUrls ? JSON.parse(obj.allowedUrls) : [])
            })
        })
    }

    const fetchBookmarks = (currentVideoId) => {
        return currentVideoId ? new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.get([currentVideoId], (obj) => {
                    console.log('Bookmarks fetched IN cmncontent:', obj)
                    if (chrome.runtime.lastError) {
                        console.error('Error fetching bookmarks:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(obj[currentVideoId] ? JSON.parse(obj[currentVideoId]) : []);
                    }
                });
            } catch (error) {
                console.error('Unexpected error:', error);
                popupMessage(chrome.i18n.getMessage("unexpectedError"), chrome.i18n.getMessage("reloadTab"));
                reject(error);
            }
    }) : []
    }


    const highlightVideoElements = async (activeTabId, videoId) => {
        const videoElements = document.querySelectorAll('video');
        console.log('Video elements:', videoElements);
        videoElements.forEach(video => {
            video.style.border = '2px solid red';
            video.addEventListener('mouseover', () => {
                video.style.outline = '4px solid yellow';
            });
            video.addEventListener('mouseout', () => {
                video.style.outline = '';
            });
            video.addEventListener('click', async () => {
                const videoId = video.id || 'no-id';
                const videoClass = video.className || 'no-class';
                const videoInfo = { id: videoId, class: videoClass };
                await chrome.storage.sync.set(
                    { [videoId]: [JSON.stringify(videoInfo)] },
                    () => {
                        console.log("From content - Video info saved:", videoInfo);
                    }
                );
            });
        });
    }

    chrome.runtime.onMessage.addListener(async (obj, _sender, _sendResponse) => {

        const { type, value, videoId } = obj

        let currentVideoBookmarks = []
        if (type !=='SETUP') {
            try {
            currentVideoBookmarks = await fetchBookmarks(videoId)
            } catch (error) {
                console.error('Error fetching bookmarks:', error)
            }
        }
        
        if (type === 'SETUP') {
            const allowedUrls = await fetchAllowedUrls()
            console.log('Allowed URLs:', allowedUrls)
            await chrome.storage.sync.set({ allowedUrls: allowedUrls ? JSON.stringify([...allowedUrls, value]) : JSON.stringify([value]) }, () => {
                console.log("From content - Allowed URLs updated:", [...allowedUrls, value])
            })
        } else if (type === 'videoElementNeedSetup') {
            highlightVideoElements(value, videoId)
            currentVideoBookmarks[0] = {
                title: videoId,
                videoELement: 'settingUp',
                containerId: 'needSetUp',
                controlsId: 'needSetUp'
            }
            await chrome.storage.sync.set({ [videoId]: JSON.stringify(currentVideoBookmarks) }, () => {
                console.log("From content - Video info saved:", currentVideoBookmarks)
            })
        }
        return true
    })
})();