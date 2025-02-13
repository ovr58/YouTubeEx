
const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

const contentFunc = () => {

    let dzenPlayer
    let currentVideoId = ""
    let isDurationChangeListenerAdded = false
    let durationOld
    let newVideoLoadedExecutedTimes = 0

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

    const popupMessage = (line1, line2) => {
        const bookMarkBtn = document.getElementsByClassName('bookmark-btn')[0]
        const isExist = document.getElementById('messageDiv')
        if (isExist) {
            isExist.remove()
        }
        const messageDiv = document.createElement('div');
        messageDiv.id = 'messageDiv';
        messageDiv.style.display = 'flex';
        messageDiv.style.flexDirection = 'column';
        messageDiv.style.justifyContent = 'center';
        messageDiv.style.alignItems = 'center';
        messageDiv.style.position = 'absolute';
        messageDiv.style.top = `${bookMarkBtn.offsetTop}px`;
        messageDiv.style.left = `${bookMarkBtn.offsetRight-50}px`;
        messageDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        messageDiv.style.color = 'white';
        messageDiv.style.padding = '5px 5px';
        messageDiv.style.height = '40px';
        messageDiv.style.borderRadius = '10px';
        messageDiv.style.textAlign = 'center'
        messageDiv.style.zIndex = '150';

        const messageLine1 = document.createElement('p');
        messageLine1.style.margin = '0';
        messageLine1.style.padding = '0';
        messageLine1.style.height = 'auto';
        messageLine1.innerText = line1;
        const messageLine2 = document.createElement('p');
        messageLine2.style.margin = '0';
        messageLine2.style.paddingTop = '2px';
        messageLine2.style.height = 'auto';
        messageLine2.innerText = line2;
        messageDiv.appendChild(messageLine1);
        messageDiv.appendChild(messageLine2);
        bookMarkBtn.parentElement.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    const addBookmarksOnProgressBar = async (bookmarks) => {
        const progressBarElement = document.getElementsByClassName('zen-ui-video-video-timeline__clickable-zone')[0]
        const progressBarValue = dzenPlayer.duration
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

    const addResizeObserver = () => {

        const isWindowObserverAdded = document.body.getAttribute('resizeObserverAdded')
        const isPlayerObserverAdded = dzenPlayer.getAttribute('resizeObserverAdded')
        const isDurationChangeObserverAdded = dzenPlayer.getAttribute('durationObserverAdded')

        if (!isWindowObserverAdded) {
            const resizeObserver = new ResizeObserver(() => {
                const handleFunc = async () => await newVideoLoaded('RESIZE WINDOW')
                handleFunc().catch(error => console.error('Error handling resize:', error))
            })
            resizeObserver.observe(document.body)
            document.body.setAttribute('resizeObserverAdded', true)
        }

        if (!isPlayerObserverAdded) {
            const resizeObserverPlayer = new ResizeObserver(() => {
                const handleFunc = async () => await newVideoLoaded('RESIZE PLAYER')
                handleFunc().catch(error => console.error('Error handling resize:', error))
            })
            resizeObserverPlayer.observe(document.querySelectorAll('video.zen-ui-video-video-player__player')[0])
            document.document.querySelectorAll('video.zen-ui-video-video-player__player')[0].setAttribute('resizeObserverAdded', true)
        }

        if (!isDurationChangeObserverAdded) {
            console.log('duration change listener will be added:', isDurationChangeListenerAdded)
            
            dzenPlayer.addEventListener('durationchange', () => {
                const handleDurationChange = async () => await newVideoLoaded('DURATION CHANGE')
                if (durationOld === dzenPlayer.duration) {
                    return
                }
                durationOld = dzenPlayer.duration
                handleDurationChange().catch(error => console.error('Error handling duration change:', error))
            })
        }
    }

    const addBookmarkButton = () => {
        const scruberElement = document.getElementsByClassName('video-site--video-header__row-1m')[0]
        console.log('Scrubber element:', scruberElement)
        const bookmarkButtonExists = document.getElementById('bookmark-btn')
        if (bookmarkButtonExists) {
            bookmarkButtonExists.remove()
        }
        if (scruberElement) {
            const bookMarkBtn = document.createElement('img')
            bookMarkBtn.src = chrome.runtime.getURL('assets/bookmark64x64.png')
            bookMarkBtn.className = 'bookmark-btn'
            bookMarkBtn.id = 'bookmark-btn'
            bookMarkBtn.title = chrome.i18n.getMessage('bookmarkButtonTooltip')
            bookMarkBtn.style.cursor = 'pointer'
            bookMarkBtn.style.position = 'block'
            bookMarkBtn.style.zIndex = '150'
            bookMarkBtn.style.opacity = '0.2'
            bookMarkBtn.style.transition = 'opacity 0.5s'
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

    const fetchBookmarks = (currentVideoId) => {
        return currentVideoId ? new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.get([currentVideoId], (obj) => {
                    console.log('Bookmarks fetched IN dzencontent:', obj)
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

    const newVideoLoaded = async (fromMessage) => {
        newVideoLoadedExecutedTimes++
        const bookmarks = await fetchBookmarks(currentVideoId)
        dzenPlayer = document.querySelectorAll('video.zen-ui-video-video-player__player')[0]
        console.log('Fetch called from newVideoLoaded', fromMessage, newVideoLoadedExecutedTimes)
        newVideoLoadedExecutedTimes === 1 && addBookmarkButton()
        // clearBookmarksOnProgressBar() 
        // if (bookmarks.length > 0) {
            addBookmarksOnProgressBar(bookmarks)
        // }
        addResizeObserver()
        newVideoLoadedExecutedTimes--
    }

    const bookmarkClickEventHandler = async () => {
        console.log('Bookmark button clicked', dzenPlayer)
        dzenPlayer.pause()
        
        let currentVideoBookmarks = []

        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
            return
        }

        const currentTime = dzenPlayer.currentTime

        const exists = await checkIfExists(currentVideoBookmarks, currentTime)
        if (exists) return

        await chrome.storage.sync.set({ taskStatus: true }, () => {
            console.log('Task status set to started');
        });
        chrome.runtime.sendMessage({ type: "CREATING_BOOKMARK" })
        const currVideoTitle = document.title.replace(/^\(\d+\)\s*/, '').trim()
        const newBookmark = {
            videoId: currentVideoId,
            urlTemplate: 'https://dzen.ru/video/watch/',
            time: currentTime,
            title: currVideoTitle + ' - ' + getTime(currentTime),
        }
        
        newBookmark.bookMarkCaption = newBookmark.title

        await chrome.storage.sync.set({[currentVideoId]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a,b) => a.time - b.time))}, async () => {
            await newVideoLoaded()
            console.log('Bookmark added from dzencontent.js:', newBookmark)
        })
        await chrome.storage.sync.set({ taskStatus: false }, () => {
            console.log('Task status set to completed');
        });
        chrome.runtime.sendMessage({ type: "STOP_CREATING_BOOKMARK"})
    }

    const dzencontentOnMessageListener = (obj, _sender, _sendResponse) => {
        const { type, value, videoId } = obj
        currentVideoId = videoId
        let currentVideoBookmarks = []
        const handleFetchBookmarks = async () => {
            try {
                currentVideoBookmarks = await fetchBookmarks(currentVideoId)
                console.log('Fetch called from onMessage')
            } catch (error) {
                console.error('Error fetching bookmarks:', error)
            }
        }
        handleFetchBookmarks().catch(error => console.error('Error fetching bookmarks:', error))
        console.log('Message received in dzencontent.js:', obj, currentVideoBookmarks)
        console.log('Message received in dzencontent.js:', obj, currentVideoBookmarks)
        if (type === 'NEW') {
            const handleNewVideoLoaded = async () => {
                await chrome.storage.sync.set({ taskStatus: false }, async () => {
                    await newVideoLoaded('NEW')
                    console.log('Task status set to false');
                });
            }
            handleNewVideoLoaded().catch(error => console.error('Error handling new video:', error))
        } else if (type === 'PLAY') {
            dzenPlayer.currentTime = value
            dzenPlayer.play()
        } else if (type === 'DELETE') {
            const handleDeleteBookmark = async () => {
                await chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, async () => {
                    await newVideoLoaded('DELETE')
                    console.log('Bookmark deleted:', value, currentVideoBookmarks)
                })
            }
            console.log('Delete bookmark:', value, currentVideoBookmarks)
            currentVideoBookmarks = currentVideoBookmarks.filter(bookmark => bookmark.time != value)
            handleDeleteBookmark().catch(error => console.error('Error deleting bookmark:', error))
        } else if (type === 'UPDATE') {
            const handleUpdateBookmark = async () => {
                await chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, async () => {
                    await newVideoLoaded('UPATE')
                    console.log('Bookmark updated:', value, currentVideoBookmarks)
                })
            }
            const { time, title } = JSON.parse(value)
            currentVideoBookmarks = currentVideoBookmarks.map(bookmark => {
                if (bookmark.time === time) {
                    bookmark.title = title
                }
                return bookmark
            })
            handleUpdateBookmark().catch(error => console.error('Error updating bookmark:', error))
        }
        return true
    }

    chrome.storage.local.get('isDzenMessageListenerAdded', (result) => {
        if (!result.isDzenMessageListenerAdded) {
            chrome.runtime.onMessage.addListener(dzencontentOnMessageListener);
            chrome.storage.local.set({ isDzenMessageListenerAdded: true }, () => {
                console.log('onMessage listener added');
            });
        } else {
            console.log('onMessage listener already added');
            chrome.runtime.onMessage.removeListener(dzencontentOnMessageListener);
            chrome.runtime.onMessage.addListener(dzencontentOnMessageListener);
            console.log('onMessage listener re-added');
        }
    });
};

contentFunc()

