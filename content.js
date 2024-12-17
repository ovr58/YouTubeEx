
const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

(() => {

    let youtubeLeftControls, youtubePlayer
    let currentVideoId = ""
    
    //message function

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
            const observer = new MutationObserver((mutationsList, observer) => {
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
                        linesOnStart.length > 0 ? resolve(linesOnStart) : resolve(['No subtitles found'])
                    }
                }, 5000)
            } else {
                resolve(['No subtitles found'])
            }


        })
    }

    // const getSubtitlesContent = async (trackId) => {
    //     try {
    //         const response = await fetch(`http://localhost:3000/content?trackId=${trackId}`);
    //         const contentType = response.headers.get('Content-Type');
    //         console.log('RESPONSE:', response, contentType);
    //         let data;
    //         if (contentType.includes('application/json')) {
    //             data = await response.json();
    //         } else if (contentType.includes('text/xml')) {
    //             const text = await response.text();
    //             const parser = new DOMParser();
    //             data = parser.parseFromString(text, 'text/xml');
    //         } else {
    //             throw new Error('Unsupported content type:', contentType);
    //         }

    //         const subtitlesContent = data.items || Array.from(data.getElementsByTagName('text')).map((node) => ({
    //             start: parseFloat(node.getAttribute('start')),
    //             dur: parseFloat(node.getAttribute('dur')),
    //             text: node.textContent
    //         }))
    //         return subtitlesContent;
    //     } catch (error) {
    //         console.error('Error fetching subtitles content:', error);
    //         return [];
    //     }
    // }

    const getSubtitles = async (videoId) => {
        try {
            const response = await fetch(`http://localhost:3000/subtitles?videoId=${videoId}`);
            const data = await response.json();
            const subtitles = data.items;
            // Ищем субтитры, установленные по умолчанию
            const defaultSubtitle = subtitles.find(subtitle => subtitle.snippet.trackKind === "standard");
            
            console.log('Subtitles:', defaultSubtitle);
            // Возвращаем субтитры по умолчанию, если они найдены, иначе возвращаем все субтитры
            return defaultSubtitle ? [defaultSubtitle] : subtitles.find(subtitle => subtitle.snippet.trackKind === "asr");
        } catch (error) { 
            console.error('Error fetching subtitles:', error);
            return [];
        }  
    };

    const checkIfExists = (bookmarks, newBookmark) => {
        return new Promise((resolve, reject) => {
            for (element of bookmarks) {
                console.log(element.time, newBookmark.time)
                if (newBookmark.time <= element.time + 10 && newBookmark.time >= element.time - 10) {
                    
                    const bookMarkBtn = document.getElementsByClassName('bookmark-btn')[0]
                    const messageDiv = document.createElement('div');
                    messageDiv.style.position = 'absolute';
                    messageDiv.style.top = `${bookMarkBtn.offsetTop - 30}px`; // Позиционируем над кнопкой
                    messageDiv.style.left = `${bookMarkBtn.offsetLeft}px`;
                    messageDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
                    messageDiv.style.color = 'white';
                    messageDiv.style.padding = '5px 5px';
                    messageDiv.style.height = '60px';
                    messageDiv.style.borderRadius = '10px';
                    messageDiv.style.textAlign = 'center'
                    messageDiv.style.zIndex = '50'; // Высокий z-index для отображения поверх всего

                    const messageLine1 = document.createElement('p');
                    messageLine1.style.margin = '0';
                    messageLine1.style.padding = '0';
                    messageLine1.style.height = '10px';
                    messageLine1.innerText = 'Сначала удалите старую закладку!';
                    const messageLine2 = document.createElement('p');
                    messageLine2.style.margin = '0';
                    messageLine2.style.paddingTop = '2px';
                    messageLine2.style.height = '10px';
                    messageLine2.innerText = `в диапазоне ${getTime(element.time-10)} - ${getTime(element.time + 10)}`;
                    messageDiv.appendChild(messageLine1);
                    messageDiv.appendChild(messageLine2);
                    // Добавляем элемент в документ
                    bookMarkBtn.parentElement.appendChild(messageDiv);

                    // Удаляем сообщение через 3 секунды (опционально)
                    setTimeout(() => {
                        messageDiv.remove();
                    }, 5000);
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
                reject(error);
            }
    }) : []
    }

    const newVideoLoaded = async () => {

        const bookmarkButtonExists = document.getElementsByClassName('bookmark-btn')[0]
        console.log(bookmarkButtonExists)
        if (!bookmarkButtonExists) {
            bookMarkBtn = document.createElement('img')
            bookMarkBtn.src = chrome.runtime.getURL('assets/bookmark64x64.png')
            bookMarkBtn.className = 'ytp-button ' + 'bookmark-btn'
            bookMarkBtn.title = 'Добавить в закладки этот таймкод.'
            bookMarkBtn.style.cursor = 'pointer'
            bookMarkBtn.style.position = 'absolute'
            bookMarkBtn.style.top = '0'
            bookMarkBtn.style.left = '10px'
            bookMarkBtn.style.zIndex = '100'
            bookMarkBtn.style.opacity = '0.2'
            bookMarkBtn.style.transition = 'opacity 0.5s'
            youtubePlayer = document.getElementsByClassName('video-stream')[0]
            // youtubeLeftControls = document.getElementsByClassName('ytp-left-controls')[0]
    
            if (youtubePlayer) {
                youtubePlayer.parentNode.appendChild(bookMarkBtn)
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
        const currentTime = youtubePlayer.currentTime
        const currVideoTitle = document.title.split(' - YouTube')[0].replace(/^\(\d+\)\s*/, '').trim()
        const bookMarkCaption = await getSubtitlesText()
        const newBookmark = {
            videoId: currentVideoId,
            time: currentTime,
            title: currVideoTitle + ' - ' + getTime(currentTime),
            bookMarkCaption
        }

        let currentVideoBookmarks = []
        try {
            currentVideoBookmarks = await fetchBookmarks(currentVideoId)
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
        }
        const exists = await checkIfExists(currentVideoBookmarks, newBookmark)
        if (exists) return
        chrome.storage.sync.set({[currentVideoId]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a,b) => a.time - b.time))}, () => {
            console.log('Bookmark added:', newBookmark, currentVideoBookmarks)
        })
    }

    chrome.runtime.onMessage.addListener(async (obj, sender, sendResponse) => {
        const { type, value, videoId } = obj
        console.log('Message received:', obj)
        if (type === 'NEW') {
            currentVideoId = videoId
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


