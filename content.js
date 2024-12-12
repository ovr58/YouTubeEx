const getTime = (time) => {
    let date = new Date(null)
    date.setSeconds(time)

    return date.toISOString().substr(11, 8)
}

(() => {

    let youtubeLeftControls, youtubePlayer
    let currentVideoId = ""
    let currentVideoBookmarks = []

    const checkIfExists = (bookmarks, newBookmark) => {
        return new Promise((resolve, reject) => {
            for (element of bookmarks) {
                console.log(element.time, newBookmark.time)
                if (newBookmark.time <= element.time + 5 && newBookmark.time >= element.time - 5) {
                    
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
                    messageLine2.innerText = `в диапазоне ${getTime(element.time-5)} - ${getTime(element.time + 5)}`;
                    messageDiv.appendChild(messageLine1);
                    messageDiv.appendChild(messageLine2);
                    // Добавляем элемент в документ
                    bookMarkBtn.parentElement.appendChild(messageDiv);

                    // Удаляем сообщение через 3 секунды (опционально)
                    setTimeout(() => {
                        messageDiv.remove();
                    }, 10000);
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
            youtubePlayer = document.getElementsByClassName('video-stream')[0]
            youtubeLeftControls = document.getElementsByClassName('ytp-left-controls')[0]
    
            if (youtubePlayer && youtubeLeftControls) {
                youtubeLeftControls.appendChild(bookMarkBtn)
                bookMarkBtn.addEventListener('click', bookmarkClickEventHandler)
            }
        }
    }

    const bookmarkClickEventHandler = async () => {
        const currentTime = youtubePlayer.currentTime
        const currVideoTitle = document.title.split(' - YouTube')[0].replace(/^\(\d+\)\s*/, '').trim()
        const newBookmark = {
            videoId: currentVideoId,
            time: currentTime,
            title: currVideoTitle + ' - ' + getTime(currentTime)
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

    chrome.runtime.onMessage.addListener((obj, sender, sendResponse) => {
        const { type, videoId } = obj
        console.log('Message received:', obj)
        if (type === 'NEW') {
            currentVideoId = videoId
            newVideoLoaded()
        }
    })

    newVideoLoaded()
})();


