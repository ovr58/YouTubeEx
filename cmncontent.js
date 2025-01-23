const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

(() => {

    let videoPlayer
    let currentVideoId = ""

    const getAllDivs = async (currValue) => {
        console.log('CONTENT - getAllDivs Called:', currValue)
        const collectDivElements = () => {
            const collectAllDivElements = (root) => {
                const elements = [];

                const traverseDom = (node) => {
                    if (node.nodeName.toLowerCase() === 'div') {
                        const rect = node.getBoundingClientRect();
                        elements.push({
                            id: node.id,
                            class: node.className,
                            rect: {
                                top: rect.top,
                                left: rect.left,
                                width: rect.width,
                                height: rect.height
                            }
                        });
                    }
                    node.childNodes.forEach(child => traverseDom(child));
                };

                traverseDom(root);
                return elements;
            };
        
            const allDivElements = collectAllDivElements(document.body);
            console.log('All <div> elements:', allDivElements);
            return allDivElements;
        }
    
        const curVideoElementData = currValue.videoElement
        const divElements = collectDivElements()
        const divElementsInVideoPlayer = divElements.filter(divElement => {
            const rect = divElement.rect
            return (divElement.id.length>0 || divElement.class.length>0) && rect.top > curVideoElementData.rect.top && rect.left > curVideoElementData.rect.left && rect.width < curVideoElementData.rect.width && rect.height < curVideoElementData.rect.height && rect.top + rect.height < curVideoElementData.rect.top + curVideoElementData.rect.height && rect.left + rect.width < curVideoElementData.rect.left + curVideoElementData.rect.width
        })
        console.log('SORTED DIV ELEMENTS:', divElementsInVideoPlayer)
        return divElementsInVideoPlayer
    }
    

    const clearBookmarksOnProgressBar = () => {
        const deleteOldBookmarks = document.getElementsByClassName('bookmark-on-progress')
        if (deleteOldBookmarks.length === 0) {
            return
        }
        console.log('Delete old bookmarks:', deleteOldBookmarks)
            
        for (let bookmark of deleteOldBookmarks) {
            console.log('Delete bookmark:', bookmark)
            bookmark.remove()
        }
    }

    const findElementInFrames = (root, id, className) => {
        let element = root.getElementById(id) || Array.from(root.getElementsByClassName(className)).find(element => element.tagName.toLowerCase() === 'video');
        if (element) {
            return element;
        }
    
        const iframes = Array.from(root.querySelectorAll('iframe'));
        for (const iframe of iframes) {
            try {
                const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
                element = findElementInFrames(iframeDocument, id, className);
                if (element) {
                    return element;
                }
            } catch (e) {
                console.error('Error accessing iframe content:', e);
            }
        }
    
        return null;
    };

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

    const addBookmarksOnProgressBar = async (bookmarks, containerId, videoPlayer) => {
        const progressBarElement = document.getElementById(containerId) || Array.from(document.getElementsByClassName(containerId)).find(element => element.tagName.toLowerCase() === 'div')
        console.log('Progress bar element:', progressBarElement, containerId)
        const progressBarValue = videoPlayer.duration
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

        console.log('Bookmarks from newVideoLoaded():', currentVideoId, bookmarks)

        videoPlayer = document.getElementById(bookmarks[0].videoElement.id) || Array.from(document.getElementsByClassName(bookmarks[0].videoElement.class)).find(element => element.tagName.toLowerCase() === 'video')

        console.log('Video player from newVideoLoaded():', videoPlayer, videoPlayer.duration)

        const containerId = bookmarks[0].containerId

        const controlsId = bookmarks[0].controlsId

        const bookmarkButtonExists = document.getElementsByClassName('bookmark-btn')[0]
        addBookmarksOnProgressBar(bookmarks.slice(1), containerId, videoPlayer)
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
                const scruberElement = document.getElementById(controlsId) || Array.from(document.getElementsByClassName(controlsId)).find(element => element.tagName.toLowerCase() === 'div')
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

    const resizeObserver = new ResizeObserver(newVideoLoaded)
    const resizeObserverPlayer = new ResizeObserver(newVideoLoaded)

    resizeObserver.observing = false
    resizeObserverPlayer.observing = false

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

        let currentVideoBookmarks = []

        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
            return
        }

        console.log('Current video bookmarks FROM CREATEBOOKMARKINSTORAGE:', currentVideoBookmarks)

        newBookmark.bookMarkCaption = newBookmark.title

        await chrome.storage.sync.set({[currentVideoId]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a,b) => a.time - b.time))}, async () => {
            await newVideoLoaded()
            console.log('Bookmark added from content:', newBookmark)
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

    chrome.runtime.onMessage.addListener(async (obj, _sender, sendResponse) => {

        const { type, value, videoId } = obj

        const valueObj = JSON.parse(value)
        currentVideoId = videoId
        console.log('From content - Message received:', type, valueObj, videoId)

        let currentVideoBookmarks = []
        try {
            currentVideoBookmarks = await fetchBookmarks(videoId)
        } catch (error) {
            console.error('Error fetching bookmarks or no bookmarks:', error)
        }
        
        if (type === 'SETUP_VIDEO_ELEMET') {
            const allowedUrls = await fetchAllowedUrls()
            console.log('Allowed URLs:', allowedUrls, valueObj.id, valueObj.class)
            await chrome.storage.sync.set({ allowedUrls: allowedUrls ? JSON.stringify([...allowedUrls, videoId]) : JSON.stringify([videoId]) }, () => {
                console.log("From content - Allowed URLs and videoelement updated:", allowedUrls)
            })
            videoPlayer = document.getElementById(valueObj.id) || Array.from(document.getElementsByClassName(valueObj.class)).find(element => element.tagName.toLowerCase() === 'video')
            !videoPlayer && (videoPlayer = findElementInFrames(document, valueObj.id, valueObj.class))
            console.log("From content - Video Player:", videoPlayer)
            const newVideoElementSetUp = {
                videoId: videoId,
                videoElement: {id: valueObj.id, class: valueObj.class, rect: valueObj.rect, duration: valueObj.duration},
                containerId: videoPlayer.parentElement.id || videoPlayer.parentElement.className,
                controlsId: videoPlayer.parentElement.id || videoPlayer.parentElement.className,
                urlTemplate: '',
                title: document.title.replace(/^\(\d+\)\s*/, '').trim(),
            }
            currentVideoBookmarks = currentVideoBookmarks.length===0 ? currentVideoBookmarks = [newVideoElementSetUp] : currentVideoBookmarks.unshift(newVideoElementSetUp)
            await chrome.storage.sync.set({ [videoId]: JSON.stringify(currentVideoBookmarks) }, () => {
                console.log("From content - Video ID saved:", currentVideoBookmarks)
            })
            await createBookmarkInStorage(videoId, '', 0)
            await createBookmarkInStorage(videoId, '', valueObj.duration)
            const allDivElements = await getAllDivs(newVideoElementSetUp)
            await chrome.storage.local.set({ allDivElements: JSON.stringify(allDivElements) }, () => {
                sendResponse({ status: 'Video element setup completed' })
            })
        } else if (type === 'SLIDER_UPDATE') {
            console.log('From content - Slider update:', valueObj, videoId)
            const bookmarkButtonExists = document.getElementsByClassName('bookmark-btn')[0]
            if (bookmarkButtonExists) {
                bookmarkButtonExists.remove()
            }
            clearBookmarksOnProgressBar()
            currentVideoBookmarks[0][valueObj.sliderIndex] = valueObj.id || valueObj.class

            await chrome.storage.sync.set({ [videoId]: JSON.stringify(currentVideoBookmarks) }, async () => {
                await newVideoLoaded()
                console.log("From content - Slider updated:", currentVideoBookmarks)
                sendResponse({ status: 'Slider update completed' })
            })
        }
        return true
    })
})();