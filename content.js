
const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

(() => {

    let youtubePlayer
    let currentVideoId = ""

    const popupMessage = (line1, line2) => {
        const bookMarkBtn = document.getElementsByClassName('bookmark-btn')[0]
        const messageDiv = document.createElement('div');
        messageDiv.style.display = 'flex';
        messageDiv.style.flexDirection = 'column';
        messageDiv.style.justifyContent = 'center';
        messageDiv.style.alignItems = 'center';
        messageDiv.style.position = 'absolute';
        messageDiv.style.top = `${bookMarkBtn.offsetTop + 30}px`;
        messageDiv.style.left = `${bookMarkBtn.offsetLeft}px`;
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

    const checkIfExists = (bookmarks, newBookmark) => {
        return new Promise((resolve, _reject) => {
            for (element of bookmarks) {
                console.log(element.time, newBookmark.time)
                if (newBookmark.time <= element.time + 10 && newBookmark.time >= element.time - 10) {
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

    const newVideoLoaded = async () => {

        const bookmarkButtonExists = document.getElementsByClassName('bookmark-btn')[0]
        console.log(bookmarkButtonExists)
        if (!bookmarkButtonExists) {
            bookMarkBtn = document.createElement('img')
            bookMarkBtn.src = chrome.runtime.getURL('assets/bookmark64x64.png')
            bookMarkBtn.className = 'ytp-button ' + 'bookmark-btn'
            bookMarkBtn.title = chrome.i18n.getMessage('bookmarkButtonTooltip')
            bookMarkBtn.style.cursor = 'pointer'
            bookMarkBtn.style.position = 'absolute'
            bookMarkBtn.style.top = '0'
            bookMarkBtn.style.left = '10px'
            bookMarkBtn.style.zIndex = '150'
            bookMarkBtn.style.opacity = '0.2'
            bookMarkBtn.style.transition = 'opacity 0.5s'
            youtubePlayer = document.getElementsByClassName('video-stream')[0]
    
            if (youtubePlayer) {
                youtubePlayer.parentNode.appendChild(bookMarkBtn)
                // const topRowButtonsEleemnt = document.getElementsByClassName('top-row-buttons')[0]
                // let isCovered
                // do {
                //     isCovered = placeAboveIfCovered(bookMarkBtn)
                // } while (isCovered !== youtubePlayer || isCovered === topRowButtonsEleemnt);
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
        // youtubePlayer.pause()
        await chrome.storage.sync.set({ taskStatus: true }, () => {
            console.log('Task status set to started');
        });
        chrome.runtime.sendMessage({ type: "CREATING_BOOKMARK" })
        const currentTime = youtubePlayer.currentTime
        const currVideoTitle = document.title.split(' - YouTube')[0].replace(/^\(\d+\)\s*/, '').trim()
        const newBookmark = {
            videoId: currentVideoId,
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

        const exists = await checkIfExists(currentVideoBookmarks, newBookmark)
        if (exists) return

        const bookMarkCaption = await getSubtitlesText()
        
        newBookmark.bookMarkCaption = bookMarkCaption

        const frame = await captureFrame(youtubePlayer)
        newBookmark.frame = frame

        chrome.storage.sync.set({[currentVideoId]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a,b) => a.time - b.time))}, () => {
            console.log('Bookmark added from content.js:', newBookmark, currentVideoBookmarks)
        })
        await chrome.storage.sync.set({ taskStatus: false }, () => {
            console.log('Task status set to completed');
        });
        chrome.runtime.sendMessage({ type: "STOP_CREATING_BOOKMARK"})
    }

    chrome.runtime.onMessage.addListener(async (obj, sender, sendResponse) => {
        const { type, value, videoId } = obj
        console.log('Message received in content.js:', obj)
        if (type === 'NEW') {
            currentVideoId = videoId
            chrome.storage.sync.set({ taskStatus: false }, () => {
                console.log('Task status set to false');
            });
            newVideoLoaded()
        } else if (type === 'PLAY') {
            youtubePlayer.currentTime = value
        } else if (type === 'DELETE') {
            let currentVideoBookmarks = []
            try {
                currentVideoBookmarks = await fetchBookmarks(currentVideoId)
            } catch (error) {
                console.error('Error fetching bookmarks:', error)
            }
            console.log('Delete bookmark:', value, currentVideoBookmarks)
            currentVideoBookmarks = currentVideoBookmarks.filter(bookmark => bookmark.time != value)
            chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, () => {
                console.log('Bookmark deleted:', value, currentVideoBookmarks)
            })
        }
    })

    newVideoLoaded()
})();


