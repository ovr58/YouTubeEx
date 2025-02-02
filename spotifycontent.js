
const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

(() => {

    let spotifyPlayer
    let currentVideoId = ""
    let isMessageListenerAdded = false
    let isDurationChangeListenerAdded = false
    let durationOld
    let newAudioLoadedExecutedTimes = 0
    // let curProgressBarQuerySmall = 'ytmusic-player-controls#player-controls div.progress-bar-container.style-scope.ytmusic-player-controls'
    let curProgressBarQueryBig = 'div.TywOcKZEqNynWecCiATc'
    let curBookmarkButtonContainerBig = 'div.Qt226Z4rBQs53aedRQBQ'
    // let curBookmarkButtonContainerSmall = 'ytmusic-player-page#player-page div.content.style-scope.ytmusic-player-page div#side-panel tp-yt-paper-tabs.tab-header-container.style-scope.ytmusic-player-page div#tabsContainer.style-scope.tp-yt-paper-tabs div#tabsContent.tabs-content.fit-container.style-scope.tp-yt-paper-tabs.style-scope.tp-yt-paper-tabs'
    let oldProgressBarSizeBig = 0
    let oldProgressBarSizeSmall = 0
    let bookmarkOnProgressBarTopBig = '-25px'
    // let bookmarkOnProgressBarTopSmall = '-35px'

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

    const setPlaybackPosition = async (positionPercentage, progressBar) => {
        const progressBarWidth = progressBar.offsetWidth;
        const clickPosition = progressBarWidth * positionPercentage;
    
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: progressBar.getBoundingClientRect().left + clickPosition,
            clientY: progressBar.getBoundingClientRect().top + (progressBar.offsetHeight / 2)
        });
    
        progressBar.dispatchEvent(clickEvent);

        await new Promise(resolve => setTimeout(resolve, 100))

        
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

    const waitForElement = (selector) => {
        return new Promise((resolve) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
    
            const observer = new MutationObserver((mutations, observer) => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });
    
            observer.observe(document.body, { childList: true, subtree: true });
        });
    };

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
        // const progressBarElementSmall = document.querySelectorAll(curProgressBarQuerySmall)[0]
        console.log('Progress bar element:', progressBarElementBig)
        const progressBarValue = youtubePlayer.duration
        const bookmarksContainerBig = await addContainer(progressBarElementBig,'bookmarks-container')
        // const bookmarksContainerSmall = await addContainer(progressBarElementSmall,'bookmarks-container-small')
        
        const progressBarWidthBig = bookmarksContainerBig.offsetWidth
        // const progressBarWidthSmall = bookmarksContainerSmall ?bookmarksContainerSmall.offsetWidth : 0

        console.log('Progress bar width:', progressBarWidthBig)
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
            // if (bookmarksContainerSmall) {
            //     const bookmarkElementSmall = bookmarkElement.cloneNode(true)
            //     bookmarkElementSmall.style.top = bookmarkOnProgressBarTopSmall
            //     bookmarkElementSmall.style.left = `${((bookmark.time / progressBarValue) * progressBarWidthSmall)-13}px`
            //     bookmarksContainerSmall.appendChild(bookmarkElementSmall)
            // }
        }
    }

    const placeAboveIfCovered = (element) => {
        const rect = element.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const elementAtPoint = document.elementFromPoint(centerX, centerY)
        if (elementAtPoint !== element) {
            elementAtPoint.style.zIndex = element.style.zIndex
            element.style.zIndex = `${(Number(element.style.zIndex) + 1)}`
            console.log('Element covered:', elementAtPoint)
            return elementAtPoint
        }
    }

    const clickSubtitlesButton = () => {
        const subtitlesButton = document.getElementsByClassName('videoplayer_btn_subtitles')[0]
        if (!subtitlesButton.classList.contains('active')) {
            subtitlesButton.click()
        }
    }

    const getSubtitlesText = () => {
        const parseSubtitles = (subtitlesText) => {
        const subtitles = [];
        const lines = subtitlesText.split('\n\n');
        lines.forEach(line => {
            const [timecode, ...textLines] = line.split('\n');
            const [start, end] = timecode.split(' --> ');
            const text = textLines.join(' ');
            subtitles.push({ start, end, text });
        });
        return subtitles;
        }
        let captions = []
        return new Promise(async (resolve, reject) => {
            const captionsContainer = document.getElementById('subtitles_auto_0')
            if (!captionsContainer) {
                resolve('')
                return
            }
            const subtitlesUrl = captionsContainer.getAttribute('src')
            if (!subtitlesUrl) {
                resolve('')
                return
            }
            try {
                const response = await fetch(subtitlesUrl)
                const subtitlesText = await response.text()
                captions = parseSubtitles(subtitlesText)
                resolve(captions)
            } catch (error) {
                reject(error)
            }
        })
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

    // const captureFrame = (videoElement) => {
    //     const canvas = document.createElement('canvas')
    //     canvas.width = 128
    //     canvas.height = 128
    //     return new Promise((resolve, reject) => {
    //         try {
    //             canvas.getContext('2d').drawImage(videoElement, 0, 0, 128, 128)
    //             resolve(canvas.toDataURL('image/jpeg', 0.2))
    //         } catch (error) {
    //             reject(error)
    //         }
    //     })
    // }

    const newVideoLoaded = async () => {

        console.log('New video loaded:', newAudioLoadedExecutedTimes)
        newAudioLoadedExecutedTimes++

        const bookmarks = await fetchBookmarks(currentVideoId)
        audioPlayerDurationElement = document.querySelectorAll('div[data-testid="playback-duration"]')[0]
        console.log('Youtube player:', audioPlayerDurationElement)
        addBookmarksOnProgressBar(bookmarks)
        
        if (!resizeObserver.observing) {
            resizeObserver.observe(document.body)
            resizeObserver.observing = true
        }
        if (!resizeObserverPlayer.observing) {
            if (youtubePlayer) {
                resizeObserverPlayer.observe(youtubePlayer)
                resizeObserverPlayer.observing = true
            }
        }
        
        if (youtubePlayer) {
            addDurationChangeListener(youtubePlayer)
        }
        
        const bookmarkButtonExistsBig = Boolean(document.getElementsByClassName('bookmark-btn')[0])
        console.log('Bookmark button exists:', bookmarkButtonExistsBig) 
        const bookmarkButtonExistsSmall = Boolean(document.getElementsByClassName('bookmark-btn-small')[0])
        console.log('Bookmark button exists:', bookmarkButtonExistsSmall, bookmarkButtonExistsBig) 
        
        let scruberElementBig = document.querySelectorAll(curBookmarkButtonContainerBig)[0]
        console.log('Scrubber element big:', scruberElementBig)
        if (scruberElementBig && !bookmarkButtonExistsBig) {
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
        if (scruberElementSmall && !bookmarkButtonExistsSmall) {
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
        console.log('New video loaded finished execution at:', newVideoLoadedExecutedTimes)
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

        // const bookMarkCaption = await getSubtitlesText()
        
        newBookmark.bookMarkCaption = newBookmark.title

        // const frame = await captureFrame(dzenPlayer)
        // newBookmark.frame = frame

        await chrome.storage.sync.set({[currentVideoId]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a,b) => a.time - b.time))}, async () => {
            await newVideoLoaded()
            console.log('Bookmark added from dzencontent.js:', newBookmark)
        })
        await chrome.storage.sync.set({ taskStatus: false }, () => {
            console.log('Task status set to completed');
        });
        chrome.runtime.sendMessage({ type: "STOP_CREATING_BOOKMARK"})
    }

    const resizeObserver = new ResizeObserver(async () => {
        console.log('Resize observer:', oldProgressBarSizeBig, oldProgressBarSizeSmall)
        const curProgressBarQueryWidthBig = document.querySelectorAll(curProgressBarQueryBig)[0].offsetWidth
        const curProgressBarQueryWidthSmall = document.querySelectorAll(curProgressBarQuerySmall)[0].offsetWidth
        if ((oldProgressBarSizeBig !== curProgressBarQueryWidthBig) || (oldProgressBarSizeSmall !== curProgressBarQueryWidthSmall)) {
            oldProgressBarSizeBig = curProgressBarQueryWidthBig
            oldProgressBarSizeSmall = curProgressBarQueryWidthSmall
            console.log('Resize observer player changed:', oldProgressBarSizeBig, oldProgressBarSizeSmall)
            await newVideoLoaded()
        }
    })
    const resizeObserverPlayer = new ResizeObserver(async () => {
        console.log('Resize observer:', oldProgressBarSizeBig, oldProgressBarSizeSmall)
        const curProgressBarQueryWidthBig = document.querySelectorAll(curProgressBarQueryBig)[0].offsetWidth
        const curProgressBarQueryWidthSmall = document.querySelectorAll(curProgressBarQuerySmall)[0].offsetWidth
        if ((oldProgressBarSizeBig !== curProgressBarQueryWidthBig) || (oldProgressBarSizeSmall !== curProgressBarQueryWidthSmall)) {
            oldProgressBarSizeBig = curProgressBarQueryWidthBig
            oldProgressBarSizeSmall = curProgressBarQueryWidthSmall
            console.log('Resize observer player changed:', oldProgressBarSizeBig, oldProgressBarSizeSmall)
            await newVideoLoaded()
        }
    })

    resizeObserver.observing = false
    resizeObserverPlayer.observing = false

    !isMessageListenerAdded && chrome.runtime.onMessage.addListener(async (obj, _sender, _sendResponse) => {
        isMessageListenerAdded = true
        const { type, value, videoId } = obj
        currentVideoId = videoId
        let currentVideoBookmarks = []
        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
        }
        console.log('Message received in ytmusicontent.js:', obj, currentVideoBookmarks)
        if (type === 'NEW') {
            await chrome.storage.sync.set({ taskStatus: false }, async () => {
                await newVideoLoaded()
                console.log('Task status set to false');
            });
        } else if (type === 'PLAY') {
            youtubePlayer.currentTime = value
            youtubePlayer.play()
        } else if (type === 'DELETE') {
            console.log('Delete bookmark:', value, currentVideoBookmarks)
            currentVideoBookmarks = currentVideoBookmarks.filter(bookmark => bookmark.time != value)
            await chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, async () => {
                await newVideoLoaded()
                console.log('Bookmark deleted:', value, currentVideoBookmarks)
            })
        } else if (type === 'UPDATE') {
            const { time, title } = JSON.parse(value)
            currentVideoBookmarks = currentVideoBookmarks.map(bookmark => {
                if (bookmark.time === time) {
                    bookmark.title = title
                }
                return bookmark
            })
            await chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, async () => {
                await newVideoLoaded()
                console.log('Bookmark updated:', value, currentVideoBookmarks)
            })
        }
        return true
    })
})();


