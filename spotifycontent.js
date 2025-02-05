import { getCurrentTab } from "./utils"

const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

const getSeconds = (timeString) => {
    const units = timeString.split(':').map(Number).reverse();
    const unitMultipliers = [1, 60, 3600, 86400]; // секунды, минуты, часы, дни

    const convert = (units, multipliers) => {
        if (units.length === 0) return 0;
        return units[0] * multipliers[0] + convert(units.slice(1), multipliers.slice(1));
    };

    return convert(units, unitMultipliers);
}

(() => {

    let spotifyPlayer = {}
    let currentVideoId = ""
    let isMessageListenerAdded = false
    let curProgressBarQueryBig = 'div[data-testid="playback-progressbar"]'
    let audioPlayerDurationElement = 'div[data-testid="playback-duration"]'
    let audioPLayerCurrentTimeElement = 'div[data-testid="playback-position"]'
    let playButtonElement = 'button[data-testid="control-button-playpause"]'
    let newAudioLoadedExecutedTimes = 0
    let curBookmarkButtonContainerBig = 'div.Qt226Z4rBQs53aedRQBQ'
    let oldProgressBarSizeBig = 0
    let bookmarkOnProgressBarTopBig = '-25px'

    const checkForElement = (element) => {
        if (element) {
            chrome.runtime.sendMessage({ type: 'ELEMENT_FOUND' });
            return true;
        }
        return false;
    };

    const getFullTitle = () => {
        const contentItemTitle = document.querySelectorAll('a[data-testid="context-item-link"]')[0]
        const contentTitle = document.querySelectorAll('a[data-testid="context-item-info-show"]')[0]
        const contentArtist = document.querySelectorAll('a[data-testid="context-item-info-artist"]')[0]

        if (contentItemTitle && !contentItemTitle.hasAttribute('data-observer-added')) {
            new MutationObserver(async (mutations, observer) => {
                const newTitle = getFullTitle()
                if (newTitle !== spotifyPlayer.title) {
                    await newVideoLoaded()
                }
            }).observe(contentItemTitle, { childList: true, subtree: true, attributes: true, characterData: true });
            contentItemTitle.setAttribute('data-observer-added', 'true');
        }

        if (contentTitle && !contentTitle.hasAttribute('data-observer-added')) {
            new MutationObserver(async (mutations, observer) => {
                const newTitle = getFullTitle()
                if (newTitle !== spotifyPlayer.title) {
                    await newVideoLoaded()
                }
            }).observe(contentTitle, { childList: true, subtree: true, attributes: true, characterData: true });
            contentTitle.setAttribute('data-observer-added', 'true');
        }
        return `${contentItemTitle ? contentItemTitle.textContent : 'Spotify'}${contentTitle ? ` - ${contentTitle.textContent}` : ''}${contentArtist ? ` - ${contentArtist.textContent}` : ''}`
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

        return true
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
        const progressBarValue = spotifyPlayer.duration
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
            bookmarkElement.style.left = `${((getSeconds(bookmark.time) / getSeconds(progressBarValue)) * progressBarWidthBig)-8}px`
            bookmarkElement.style.top = bookmarkOnProgressBarTopBig
            bookmarkElement.style.width = '16px'
            bookmarkElement.style.height = '16px'
            bookmarkElement.style.zIndex = '9999'
            bookmarkElement.title = `${bookmark.title} - ${bookmark.time}`
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
                const time = getSeconds(element.time)
                const newTime = getSeconds(newBookmarkTime)
                console.log('FROM IS EXISTS: ', element.time, time, newBookmarkTime)
                if (newTime <= time + 10 && newTime >= time - 10) {
                    const msgLine1 = chrome.i18n.getMessage('cantAddBookmarkLine1')
                    const msgLine2 = `${chrome.i18n.getMessage('cantAddBookmarkLine2')} ${getTime(time-10)} - ${getTime(time + 10)}`
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

        const audioPlayerDuration = document.querySelectorAll(audioPlayerDurationElement)[0]

        console.log('Playe button element:', playButton)
        const currAudioTitle = getFullTitle()
        let _playState = playButton ? playButton.getAttribute('aria-label') === "PLay" ? true : false : 0
        let _duration = audioPlayerDuration ? audioPlayerDuration.textContent : 0
        let _currentTime = audioPLayerCurrentTime ? audioPLayerCurrentTime.textContent : 0
        let _title = currAudioTitle
        console.log('Play state:', _playState)
        console.log('Current time:', _currentTime)
        spotifyPlayer = {
            progressBar: document.querySelectorAll(curProgressBarQueryBig)[0],
            audioPLayerCurrentTime: document.querySelectorAll(audioPLayerCurrentTimeElement)[0],
            playButton: document.querySelectorAll(playButtonElement)[0],
            get duration() {
                return _duration
            },
            set duration(value) {
                _duration = value
            },
            get title() {
                return _title
            },
            set title(value) {
                _title = value
            },
            get playState() {
                return _playState
            },
            set playState(value) {
                _playState = value
            },
            get currentTime() {
                return _currentTime
            },
            set currentTime(value) {
                _currentTime = value
            },
            play: async () => {
                let positionPercentage = getSeconds(spotifyPlayer.currentTime) / getSeconds(spotifyPlayer.duration) * 100
                await setPlaybackPosition(positionPercentage, spotifyPlayer.progressBar)
                if (playButton) {
                    playButton.click();
                    spotifyPlayer.playState = !spotifyPlayer.playState
                    console.log('Playback started');
                } else {
                    console.error('Play button not found', playButton);
                }
            },
            updateCurrentTime: () => {
                spotifyPlayer.currentTime = spotifyPlayer.audioPLayerCurrentTime ? spotifyPlayer.audioPLayerCurrentTime.textContent : 0
                return spotifyPlayer.currentTime
            }
            
        }

        if (audioPlayerDuration && !audioPlayerDuration.hasAttribute('data-observer-added')) {
            new MutationObserver(async (mutations, observer) => {
                const audioPlayerDuration = document.querySelectorAll('div[data-testid="playback-duration"]')[0]
                const newDuration = audioPlayerDuration ? audioPlayerDuration.textContent : 0
                if (newDuration !== spotifyPlayer.duration) {
                    await newVideoLoaded()
                }
            }).observe(audioPlayerDuration, { childList: true, subtree: true, attributes: true, characterData: true });
            audioPlayerDuration.setAttribute('data-observer-added', 'true');
        }


        const bookmarks = await fetchBookmarks(currentVideoId)
        
        console.log('Sotify player:', spotifyPlayer.duration)

        addBookmarksOnProgressBar(bookmarks)
        
        if (!resizeObserver.observing) {
            resizeObserver.observe(document.body)
            resizeObserver.observing = true
        }
        if (!resizeObserverPlayer.observing) {
            if (spotifyPlayer.progressBar) {
                resizeObserverPlayer.observe(spotifyPlayer.progressBar)
                resizeObserverPlayer.observing = true
            }
        }

        const bookmarkButtonExistsBig = Boolean(document.getElementsByClassName('bookmark-btn')[0])
        console.log('Bookmark button exists:', bookmarkButtonExistsBig) 
        
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
            bookMarkBtn.style.width = '32px'
            bookMarkBtn.style.height = '32px'
            bookMarkBtn.style.zIndex = '150'
            bookMarkBtn.style.opacity = '0.4'
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
        console.log('New video loaded finished execution at:', newAudioLoadedExecutedTimes)
        newAudioLoadedExecutedTimes--
    }

    const bookmarkClickEventHandler = async (buttonClass) => {
        console.log('Bookmark button clicked', spotifyPlayer.playState)
        spotifyPlayer.playState && spotifyPlayer.play()
        
        let currentVideoBookmarks = []

        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
            return
        }

        const currentTime = spotifyPlayer.updateCurrentTime()

        const exists = await checkIfExists(currentVideoBookmarks, currentTime, buttonClass)
        if (exists) return

        await chrome.storage.sync.set({ taskStatus: true }, () => {
            console.log('Task status set to started');
        });
        chrome.runtime.sendMessage({ type: "CREATING_BOOKMARK" })
        
        const currAudioTitle = spotifyPlayer.title
        const newBookmark = {
            videoId: currentVideoId,
            urlTemplate: 'https://open.spotify.com/',
            time: currentTime,
            title: currAudioTitle,
        }

        // const bookMarkCaption = await getSubtitlesText()
        
        newBookmark.bookMarkCaption = `${newBookmark.title} - ${newBookmark.time}`

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
        console.log('Resize observer:', oldProgressBarSizeBig)
        const curProgressBarQueryWidthBig = document.querySelectorAll(curProgressBarQueryBig)[0].offsetWidth
        if (oldProgressBarSizeBig !== curProgressBarQueryWidthBig) {
            oldProgressBarSizeBig = curProgressBarQueryWidthBig
            console.log('Resize observer player changed:', oldProgressBarSizeBig)
            await newVideoLoaded()
        }
    })
    const resizeObserverPlayer = new ResizeObserver(async () => {
        console.log('Resize observer:', oldProgressBarSizeBig)
        const curProgressBarQueryWidthBig = document.querySelectorAll(curProgressBarQueryBig)[0].offsetWidth
        if (oldProgressBarSizeBig !== curProgressBarQueryWidthBig) {
            oldProgressBarSizeBig = curProgressBarQueryWidthBig
            console.log('Resize observer player changed:', oldProgressBarSizeBig)
            await newVideoLoaded()
        }
    })

    resizeObserver.observing = false
    resizeObserverPlayer.observing = false

    !isMessageListenerAdded && chrome.runtime.onMessage.addListener(async (obj, _sender, sendResponse) => {
        isMessageListenerAdded = true
        const { type, value, videoId } = obj
        currentVideoId = videoId
        if (currentVideoId === 'spotify') {
            const idElement = document.querySelectorAll('a[data-testid="context-item-link"]')[0]
            currentVideoId = idElement ? idElement.href.toString().replace('https://open.spotify.com/', '') : ''
            if (currentVideoId === '') {
                const observer = new MutationObserver((mutations, observer) => {
                    const idElement = document.querySelectorAll('a[data-testid="context-item-link"]')[0]
                    console.log('Mutation observer:', idElement)
                    if (checkForElement(idElement)) {
                        console.log('Element found:', idElement)
                        observer.disconnect();
                    }
                });
            
                observer.observe(document.body, { childList: true, subtree: true });
                sendResponse(false)
                return
            }
        }
        let currentVideoBookmarks = []
        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
        }
        console.log('Message received in spotifycontent.js:', obj, currentVideoBookmarks)
        if (type === 'NEW') {
            await chrome.storage.sync.set({ taskStatus: false }, async () => {
                await newVideoLoaded()
                console.log('Task status set to false');
            });
        } else if (type === 'PLAY') {
            spotifyPlayer.currentTime = value
            console.log('Play bookmark:', spotifyPlayer)
            spotifyPlayer.play()
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


