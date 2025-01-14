
const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

(() => {

    let vkPlayer
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
        messageDiv.style.top = `${bookMarkBtn.offsetTop - 40}px`;
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
        const progressBarElement = document.getElementsByClassName('videoplayer_slider videoplayer_timeline_slider')[0]
        const progressBarValue = progressBarElement.getAttribute('aria-valuemax')
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
                    console.log('Bookmarks fetched IN vkcontent:', obj)
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

        const bookmarkButtonExists = document.getElementsByClassName('bookmark-btn')[0]
        const bookmarks = await fetchBookmarks(currentVideoId)
        // clearBookmarksOnProgressBar() 
        addBookmarksOnProgressBar(bookmarks)
        if (!resizeObserver.observing) {
            resizeObserver.observe(document.body)
            resizeObserver.observing = true
        }
        if (!resizeObserverPlayer.observing) {
            const vkPlayerDiv = document.getElementById('video_player')
            if (vkPlayerDiv) {
                resizeObserverPlayer.observe(vkPlayerDiv)
                resizeObserverPlayer.observing = true
            }
        }
        if (!bookmarkButtonExists) {
            const bookMarkBtn = document.createElement('img')
            bookMarkBtn.src = chrome.runtime.getURL('assets/bookmark64x64.png')
            bookMarkBtn.className = 'videoplayer_controls_item videoplayer_btn ' + 'bookmark-btn'
            bookMarkBtn.title = chrome.i18n.getMessage('bookmarkButtonTooltip')
            bookMarkBtn.style.cursor = 'pointer'
            bookMarkBtn.style.position = 'block'
            bookMarkBtn.style.zIndex = '150'
            bookMarkBtn.style.opacity = '0.2'
            bookMarkBtn.style.transition = 'opacity 0.5s'
            vkPlayer = document.getElementsByClassName('videoplayer_media_provider')[0]
    
            if (vkPlayer) {
                const scruberElement = document.getElementsByClassName('videoplayer_controls')[0]
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

    const bookmarkClickEventHandler = async () => {
        vkPlayer.pause()
        
        let currentVideoBookmarks = []

        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
            return
        }

        const currentTime = vkPlayer.currentTime

        const exists = await checkIfExists(currentVideoBookmarks, currentTime)
        if (exists) return

        await chrome.storage.sync.set({ taskStatus: true }, () => {
            console.log('Task status set to started');
        });
        chrome.runtime.sendMessage({ type: "CREATING_BOOKMARK" })
        const currVideoTitle = document.title.replace(/^\(\d+\)\s*/, '').trim()
        const newBookmark = {
            videoId: currentVideoId,
            urlTemplate: 'https://vk.com/video-',
            time: currentTime,
            title: currVideoTitle + ' - ' + getTime(currentTime),
        }

        // const bookMarkCaption = await getSubtitlesText()
        
        newBookmark.bookMarkCaption = newBookmark.title

        // const frame = await captureFrame(vkPlayer)
        // newBookmark.frame = frame

        await chrome.storage.sync.set({[currentVideoId]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a,b) => a.time - b.time))}, async () => {
            await newVideoLoaded()
            console.log('Bookmark added from vkcontent.js:', newBookmark)
        })
        await chrome.storage.sync.set({ taskStatus: false }, () => {
            console.log('Task status set to completed');
        });
        chrome.runtime.sendMessage({ type: "STOP_CREATING_BOOKMARK"})
    }

    const resizeObserver = new ResizeObserver(newVideoLoaded)
    const resizeObserverPlayer = new ResizeObserver(newVideoLoaded)

    resizeObserver.observing = false
    resizeObserverPlayer.observing = false

    chrome.runtime.onMessage.addListener(async (obj, _sender, _sendResponse) => {
        const { type, value, videoId } = obj
        let currentVideoBookmarks = []
        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
        }
        console.log('Message received in vkcontent.js:', obj, currentVideoBookmarks)
        if (type === 'NEW') {
            currentVideoId = videoId
            await chrome.storage.sync.set({ taskStatus: false }, () => {
                newVideoLoaded()
                console.log('Task status set to false');
            });
        } else if (type === 'PLAY') {
            vkPlayer.currentTime = value
            vkPlayer.play()
        } else if (type === 'DELETE') {
            console.log('Delete bookmark:', value, currentVideoBookmarks)
            currentVideoBookmarks = currentVideoBookmarks.filter(bookmark => bookmark.time != value)
            await chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, () => {
                newVideoLoaded()
                console.log('Bookmark deleted:', value, currentVideoBookmarks)
            })
        } else if (type === 'UPDATE') {
            const { time, title } = value
            currentVideoBookmarks = currentVideoBookmarks.map(bookmark => {
                if (bookmark.time === time) {
                    bookmark.title = title
                }
                return bookmark
            })
            await chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, () => {
                newVideoLoaded()
                console.log('Bookmark updated:', value, currentVideoBookmarks)
            })
        }
        return true
    })
    // newVideoLoaded()
})();


