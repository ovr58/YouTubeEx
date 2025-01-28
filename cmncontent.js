const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

(() => {

    let videoPlayer
    let currentVideoId = ""
    let isMessageListenerAdded = false

    const getAllDivs = () => {
        console.log('CONTENT - getAllDivs Called')
        const collectDivElements = () => {
            const collectAllDivElements = (root) => {
                const elements = [];
                let bookmarkAtrValue = 0
                const traverseDom = (node) => {
                    if (node.nodeName.toLowerCase() === 'div' || node.nodeName.includes('-')) {
                        node.setAttribute('bookmarkAtr', bookmarkAtrValue)
                        const rect = node.getBoundingClientRect();
                        if (node.id || node.className) {
                            elements.push({
                                id: node.id,
                                class: node.className,
                                tagName: node.tagName.toLowerCase(),
                                bookmarkAtr: bookmarkAtrValue,
                                rect: {
                                    top: rect.top,
                                    left: rect.left,
                                    width: rect.width,
                                    height: rect.height
                                }
                            });
                        }
                        bookmarkAtrValue++
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
    
        // const curVideoElementData = currValue.videoElement
        const divElements = collectDivElements()
        const divElementsInVideoPlayer = divElements.filter(divElement => {
            const rect = divElement.rect
            return rect.width>64 && rect.height>0 && rect.width>rect.height
        })
        console.log('SORTED DIV ELEMENTS:', divElements)
        console.log('SORTED DIV ELEMENTS SORTED:', divElementsInVideoPlayer)
        return divElements
    }
    
    const checkIfExists = (bookmarks, newBookmarkTime) => {
        return new Promise((resolve, _reject) => {
            for (element of bookmarks) {
                console.log(element.time, newBookmarkTime)
                if (newBookmarkTime <= element.time + 10 && newBookmarkTime >= element.time - 10) {
                    const msgLine1 = chrome.i18n.getMessage('cantAddBookmarkLine1')
                    const msgLine2 = `${chrome.i18n.getMessage('cantAddBookmarkLine2')} ${getTime(element.time-10)} - ${getTime(element.time + 10)}`
                    popupMessage(msgLine1, msgLine2)
                    resolve(true)
                    return
                }
            }
            resolve(false)
        })
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
        const containerToAdd = document.getElementById(containerToAddId)
        if (containerToAdd) {
            containerToAdd.remove()
        }
        return new Promise((resolve, _reject) => {
            if (!parentElement) {
                resolve(containerToAddId)
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

    const addBookmarksOnProgressBar = async (bookmarks, containerId, containerTagName, containerIdClass, bookmarkAtrValue, videoPlayer) => {
        console.log('Progress bar element:', containerId, containerTagName, containerIdClass, bookmarkAtrValue)
        const progressBarElement = document.querySelectorAll(`[bookmarkAtr="${bookmarkAtrValue}"]`)[0]
        console.log('Progress bar element:', progressBarElement, `${containerTagName}${containerId && containerId.length>0 ? '#' : ''}${containerId ? containerId : ''}.${containerIdClass ? containerIdClass : ''}[bookmarkAtr="${bookmarkAtrValue}"]`)
        const progressBarValue = videoPlayer.duration
        const bookmarksContainer = await addContainer(progressBarElement, 'bookmarks-container')
        
        const progressBarWidth = bookmarksContainer.offsetWidth

        console.log('Progress bar width:', bookmarksContainer, progressBarWidth)
        for (let bookmark of bookmarks) {
            const bookmarkElement = document.createElement('img')
            bookmarkElement.id = 'bookmark-' + bookmark.time
            const ifExist = document.getElementById(bookmarkElement.id)
            if (ifExist) {
                ifExist.remove()
                console.log('Bookmark already exists REMOVED')
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

        const containerIdClass = bookmarks[0].containerIdClass

        const controlsIdClass = bookmarks[0].controlsId
        
        const containerIdTagName = bookmarks[0].containerIdTagName

        const controlsIdTagName = bookmarks[0].controlsIdTagName

        const containerIdbookmarkValue = bookmarks[0].containerIdbookmarkValue

        const controlsIdbookmarkValue = bookmarks[0].controlsIdbookmarkValue

        const bookmarkButtonExists = document.getElementsByClassName('bookmark-btn')[0]
        if (bookmarkButtonExists) {
            bookmarkButtonExists.remove()
        }
        addBookmarksOnProgressBar(bookmarks.slice(1), containerId, containerIdTagName, containerIdClass, containerIdbookmarkValue, videoPlayer)
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
        const bookMarkBtn = document.createElement('img')
        bookMarkBtn.src = chrome.runtime.getURL('assets/bookmark64x64.png')
        bookMarkBtn.className = 'bookmark-btn'
        bookMarkBtn.title = chrome.i18n.getMessage('bookmarkButtonTooltip')
        bookMarkBtn.style.cursor = 'pointer'
        bookMarkBtn.style.position = 'block'
        bookMarkBtn.style.zIndex = '9999'
        bookMarkBtn.style.opacity = '0.2'
        bookMarkBtn.style.transition = 'opacity 0.5s'

        if (videoPlayer) {
            const scruberElement = document.querySelectorAll(`[bookmarkAtr="${controlsIdbookmarkValue}"]`)[0]
            console.log('Scrubber element:', scruberElement, `${controlsIdTagName}${controlsId && controlsId.length>0 ? '#' : ''}${controlsId ? controlsId : ''}${controlsIdClass ? controlsIdClass : ''}[bookmarkAtr="${controlsIdbookmarkValue}"]`)
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

    const resizeObserver = new ResizeObserver(async() => newVideoLoaded())
    const resizeObserverPlayer = new ResizeObserver(async() => newVideoLoaded())

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

    !isMessageListenerAdded && chrome.runtime.onMessage.addListener(async (obj, _sender, sendResponse) => {
        isMessageListenerAdded = true
        const { type, value, videoId } = obj

        const valueObj = value ? JSON.parse(value) : {}
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
            videoPlayer = document.getElementById(valueObj.id) || Array.from(document.getElementsByClassName(valueObj.class)).find(element => element.tagName.toLowerCase() === 'video' && element.className === valueObj.class)
            !videoPlayer && (videoPlayer = findElementInFrames(document, valueObj.id, valueObj.class))
            console.log("From content - Video Player:", videoPlayer)
            const newVideoElementSetUp = {
                videoId: videoId,
                videoElement: {id: valueObj.id, class: valueObj.class, rect:valueObj.rect, duration: valueObj.duration},
                containerId: videoPlayer.parentElement.id,
                controlsId: videoPlayer.parentElement.id,
                containerIdClass: videoPlayer.parentElement.className.replace(/ /g, '.'),
                controlsIdClass: videoPlayer.parentElement.className.replace(/ /g, '.'),
                containerIdTagName: videoPlayer.parentElement.tagName.toLowerCase(),
                controlsIdTagName: videoPlayer.parentElement.tagName.toLowerCase(),
                containerIdbookmarkValue: '',
                controlsIdbookmarkValue: '',
                urlTemplate: '',
                title: document.title.replace(/^\(\d+\)\s*/, '').trim(),
            }
            currentVideoBookmarks = currentVideoBookmarks.length===0 ? currentVideoBookmarks = [newVideoElementSetUp] : currentVideoBookmarks.unshift(newVideoElementSetUp)
            await chrome.storage.sync.set({ [videoId]: JSON.stringify(currentVideoBookmarks) }, () => {
                console.log("From content - Video ID saved:", currentVideoBookmarks)
            })
            await createBookmarkInStorage(videoId, '', 0)
            await createBookmarkInStorage(videoId, '', valueObj.duration)
            const allDivElements = getAllDivs(newVideoElementSetUp)
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
            currentVideoBookmarks[0][valueObj.sliderIndex] = valueObj.id 
            currentVideoBookmarks[0][`${valueObj.sliderIndex}Class`] = valueObj.class.replace(/ /g, '.')
            currentVideoBookmarks[0][`${valueObj.sliderIndex}TagName`] = valueObj.tagName
            currentVideoBookmarks[0][`${valueObj.sliderIndex}bookmarkValue`] = valueObj.bookmarkAtr
            console.log('From content - Slider update:', currentVideoBookmarks[0], valueObj)
            chrome.storage.sync.set({ [videoId]: JSON.stringify(currentVideoBookmarks) }, async () => {
                await newVideoLoaded()
                console.log("From content - Slider updated:", currentVideoBookmarks)
                sendResponse({ status: 'Slider update completed' })
            })
        } else if (type === 'NEW') {
            const allDivElements = getAllDivs(currentVideoBookmarks[0])
            await chrome.storage.local.set({ allDivElements: JSON.stringify(allDivElements) }, () => {
                sendResponse({ status: 'Video element setup completed' })
            })
            await chrome.storage.sync.set({ taskStatus: false }, async () => {
                await newVideoLoaded('NEW')
                console.log('Task status set to false');
            });
        } else if (type === 'PLAY') {
            videoPlayer.currentTime = value
        } else if (type === 'DELETE') {
            console.log('Delete bookmark:', value, currentVideoBookmarks)
            currentVideoBookmarks = currentVideoBookmarks.filter(bookmark => bookmark.time != value)
            await chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, async () => {
                await newVideoLoaded('DELETE')
                console.log('Bookmark deleted:', value, currentVideoBookmarks)
            })
        } else if (type === 'UPDATE') {
            const { time, title } = valueObj
            currentVideoBookmarks = currentVideoBookmarks.map(bookmark => {
                if (bookmark.time === time) {
                    bookmark.title = title
                }
                return bookmark
            })
            await chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, async () => {
                await newVideoLoaded('UPATE')
                console.log('Bookmark updated:', value, currentVideoBookmarks)
            })
        }
        return true
    })
})();