
const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

const contentFunc = () => {

    let youtubePlayer
    let currentVideoId = ""
    let isMessageListenerAdded = false
    let isDurationChangeListenerAdded = false
    let durationOld
    let newVideoLoadedExecutedTimes = 0
    let curProgressBarQuerySmall = 'ytmusic-player-controls#player-controls div.progress-bar-container.style-scope.ytmusic-player-controls'
    let curProgressBarQueryBig = 'div#player-bar-background'
    let curBookmarkButtonContainerBig = 'div.right-content.style-scope.ytmusic-nav-bar'
    let curBookmarkButtonContainerSmall = 'ytmusic-player-page#player-page div.content.style-scope.ytmusic-player-page div#side-panel tp-yt-paper-tabs.tab-header-container.style-scope.ytmusic-player-page div#tabsContainer.style-scope.tp-yt-paper-tabs div#tabsContent.tabs-content.fit-container.style-scope.tp-yt-paper-tabs.style-scope.tp-yt-paper-tabs'
    let oldProgressBarSizeBig = 0
    let oldProgressBarSizeSmall = 0
    let bookmarkOnProgressBarTopBig = '-25px'
    let bookmarkOnProgressBarTopSmall = '-35px'

    const addDurationChangeListener = (player) => {
        if (!isDurationChangeListenerAdded) {
            console.log('duration change listener will be added:', isDurationChangeListenerAdded)
            player.addEventListener('durationchange', async () => {
                if (durationOld === player.duration) {
                    return
                }
                durationOld = player.duration
                console.log('Duration changed:', durationOld, player.duration)
                await newVideoLoaded()
            })
        }
    }

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

    const popupMessage = (line1, line2, buttonClass) => {
        let bookMarkBtn = document.getElementsByClassName(buttonClass)[0]
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

    const addBookmarksOnProgressBar = async (bookmarks) => {
        const progressBarElementBig = document.querySelectorAll(curProgressBarQueryBig)[0]
        const progressBarElementSmall = document.querySelectorAll(curProgressBarQuerySmall)[0]
        console.log('Progress bar element:', progressBarElementBig, progressBarElementSmall)
        const progressBarValue = youtubePlayer.duration
        const bookmarksContainerBig = await addContainer(progressBarElementBig,'bookmarks-container')
        const bookmarksContainerSmall = await addContainer(progressBarElementSmall,'bookmarks-container-small')
        
        const progressBarWidthBig = bookmarksContainerBig.offsetWidth
        const progressBarWidthSmall = bookmarksContainerSmall ?bookmarksContainerSmall.offsetWidth : 0

        console.log('Progress bar width:', progressBarWidthBig, progressBarWidthSmall)
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
            bookmarkElement.style.left = `${((bookmark.time / progressBarValue) * progressBarWidthBig)-13}px`
            bookmarkElement.style.top = bookmarkOnProgressBarTopBig
            bookmarkElement.style.width = '16px'
            bookmarkElement.style.height = '16px'
            bookmarkElement.style.zIndex = '9999'
            bookmarkElement.title = bookmark.title
            bookmarksContainerBig.appendChild(bookmarkElement)
            if (bookmarksContainerSmall) {
                const bookmarkElementSmall = bookmarkElement.cloneNode(true)
                bookmarkElementSmall.style.top = bookmarkOnProgressBarTopSmall
                bookmarkElementSmall.style.left = `${((bookmark.time / progressBarValue) * progressBarWidthSmall)-13}px`
                bookmarksContainerSmall.appendChild(bookmarkElementSmall)
            }
        }
    }

    const addBookmarkButton = () => {
        const bookmarkButtonExistsBig = document.getElementById('bookmark-btn')
        console.log('Bookmark button exists:', bookmarkButtonExistsBig) 
        const bookmarkButtonExistsSmall = document.getElementById('bookmark-btn-small')
        console.log('Bookmark button exists:', bookmarkButtonExistsSmall, bookmarkButtonExistsBig) 
        if (bookmarkButtonExistsBig) {
            bookmarkButtonExistsBig.remove()
        }
        if (bookmarkButtonExistsSmall) {
            bookmarkButtonExistsSmall.remove()
        }
        let scruberElementBig = document.querySelectorAll(curBookmarkButtonContainerBig)[0]
        console.log('Scrubber element big:', scruberElementBig)
        if (scruberElementBig) {
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
            scruberElementBig.appendChild(bookMarkBtn)
            bookMarkBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                bookmarkClickEventHandler(event.target.className);
            })
            bookMarkBtn.addEventListener('mouseover', () => {
                bookMarkBtn.style.opacity = '1';
            });
            bookMarkBtn.addEventListener('mouseout', () => {
                bookMarkBtn.style.opacity = '0.2';
            });
        }
        let scruberElementSmall = document.querySelectorAll(curBookmarkButtonContainerSmall)[0]
        console.log('Scrubber element small:', scruberElementSmall)
        if (scruberElementSmall) {
            const bookMarkBtn = document.createElement('img')
            bookMarkBtn.src = chrome.runtime.getURL('assets/bookmark64x64.png')
            bookMarkBtn.className = 'bookmark-btn-small'
            bookMarkBtn.id = 'bookmark-btn-small'
            bookMarkBtn.title = chrome.i18n.getMessage('bookmarkButtonTooltip')
            bookMarkBtn.style.cursor = 'pointer'
            bookMarkBtn.style.position = 'block'
            bookMarkBtn.style.zIndex = '150'
            bookMarkBtn.style.opacity = '0.2'
            bookMarkBtn.style.transition = 'opacity 0.5s'
            scruberElementSmall.appendChild(bookMarkBtn)
            bookMarkBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                bookmarkClickEventHandler(event.target.className);
            })
            bookMarkBtn.addEventListener('mouseover', () => {
                bookMarkBtn.style.opacity = '1';
            });
            bookMarkBtn.addEventListener('mouseout', () => {
                bookMarkBtn.style.opacity = '0.2';
            });
        }
    }

    const addResizeObserver = () => {

        const isWindowObserverAdded = document.body.getAttribute('resizeObserverAdded')
        const isPlayerObserverAdded = youtubePlayer.getAttribute('resizeObserverAdded')
        const isDurationChangeObserverAdded = youtubePlayer.getAttribute('durationObserverAdded')

        if (!isWindowObserverAdded) {
            const resizeObserver = new ResizeObserver(() => {
                const handleFunc = async () => await newVideoLoaded('RESIZE WINDOW')
                console.log('Resize observer:', oldProgressBarSizeBig, oldProgressBarSizeSmall)
                const curProgressBarQueryWidthBig = document.querySelectorAll(curProgressBarQueryBig)[0].offsetWidth
                const curProgressBarQueryWidthSmall = document.querySelectorAll(curProgressBarQuerySmall)[0].offsetWidth
                if ((oldProgressBarSizeBig !== curProgressBarQueryWidthBig) || (oldProgressBarSizeSmall !== curProgressBarQueryWidthSmall)) {
                    oldProgressBarSizeBig = curProgressBarQueryWidthBig
                    oldProgressBarSizeSmall = curProgressBarQueryWidthSmall
                    console.log('Resize observer player changed:', oldProgressBarSizeBig, oldProgressBarSizeSmall)
                    handleFunc().catch(error => console.error('Error handling resize:', error))
                }
            })
            resizeObserver.observe(document.body)
            document.body.setAttribute('resizeObserverAdded', true)
        }

        if (!isPlayerObserverAdded) {
            const resizeObserverPlayer = new ResizeObserver(() => {
                const handleFunc = async () => await newVideoLoaded('RESIZE WINDOW')
                console.log('Resize observer:', oldProgressBarSizeBig, oldProgressBarSizeSmall)
                const curProgressBarQueryWidthBig = document.querySelectorAll(curProgressBarQueryBig)[0].offsetWidth
                const curProgressBarQueryWidthSmall = document.querySelectorAll(curProgressBarQuerySmall)[0].offsetWidth
                if ((oldProgressBarSizeBig !== curProgressBarQueryWidthBig) || (oldProgressBarSizeSmall !== curProgressBarQueryWidthSmall)) {
                    oldProgressBarSizeBig = curProgressBarQueryWidthBig
                    oldProgressBarSizeSmall = curProgressBarQueryWidthSmall
                    console.log('Resize observer player changed:', oldProgressBarSizeBig, oldProgressBarSizeSmall)
                    handleFunc().catch(error => console.error('Error handling resize:', error))
                }
            })
            resizeObserverPlayer.observe(youtubePlayer)
            youtubePlayer.setAttribute('resizeObserverAdded', true)
        }

        if (!isDurationChangeObserverAdded) {
            console.log('duration change listener will be added:', isDurationChangeListenerAdded)
            
            youtubePlayer.addEventListener('durationchange', () => {
                const handleDurationChange = async () => await newVideoLoaded('DURATION CHANGE')
                if (durationOld === youtubePlayer.duration) {
                    return
                }
                durationOld = youtubePlayer.duration
                handleDurationChange().catch(error => console.error('Error handling duration change:', error))
            })
        }
    }

    const checkIfExists = (bookmarks, newBookmarkTime, buttonClass) => {
        return new Promise((resolve, _reject) => {
            for (element of bookmarks) {
                console.log(element.time, newBookmarkTime)
                if (newBookmarkTime <= element.time + 10 && newBookmarkTime >= element.time - 10) {
                    const msgLine1 = chrome.i18n.getMessage('cantAddBookmarkLine1')
                    const msgLine2 = `${chrome.i18n.getMessage('cantAddBookmarkLine2')} ${getTime(element.time-10)} - ${getTime(element.time + 10)}`
                    popupMessage(msgLine1, msgLine2, buttonClass)
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
                    console.log('Bookmarks fetched IN youtubecontent:', obj)
                    if (chrome.runtime.lastError) {
                        console.error('Error fetching bookmarks:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(obj[currentVideoId] ? JSON.parse(obj[currentVideoId]) : []);
                    }
                });
            } catch (error) {
                console.error('Unexpected error:', error);
                popupMessage(chrome.i18n.getMessage("unexpectedError"), chrome.i18n.getMessage("reloadTab"), 'bookmark-btn');
                reject(error);
            }
    }) : []
    }

    const newVideoLoaded = async (fromMessage) => {
        newVideoLoadedExecutedTimes++
        const bookmarks = await fetchBookmarks(currentVideoId)
        youtubePlayer = document.getElementsByClassName('video-stream html5-main-video')[0]
        console.log('Youtube player:', youtubePlayer)
        console.log('Fetch called from newVideoLoaded', fromMessage, newVideoLoadedExecutedTimes)
        newVideoLoadedExecutedTimes === 1 && addBookmarkButton()
        // clearBookmarksOnProgressBar() 
        // if (bookmarks.length > 0) {
            addBookmarksOnProgressBar(bookmarks)
        // }
        addResizeObserver()
        newVideoLoadedExecutedTimes--
    }

    const bookmarkClickEventHandler = async (buttonClass) => {
        console.log('Bookmark button clicked', youtubePlayer)
        youtubePlayer.pause()
        
        let currentVideoBookmarks = []

        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
            return
        }

        const currentTime = youtubePlayer.currentTime

        const exists = await checkIfExists(currentVideoBookmarks, currentTime, buttonClass)
        if (exists) return

        await chrome.storage.sync.set({ taskStatus: true }, () => {
            console.log('Task status set to started');
        });
        chrome.runtime.sendMessage({ type: "CREATING_BOOKMARK" })
        const groupAndAlbumTitle = document.getElementsByClassName('byline style-scope ytmusic-player-bar complex-string')[0] || document.querySelectorAll('yt-formatted-string.byline.style-scope.ytmusic-player-controls')[0]
        const songTitle = document.getElementsByClassName('title style-scope ytmusic-player-bar')[0] || document.querySelectorAll('yt-formatted-string.byline.style-scope.ytmusic-player-controls')[0]
        const currVideoTitle = `${groupAndAlbumTitle.textContent} - ${songTitle.textContent}`
        const newBookmark = {
            videoId: currentVideoId,
            urlTemplate: 'https://music.youtube.com/watch?v=',
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

    const ytmusicontentOnMessageListener = (obj, _sender, _sendResponse) => {
        isMessageListenerAdded = true
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
        console.log('Message received in ytmusicontent.js:', obj, currentVideoBookmarks)
        if (type === 'NEW') {
            const handleNewVideoLoaded = async () => {
                await chrome.storage.sync.set({ taskStatus: false }, async () => {
                    await newVideoLoaded('NEW')
                    console.log('Task status set to false');
                });
            }
            handleNewVideoLoaded().catch(error => console.error('Error handling new video:', error))
        } else if (type === 'PLAY') {
            youtubePlayer.currentTime = value
            youtubePlayer.play()
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

    chrome.storage.local.get('isYtmusicOnMessageListenerAdded', (result) => {
        if (!result.isYtmusicOnMessageListenerAdded) {
            chrome.runtime.onMessage.addListener(ytmusicontentOnMessageListener);
            chrome.storage.local.set({ isYtmusicOnMessageListenerAdded: true }, () => {
                console.log('onMessage listener added');
            });
        } else {
            console.log('onMessage listener already added');
            chrome.runtime.onMessage.removeListener(ytmusicontentOnMessageListener);
            chrome.runtime.onMessage.addListener(ytmusicontentOnMessageListener);
            console.log('onMessage listener re-added');
        }
    });
};

contentFunc()
