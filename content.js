
const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

const contentFunc = () => {

    let youtubePlayer
    let currentVideoId = ""
    let previousAriaValueMax = 0
    let previousProgressBarWidth = 0
    let newVideoLoadedCalled = 0

    const popupMessage = (line1, line2) => {
        const bookMarkBtn = document.getElementsByClassName('bookmark-btn')[0];
        const messageDiv = document.createElement('div');
        messageDiv.style.display = 'block';
        messageDiv.style.justifyContent = 'center';
        messageDiv.style.alignItems = 'center';
        messageDiv.style.position = 'absolute';
        messageDiv.style.top = `${bookMarkBtn.offsetTop - 30}px`;
        messageDiv.style.left = `${bookMarkBtn.offsetRight - 40}px`;
        messageDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        messageDiv.style.color = 'white';
        messageDiv.style.height = 'auto';
        messageDiv.style.width = 'auto';
        messageDiv.style.borderRadius = '10px';
        messageDiv.style.textAlign = 'center';
        messageDiv.style.zIndex = '150';

        const messageLine1 = document.createElement('p');
        messageLine1.style.margin = '0';
        messageLine1.style.padding = '3px';
        messageLine1.innerText = line1 + ' ' + line2;

        messageDiv.appendChild(messageLine1);
        bookMarkBtn.parentElement.parentElement.appendChild(messageDiv);

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

    const addBookmarkButton = () => {
        const bookmarkButtonExists = document.getElementById('bookmark-btn')
        if (bookmarkButtonExists) {
            bookmarkButtonExists.remove()
        }
        const bookMarkBtn = document.createElement('img')
        bookMarkBtn.src = chrome.runtime.getURL('assets/bookmark64x64.png')
        bookMarkBtn.id = 'bookmark-btn'
        bookMarkBtn.className = 'ytp-button ' + 'bookmark-btn'
        bookMarkBtn.title = chrome.i18n.getMessage('bookmarkButtonTooltip')
        bookMarkBtn.style.cursor = 'pointer'
        bookMarkBtn.style.position = 'block'
        bookMarkBtn.style.zIndex = '150'
        bookMarkBtn.style.opacity = '0.2'
        bookMarkBtn.style.transition = 'opacity 0.5s'
        youtubePlayer = document.getElementsByClassName('video-stream')[0]

        if (youtubePlayer) {
            const scruberElement = document.getElementsByClassName('ytp-right-controls')[0]
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

    const addBookmarksOnProgressBar = (bookmarks) => {
        let progressBarElement = document.querySelectorAll('#ytd-player .ytp-chrome-bottom .ytp-progress-bar')[0] || document.getElementsByClassName('ytp-progress-bar')[0]
        console.log('Progress bar element:', progressBarElement)
        let progressBarWidth = progressBarElement.offsetWidth
        if (progressBarWidth === 0) {
            progressBarElement = document.querySelectorAll('.ytp-progress-bar')[0]
            console.log('MINIPLAYER Progress bar element:', progressBarElement)
            progressBarWidth = progressBarElement.offsetWidth
        }
        const progressBarValue = progressBarElement.getAttribute('aria-valuemax')
        console.log('Progress bar width:', progressBarWidth, bookmarks)
        for (let bookmark of bookmarks) {
            const bookmarkElement = document.createElement('img')
            bookmarkElement.id = 'bookmark-' + bookmark.time
            const ifExist = document.getElementById(bookmarkElement.id)
            if (ifExist) {
                ifExist.remove()
            }
            bookmarkElement.className = 'ytp-scrubber-container ' + 'bookmark-on-progress'
            bookmarkElement.src = chrome.runtime.getURL('assets/bookmark64x64.png')
            console.log('Bookmark left:', bookmark.time, progressBarValue, progressBarWidth, (bookmark.time / progressBarValue) * progressBarWidth)
            bookmarkElement.style.left = `${((bookmark.time / progressBarValue) * progressBarWidth)-8}px`
            bookmarkElement.style.top = '-4px'
            bookmarkElement.style.width = '16px'
            bookmarkElement.style.height = '16px'
            bookmarkElement.style.zIndex = '9999'
            bookmarkElement.title = bookmark.title
            progressBarElement.appendChild(bookmarkElement)
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
        const subtitlesButton = document.getElementsByClassName('ytp-subtitles-button')[0]
        const ifClicked = subtitlesButton.getAttribute('aria-pressed')
        if (ifClicked === 'false') {
            subtitlesButton.click()
        }
    }

    const getSubtitlesText = () => {
        let captions = []
        return new Promise((resolve, reject) => {
            clickSubtitlesButton()
            const captionsContainer = document.getElementsByClassName('ytp-caption-window-container')[0]
            let  ifObserverTriggered = false
            const linesOnStart = Array.from(document.getElementsByClassName('caption-visual-line')).map(span => span.textContent)
            const observer = new MutationObserver((_mutationsList, _observer) => {
                const newLines = Array.from(document.getElementsByClassName('caption-visual-line')).map(span => span.textContent);
                ifObserverTriggered = true
                console.log('New lines:', newLines)
                for (line of newLines) {
                    if (!captions.includes(line)) {
                        captions.push(line)
                    }
                }
            })

            if (captionsContainer instanceof Node) {
                observer.observe(captionsContainer, {childList: true, subtree: true})

                setTimeout(() => {
                    observer.disconnect()
                    if (ifObserverTriggered) {
                        captions.length > 0 ? resolve(captions) : resolve(['No subtitles found'])
                    } else {
                        linesOnEnd = Array.from(document.getElementsByClassName('caption-visual-line')).map(span => span.textContent)
                        for (line of linesOnEnd) {
                            if (!linesOnStart.includes(line)) {
                                linesOnStart.push(line)
                            }
                        }
                        linesOnStart.length > 0 ? resolve(linesOnStart) : resolve([chrome.i18n.getMessage('noSubtitles')])
                    }
                }, 5000)
            } else {
                resolve([chrome.i18n.getMessage('noSubtitles')])
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
                    console.log('Bookmarks fetched IN CONTENT:', obj)
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

    const captureFrame = (videoElement) => {
        const canvas = document.createElement('canvas')
        canvas.width = 128
        canvas.height = 128
        return new Promise((resolve, reject) => {
            try {
                canvas.getContext('2d').drawImage(videoElement, 0, 0, 128, 128)
                resolve(canvas.toDataURL('image/jpeg', 0.2))
            } catch (error) {
                reject(error)
            }
        })
    }

    const newVideoLoaded = async (fromMessage) => {
        newVideoLoadedCalled++
        const bookmarks = await fetchBookmarks(currentVideoId)
        console.log('Fetch called from newVideoLoaded', fromMessage, newVideoLoadedCalled)
        newVideoLoadedCalled === 1 && addBookmarkButton()
        clearBookmarksOnProgressBar() 
        if (bookmarks.length > 0) {
            addBookmarksOnProgressBar(bookmarks)
        }
        addResizeObserver()
        newVideoLoadedCalled--
    }

    const bookmarkClickEventHandler = async () => {

        youtubePlayer.pause()
        
        let currentVideoBookmarks = []

        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
            console.log('Fetch called from bookmarkClickEventHandler')
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
            return
        }

        const currentTime = youtubePlayer.currentTime

        const exists = await checkIfExists(currentVideoBookmarks, currentTime)
        if (exists) return

        await chrome.storage.sync.set({ taskStatus: true }, () => {
            console.log('Task status set to started');
        });
        chrome.runtime.sendMessage({ type: "CREATING_BOOKMARK" })
        const currVideoTitle = document.title.split(' - YouTube')[0].replace(/^\(\d+\)\s*/, '').trim()
        const newBookmark = {
            videoId: currentVideoId,
            urlTemplate: 'https://www.youtube.com/watch?v=',
            time: currentTime,
            title: currVideoTitle + ' - ' + getTime(currentTime),
        }

        newBookmark.bookMarkCaption = newBookmark.title

        chrome.storage.sync.set({[currentVideoId]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a,b) => a.time - b.time))}, async () => {
            await newVideoLoaded('bookmarkClickEventHandler')
            console.log('Bookmark added from content.js:', newBookmark)
        })
        await chrome.storage.sync.set({ taskStatus: false }, () => {
            console.log('Task status set to completed');
        });
        chrome.runtime.sendMessage({ type: "STOP_CREATING_BOOKMARK"})
    }

    const addResizeObserver = () => {

        const isWindowObserverAdded = document.body.getAttribute('resizeObserverAdded')
        const isPlayerObserverAdded = document.getElementsByClassName('video-stream')[0].getAttribute('resizeObserverAdded')
        const isProgressBarObserverAdded = document.getElementsByClassName('ytp-progress-bar')[0].getAttribute('attributesObserverAdded')
        const isProgressBarResizeObserverAdded = document.getElementsByClassName('ytp-progress-bar')[0].getAttribute('resizeObserverAdded')

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
            resizeObserverPlayer.observe(document.getElementsByClassName('video-stream')[0])
            document.getElementsByClassName('video-stream')[0].setAttribute('resizeObserverAdded', true)
        }

        if (!isProgressBarResizeObserverAdded) {
            const resizeObserverProgressBar = new ResizeObserver((entries) => {
                const handleFunc = async () => await newVideoLoaded('RESIZE PROGRESS BAR')
                if (entries[entries.length - 1].target.offsetWidth !== previousProgressBarWidth) {
                    console.log('PBR !!!!!!! :', entries[entries.length - 1].target.offsetWidth)
                    handleFunc().catch(error => console.error('Error handling resize:', error))
                    previousProgressBarWidth = entries[entries.length - 1].target.offsetWidth
                }
            })
            resizeObserverProgressBar.observe(document.getElementsByClassName('ytp-progress-bar')[0])
            document.getElementsByClassName('ytp-progress-bar')[0].setAttribute('resizeObserverAdded', true)
        }

        if (!isProgressBarObserverAdded) {
            const progressBarMutationObserver = new MutationObserver((mutationList, observer) => {
                const handleFunc = async () => {
                    console.log('PBM !!!!!!! :', mutationList)
                    await newVideoLoaded('PROGRESS BAR MUTATION')
                }
                if (mutationList[mutationList.length - 1].attributeName === 'aria-valuemax' && mutationList[mutationList.length - 1].target.getAttribute('aria-valuemax') !== previousAriaValueMax) {
                    handleFunc().catch(error => console.error('Error handling progress bar mutation:', error))
                    previousAriaValueMax = mutationList[mutationList.length - 1].target.getAttribute('aria-valuemax')
                }
            })
            progressBarMutationObserver.observe(document.getElementsByClassName('ytp-progress-bar')[0], {attributes: true, attributeFilter: ['aria-valuemax']})
            document.getElementsByClassName('ytp-progress-bar')[0].setAttribute('resizeObserverAdded', true)
        }
    }

    const contentOnMeassageListener = (obj, _sender, _sendResponse) => {
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
        console.log('Message received in content.js:', obj, currentVideoBookmarks)
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

    chrome.storage.local.get('isMessageListenerAdded', (result) => {
        if (!result.isMessageListenerAdded) {
            chrome.runtime.onMessage.addListener(contentOnMeassageListener);
            chrome.storage.local.set({ isMessageListenerAdded: true }, () => {
                console.log('onMessage listener added');
            });
        } else {
            console.log('onMessage listener already added');
            chrome.runtime.onMessage.removeListener(contentOnMeassageListener);
            chrome.runtime.onMessage.addListener(contentOnMeassageListener);
            console.log('onMessage listener re-added');
        }
    });
};

contentFunc();

