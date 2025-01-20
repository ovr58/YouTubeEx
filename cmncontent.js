const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

(() => {

    let videoPlayer
    let currentVideoId = ""

    const addContainer = (parentElement, containerToAddId) => {
        return new Promise((resolve, _reject) => {
            if (!parentElement) {
                resolve()
                return
            }
            const observer = new MutationObserver((mutations, observer) => {
                const containerToAdd = document.getElementById(containerToAddId);
                if (containerToAdd) {
                    observer.disconnect();
                    resolve(containerToAdd);
                }
            })
            observer.observe(parentElement, { childList: true, subtree: true })
            let containerToAdd = document.getElementById(containerToAddId)
            if (!containerToAdd) {
                containerToAdd = document.createElement('div')
                containerToAdd.id = containerToAddId
                containerToAdd.style.position = 'relative'
                containerToAdd.style.width = '100%'
                containerToAdd.style.height = '100%'
                containerToAdd.style.zIndex = '9999'
                parentElement.appendChild(containerToAdd)
                console.log('Bookmarks container created:', containerToAdd)
            } else {
                containerToAdd.innerHTML = ''
                observer.disconnect();
                resolve(containerToAdd);
            }
        })
    }

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
                        resolve([]);
                    } else {
                        resolve(obj[currentVideoId] ? JSON.parse(obj[currentVideoId]) : []);
                    }
                });
            } catch (error) {
                console.error('Unexpected error:', error);
                popupMessage(chrome.i18n.getMessage("unexpectedError"), chrome.i18n.getMessage("reloadTab"));
                resolve([]);
            }
    }) : []
    }

    const addBookmarksOnProgressBar = async (bookmarks, containerId, duration) => {
        const progressBarElement = document.getElementsById(containerId)
        const progressBarValue = duration
        const bookmarksContainer = await addContainer(progressBarElement,'bookmarks-container')
        
        const progressBarWidth = bookmarksContainer.offsetWidth

        console.log('Progress bar width:', progressBarWidth)
        for (let bookmark of bookmarks) {
            const bookmarkElement = document.createElement('img')
            bookmarkElement.id = 'bookmark-' + bookmark.time
            const ifExist = document.getElementById(bookmarkElement.id)
            if (ifExist) {
                ifExist.remove()
            }
            bookmarkElement.className = 'bookmark-on-progress'
            bookmarkElement.src = chrome.runtime.getURL('assets/bookmark64x64.png')
            bookmarkElement.style.cursor = 'pointer'
            bookmarkElement.style.position = 'absolute'
            console.log('BOOKMARK TIME:', bookmark.time)
            bookmarkElement.style.left = `${((bookmark.time / progressBarValue) * progressBarWidth)-8}px`
            bookmarkElement.style.top = '-4px'
            bookmarkElement.style.width = '16px'
            bookmarkElement.style.height = '16px'
            bookmarkElement.style.zIndex = '9990'
            bookmarkElement.title = bookmark.title
            bookmarksContainer.appendChild(bookmarkElement)
        }
    }

    const newVideoLoaded = async () => {
        
        const bookmarks = await fetchBookmarks(currentVideoId)

        const videoPlayer = document.getElementById(bookmarks[0].videoElement.id) || document.getElementsByClassName(bookmarks[0].videoElement.class)[0]

        console.log('Video player from newVideoLoaded():', videoPlayer, videoPlayer.duration)

        const containerId = bookmarks[0].containerId

        const controlsId = bookmarks[0].controlsId

        const bookmarkButtonExists = document.getElementsByClassName('bookmark-btn')[0]
        addBookmarksOnProgressBar(bookmarks.slice(1), containerId, videoPlayer.duration)
        if (!resizeObserver.observing) {
            resizeObserver.observe(document.body)
            resizeObserver.observing = true
        }
        if (!resizeObserverPlayer.observing) {
            if (videoPlayer) {
                resizeObserverPlayer.observe(videoPlayer)
                resizeObserverPlayer.observing = true
            }
        }
        if (!bookmarkButtonExists) {
            const bookMarkBtn = document.createElement('img')
            bookMarkBtn.src = chrome.runtime.getURL('assets/bookmark64x64.png')
            bookMarkBtn.className = 'bookmark-btn'
            bookMarkBtn.title = chrome.i18n.getMessage('bookmarkButtonTooltip')
            bookMarkBtn.style.cursor = 'pointer'
            bookMarkBtn.style.position = 'block'
            bookMarkBtn.style.zIndex = '150'
            bookMarkBtn.style.opacity = '0.2'
            bookMarkBtn.style.transition = 'opacity 0.5s'
    
            if (videoPlayer) {
                const scruberElement = document.getElementsById(controlsId)
                scruberElement.appendChild(bookMarkBtn)
                bookMarkBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    bookmarkClickEventHandler(event);
                })
                bookMarkBtn.addEventListener('mouseover', () => {
                    bookMarkBtn.style.opacity = '1';
                });
                bookMarkBtn.addEventListener('mouseout', () => {
                    bookMarkBtn.style.opacity = '0.2';
                });
            }
        }
    }

    const createBookmarkInStorage = async (currentVideoId, urlTemplate, currentTime) => {
        await chrome.storage.sync.set({ taskStatus: true }, () => {
            console.log('Task status set to started');
        });
        chrome.runtime.sendMessage({ type: "CREATING_BOOKMARK" })
        const currVideoTitle = document.title.replace(/^\(\d+\)\s*/, '').trim()
        const newBookmark = {
            videoId: currentVideoId,
            urlTemplate: urlTemplate,
            time: currentTime,
            title: currVideoTitle + ' - ' + getTime(currentTime),
        }

        newBookmark.bookMarkCaption = newBookmark.title

        await chrome.storage.sync.set({[currentVideoId]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a,b) => a.time - b.time))}, async () => {
            await newVideoLoaded()
            console.log('Bookmark added from vkcontent.js:', newBookmark)
        })
        await chrome.storage.sync.set({ taskStatus: false }, () => {
            console.log('Task status set to completed');
        });
        chrome.runtime.sendMessage({ type: "STOP_CREATING_BOOKMARK"})
    }

    const bookmarkClickEventHandler = async () => {

        videoPlayer.pause()
        
        let currentVideoBookmarks = []

        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
            return
        }

        const currentTime = videoPlayer.currentTime

        const exists = await checkIfExists(currentVideoBookmarks, currentTime)
        if (exists) return

        await createBookmarkInStorage(currentVideoId, '', currentTime)
    }

    chrome.runtime.onMessage.addListener(async (obj, _sender, _sendResponse) => {

        const { type, value, videoId } = obj

        let currentVideoBookmarks = []
        try {
            currentVideoBookmarks = await fetchBookmarks(videoId)
        } catch (error) {
            console.error('Error fetching bookmarks or no bookmarks:', error)
        }
        
        if (type === 'SETUP_VIDEO_ELEMET') {
            const allowedUrls = await fetchAllowedUrls()
            console.log('Allowed URLs:', allowedUrls)
            await chrome.storage.sync.set({ allowedUrls: allowedUrls ? JSON.stringify([...allowedUrls, videoId]) : JSON.stringify([videoId]) }, async () => {
                const newVideoElementSetUp = {
                    videoElement: {id: value.id, class: value.className, duration: value.duration},
                    containerId: value.parentElement.id,
                    controlsId: value.parentElement.id,
                }
                currentVideoBookmarks = currentVideoBookmarks.length>0 ? currentVideoBookmarks[0] = newVideoElementSetUp : currentVideoBookmarks.unshift(newVideoElementSetUp)
                await chrome.storage.sync.set({ [videoId]: JSON.stringify(currentVideoBookmarks) }, () => {
                    console.log("From content - Video ID saved:", videoId)
                })
                console.log("From content - Allowed URLs and videoelement updated:", allowedUrls, currentVideoBookmarks)
            })
            videoPlayer = document.getElementById(value.id) || document.getElementsByClassName(value.className)[0]
            console.log("From content - Video Player:", videoPlayer)
            await createBookmarkInStorage(videoId, '', 0)
            await createBookmarkInStorage(videoId, '', value.duration)
        }
        return true
    })
})();