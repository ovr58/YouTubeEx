
const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

const errorHandler = (error, nativeMessage = '') => {
    if (error.message === 'Extension context invalidated.') {
        console.log('Extension context invalidated, reloading tab...');
        window.location.reload();
    } else if (nativeMessage !== '') {
        console.error(nativeMessage, error.message);
    } else {
        console.error('Unexpected error:', error.message);
        popupMessage(chrome.i18n.getMessage("unexpectedError"), chrome.i18n.getMessage("reloadTab"), 'bookmark-btn');
    }
}

const contentFunc = () => {

    let vkPlayer
    let currentVideoId = ""
    let newVideoLoadedCalled = 0
    let previousProgressBarWidth = 0
    let previousAriaValueMax = ''

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

    const addBookmarkButton = (fromMessage) => {
        console.log('Add bookmark button called:', fromMessage)
        const bookmarkButtonExists = document.getElementById('bookmark-btn')
        if (bookmarkButtonExists) {
            bookmarkButtonExists.remove()
        }
        const bookMarkBtn = document.createElement('img')
        bookMarkBtn.src = chrome.runtime.getURL('assets/bookmark64x64.png')
        bookMarkBtn.id = 'bookmark-btn'
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

    const addBookmarksOnProgressBar = async (bookmarks) => {
        const progressBarElement = document.getElementsByClassName('videoplayer_slider videoplayer_timeline_slider')[0]
        console.log('Progress bar element:', progressBarElement)
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
            bookmarkElement.addEventListener('click', (event) => {
                event.preventDefault()
                event.stopPropagation()
                vkPlayer.currentTime = bookmark.time
                vkPlayer.play()
            })
            bookmarksContainer.appendChild(bookmarkElement)
        }
    }

    const addResizeObserver = () => {

        const isWindowObserverAdded = document.body.getAttribute('resizeObserverAdded')
        const isPlayerObserverAdded = document.getElementById('video_player').getAttribute('resizeObserverAdded')
        const isProgressBarObserverAdded = document.getElementsByClassName('videoplayer_slider videoplayer_timeline_slider')[0].getAttribute('attributesObserverAdded')

        if (!isWindowObserverAdded) {
            const resizeObserver = new ResizeObserver(() => {
                const handleFunc = async () => await newVideoLoaded('RESIZE WINDOW')
                handleFunc().catch(error => {
                    const nativeMessage = 'Error handling resize:'
                    errorHandler(error, nativeMessage)
                })
            })
            resizeObserver.observe(document.body)
            document.body.setAttribute('resizeObserverAdded', true)
        }

        if (!isPlayerObserverAdded) {
            const resizeObserverPlayer = new ResizeObserver((entries) => {
                const handleFunc = async () => await newVideoLoaded('RESIZE PLAYER')
                if (entries[entries.length - 1].target.offsetWidth !== previousProgressBarWidth) {
                    handleFunc().catch(error => {
                        const nativeMessage = 'Error handling resize:'
                        errorHandler(error, nativeMessage)
                    })
                    previousProgressBarWidth = entries[entries.length - 1].target.offsetWidth
                }
            })
            resizeObserverPlayer.observe(document.getElementById('video_player'))
            document.getElementById('video_player').setAttribute('resizeObserverAdded', true)
        }

        if (!isProgressBarObserverAdded) {
            const progressBarMutationObserver = new MutationObserver((mutationList, observer) => {
                const handleFunc = async () => {
                    console.log('PBM !!!!!!! :', mutationList)
                    await newVideoLoaded('PROGRESS BAR MUTATION')
                }
                if (mutationList[mutationList.length - 1].attributeName === 'aria-valuemax' && mutationList[mutationList.length - 1].target.getAttribute('aria-valuemax') !== previousAriaValueMax) {
                    handleFunc().catch(error => {
                        const nativeMessage = 'Error handling progress bar mutation:'
                        errorHandler(error, nativeMessage)
                    })
                    previousAriaValueMax = mutationList[mutationList.length - 1].target.getAttribute('aria-valuemax')
                }
            })
            progressBarMutationObserver.observe(document.getElementsByClassName('videoplayer_slider videoplayer_timeline_slider')[0], {attributes: true, attributeFilter: ['aria-valuemax']})
            document.getElementsByClassName('videoplayer_slider videoplayer_timeline_slider')[0].setAttribute('resizeObserverAdded', true)
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
                    console.log('Bookmarks fetched IN vkcontent:', obj)
                    if (chrome.runtime.lastError) {
                        const nativeMessage = 'Error fetching bookmarks:'
                        errorHandler(chrome.runtime.lastError, nativeMessage)
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(obj[currentVideoId] ? JSON.parse(obj[currentVideoId]) : []);
                    }
                });
            } catch (error) {
                errorHandler(error)
                reject(error);
            }
    }) : []
    }

    const newVideoLoaded = async (fromMessage) => {
        newVideoLoadedCalled++
        const bookmarks = await fetchBookmarks(currentVideoId)
        console.log('Fetch called from newVideoLoaded', fromMessage, newVideoLoadedCalled)
        newVideoLoadedCalled === 1 && addBookmarkButton(fromMessage)
        // clearBookmarksOnProgressBar() 
        // if (bookmarks.length > 0) {
            addBookmarksOnProgressBar(bookmarks)
        // }
        addResizeObserver()
        newVideoLoadedCalled--
    }

    const bookmarkClickEventHandler = async () => {
        vkPlayer.pause()
        
        let currentVideoBookmarks = []

        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            const nativeMessage = 'Error fetching bookmarks:'
            errorHandler(error, nativeMessage) 
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

    const vkcontentMessageListener = (obj, _sender, _sendResponse) => {
        const { type, value, videoId } = obj
        currentVideoId = videoId
        const handleFetchBookmarks = async () => {
            let currentVideoBookmarks = []
            try {
                currentVideoBookmarks = await fetchBookmarks(currentVideoId)
                console.log('Fetch called from onMessage')
                return currentVideoBookmarks
            } catch (error) {
                const nativeMessage = 'Error fetching bookmarks:'
                errorHandler(error, nativeMessage)
                return []
            }
        }
        handleFetchBookmarks().then(
            (currentVideoBookmarks) => {
                if (type === 'NEW') {
                    const handleNewVideoLoaded = async () => {
                        await chrome.storage.sync.set({ taskStatus: false }, async () => {
                            await newVideoLoaded('NEW')
                            console.log('Task status set to false');
                        });
                    }
                    handleNewVideoLoaded().catch(error => {
                        const nativeMessage = 'Error handling new video:'
                        errorHandler(error, nativeMessage)
                    })
                } else if (type === 'PLAY') {
                    vkPlayer.currentTime = value
                    vkPlayer.play()
                } else if (type === 'DELETE') {
                    const handleDeleteBookmark = async () => {
                        currentVideoBookmarks = currentVideoBookmarks.filter(bookmark => bookmark.time != value)
                        await chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, async () => {
                            await newVideoLoaded('DELETE')
                            console.log('Bookmark deleted:', value, currentVideoBookmarks)
                        })
                    }
                    console.log('Delete bookmark:', value, currentVideoBookmarks)
                    handleDeleteBookmark().catch(error => {
                        const nativeMessage = 'Error deleting bookmark:'
                        errorHandler(error, nativeMessage)
                    })
                } else if (type === 'UPDATE') {
                    const handleUpdateBookmark = async () => {
                        await chrome.storage.sync.set({[currentVideoId]: JSON.stringify(currentVideoBookmarks)}, async () => {
                            await newVideoLoaded('UPATE')
                            console.log('Bookmark updated:', value, currentVideoBookmarks)
                        })
                    }
                    const { time, title } = JSON.parse(value)
                    console.log('Update bookmark message received:', time, title, videoId)
                    currentVideoBookmarks = currentVideoBookmarks.map(bookmark => {
                        if (bookmark.time === time) {
                            bookmark.title = title
                        }
                        return bookmark
                    })
                    handleUpdateBookmark().catch(error => {
                        const nativeMessage = 'Error updating bookmark:'
                        errorHandler(error, nativeMessage)
                    })
                }
            }
        ).catch(error => {
            const nativeMessage = 'Error handling message:'
            errorHandler(error, nativeMessage)
        })
        return true
    }

    chrome.storage.local.get('isVkcontentMessageListenerAdded', (result) => {
        if (!result.isMessageListenerAdded) {
            chrome.runtime.onMessage.addListener(vkcontentMessageListener);
            chrome.storage.local.set({ isVkcontentMessageListenerAdded: true }, () => {
                console.log('onMessage listener added');
            });
        } else {
            console.log('onMessage listener already added');
            chrome.runtime.onMessage.removeListener(vkcontentMessageListener);
            chrome.runtime.onMessage.addListener(vkcontentMessageListener);
            console.log('onMessage listener re-added');
        }
    });
};

contentFunc()
