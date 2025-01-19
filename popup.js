import { getCurrentTab, localizeContent } from "./utils.js";

const getCurSpinnerState = () => {
    return new Promise((resolve, _reject) => {
        chrome.storage.sync.get(['taskStatus'], (obj) => {
            resolve(obj.taskStatus)
        })
    })
}

const createNewBookmarkSpinner = (bookmarksContainer) => {
    const spinnerElement = document.createElement('div')
    spinnerElement.className = 'bookmark'
    spinnerElement.id = 'bookmark-spinner'
    const newSpinner = document.createElement('div')
    const message = document.createElement('span')
    message.className = 'bookmark-title'
    message.textContent = chrome.i18n.getMessage('creatingBookmark')
    newSpinner.className = 'spinner'
    spinnerElement.appendChild(newSpinner)
    spinnerElement.appendChild(message)
    bookmarksContainer.appendChild(spinnerElement)
    console.log('POPUP - Spinner Element:', spinnerElement)
}

const checkSetUpResult = (videoBookmarksObj, videoId) => {
    let checkSetUp = true
    console.log('POPUP - check set up:', videoBookmarksObj)
    if (videoBookmarksObj.length <= 1) {
        videoBookmarksObj[0] = {
            title: videoId,
            videoELement: 'needSetUp',
            containerId: 'needSetUp',
            controlsId: 'needSetUp'
        }
        if (videoBookmarksObj[0].videoELement && videoBookmarksObj[0].videoELement === 'needSetUp') {
            checkSetUp = false
            addSetUpElementButton('videoElementNeedSetup', 'setUpElementButtonContainer', videoId) // добавить в манифест файл
        }
        if (videoBookmarksObj[0].containerId && videoBookmarksObj[0].containerId === 'needSetUp') {
            checkSetUp = false
            addSetUpElementButton('containerIdElementNeedSetup', 'setUpElementButtonContainer', videoId) // добавить в манифест файл
        }
        if (videoBookmarksObj[0].controlsId && videoBookmarksObj[0].controlsId === 'needSetUp') {
            checkSetUp = false
            addSetUpElementButton('controlsIdElementNeedSetup', 'setUpElementButtonContainer', videoId) // добавить в манифест файл
        }
    } else {
        checkSetUp = true
    }
    return checkSetUp
}

const openVideo = async (videoId, urlTemplate) => {
    const url = `${urlTemplate}${videoId}`;
    const urlWithAsterisk = urlTemplate.replace('https://', '*://').replace('www.', '*.');

    // Проверяем, открыта ли уже вкладка с этим видео
    const tabs = await chrome.tabs.query({ url: `${urlWithAsterisk}${videoId}` });
    if (tabs.length > 0) {
        // Если вкладка уже открыта, делаем ее активной
        chrome.tabs.update(tabs[0].id, { active: true });
    } else {
        // Если вкладка не открыта, открываем новую вкладку
        chrome.tabs.create({ url });
    }
}

const deleteVideo = async (videoId) => {
    chrome.storage.sync.remove(videoId, () => {
        console.log('POPUP - Video Deleted:', videoId)
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
    });
}

const checkIfTabHasVideoElement = async (activeTab) => {
    const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id, allFrames: true },
        func: () => {
            const videos = document.querySelectorAll('video');
            return videos.length > 0;
        }
    });
    console.log('POPUP - Check If Tab Has Video Element:', results)
    return results.some(result => result.result);
}

const addSetUpElementButton = (caption, container, videoId) => {
    const buttonContainer = document.getElementById(container)
    
    const setUpButton = document.getElementById(caption) || document.createElement('button')
    setUpButton.id = caption
    setUpButton.className = 'setUpElementButton'
    setUpButton.textContent = chrome.i18n.getMessage(caption)
    setUpButton.addEventListener('click', async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        const activeTab = tabs[0]
        chrome.tabs.sendMessage(activeTab.id, { type: caption, value: activeTab.url, videoId: videoId  }, () => {
            console.log('POPUP - Setup Message Sent')
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);
        });
    });
    buttonContainer.appendChild(setUpButton)
}

const addSetUpButton = (activeTab) => {
    const setUpButtonContainer = document.getElementById('setUpButtonContainer')
    const setUpButton = document.getElementById(activeTab.url) || document.createElement('button')
    setUpButton.id = activeTab.url
    setUpButton.className = 'setUpButton'
    setUpButton.textContent = chrome.i18n.getMessage('setUpButton')
    setUpButton.addEventListener('click', async () => {
        await chrome.tabs.sendMessage(activeTab.id, { type: 'SETUP', value: activeTab.url }, () => {
            console.log('POPUP - Setup Message Sent')
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);
        });
    });
    setUpButtonContainer.appendChild(setUpButton)
}

const addListOfVideos = async (videoId) => {
    const videos = await fetchVideosWithBookmarks(videoId)
    console.log('POPUP - Videos:', videos)
    const dropdown = document.getElementById('dropdown')
    dropdown.innerHTML = ''
    videos.forEach((video, _index) => {
        const newVideoElement = document.createElement('option')
        newVideoElement.className = 'videoTitle'
        newVideoElement.textContent = video[0].title
        newVideoElement.id = 'video-' + video[0].videoId
        newVideoElement.value = video[0].videoId
        newVideoElement.setAttribute('url-template', video[0].urlTemplate)
        video[0].videoId === videoId ? newVideoElement.selected = true : null
        dropdown.appendChild(newVideoElement)
    })
    if (!videoId) {
        const placeholderOption = document.createElement('option');
        placeholderOption.textContent = chrome.i18n.getMessage('openVideoMessage');
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        dropdown.appendChild(placeholderOption);
    }
    dropdown.addEventListener('change', (event) => {
        event.preventDefault();
        event.stopPropagation();
        console.log('POPUP - Selected Video:', event.target.selectedOptions[0].getAttribute('url-template'), event.target.value)
        const selectedVideoId = event.target.value;
        const urlTemplate = event.target.selectedOptions[0].getAttribute('url-template');
        openVideo(selectedVideoId, urlTemplate)
    });
}

const addNewBookmark = (bookmarksContainer, bookmark, index) => { 
    const newBookmarkElement = document.createElement('div')
    const bookmarkTitleElement = document.createElement('div')
    const controlsElement = document.createElement('div')
    // const pictureElement = document.createElement('img')

    controlsElement.className = 'bookmarks-controls'

    bookmarkTitleElement.textContent = bookmark.title
    bookmarkTitleElement.className = 'bookmark-title'
    bookmarkTitleElement.addEventListener('click', () => {
        const input = document.createElement('textarea')
        input.style.whiteSpace = 'pre-wrap'
        input.style.width = bookmarkTitleElement.offsetWidth + 'px'
        input.style.height = bookmarkTitleElement.offsetHeight + 'px'
        input.value = bookmarkTitleElement.textContent
        // сделать шрифт input в два раза меншьше чем у bookmarkTitleElement
        input.style.fontSize = '12px'
        input.style.resize = 'none'
        input.style.boxSizing = 'border-box'
        bookmarkTitleElement.replaceWith(input)
        input.focus()
        input.addEventListener('blur', () => {
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);
        })
        input.addEventListener('keydown', async (event) => {
            if (event.key === 'Enter') {
                bookmarkTitleElement.textContent = input.value
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
                const activeTab = tabs[0]
                chrome.tabs.sendMessage(activeTab.id, {
                    type: 'UPDATE',
                    value: {
                        time: bookmark.time,
                        title: input.value,
                    }
                }, () => {
                    const event = new Event('DOMContentLoaded');
                    document.dispatchEvent(event);
                });
            }
        })
    })

    newBookmarkElement.id = 'bookmark-' + index + '-' + bookmark.time
    newBookmarkElement.className = 'bookmark'
    newBookmarkElement.setAttribute('timestamp', bookmark.time)

    if (bookmark.bookMarkCaption) {
        newBookmarkElement.title = bookmark.bookMarkCaption
    }

    // pictureElement.src = bookmark.frame
    // pictureElement.className = 'bookmark-thumbnail'

    setBookmarkAttributes('play', onPlay, controlsElement)
    setBookmarkAttributes('delete', onDelete, controlsElement)

    newBookmarkElement.appendChild(bookmarkTitleElement)
    // newBookmarkElement.appendChild(pictureElement)
    newBookmarkElement.appendChild(controlsElement)
    bookmarksContainer.appendChild(newBookmarkElement)

}

const viewBookmarks = async (bookmarks = []) => {
    const bookmarksContainer = document.getElementById('bookmarks')
    bookmarksContainer.innerHTML = ''
    if (bookmarks.length > 0) {
        bookmarks.forEach((bookmark, index) => {
            addNewBookmark(bookmarksContainer, bookmark, index)
        })
    } else {
        bookmarksContainer.innerHTML = '<div class="title"><span i18n="noBookmarks"></span></div>'
    }

    let spinerVisible = await getCurSpinnerState()

    if (spinerVisible) {
        if (!document.getElementById('bookmark-spinner')) {
            createNewBookmarkSpinner(bookmarksContainer)
        }
    } else {
        if (document.getElementById('bookmark-spinner')) {
            document.getElementById('bookmark-spinner').remove()
        }
    }

    localizeContent()
}

const fetchAllowedUrls = () => {
    return new Promise((resolve, _reject) => {
        chrome.storage.sync.get(['allowedUrls'], (obj) => {
            resolve(obj.allowedUrls)
        })
    })
}

const fetchBookmarks = (videoId) => {
    return new Promise((resolve, _reject) => {
    chrome.storage.sync.get([videoId], (obj) => {
        resolve(obj[videoId] ? JSON.parse(obj[videoId]) : [])
    })
})
}

const fetchVideosWithBookmarks = (videoId) => {
    return new Promise((resolve, _reject) => {
        chrome.storage.sync.get(null, (obj) => {
            console.log('POPUP - Fetch Videos:', obj, videoId)   
            const videos = []
            Object.keys(obj).forEach(key => {
                const video = JSON.parse(obj[key])
                console.log('POPUP - Video:', key, video)
                if (key === videoId && video.length === 0) {
                    const curVideo = [{
                        videoId: key,
                        title: chrome.i18n.getMessage('currentVideo')
                    }]
                    videos.push(curVideo)
                } else if (key !== videoId && video.length === 0) {
                    chrome.storage.sync.remove(key)
                } else if (video.length > 0 && key !== 'allowedUrls') {
                    videos.push(video)
                }
            })
            if (!Object.keys(obj).includes(videoId) && videoId) {
                const curVideo = [{
                    videoId: videoId,
                    title: chrome.i18n.getMessage('currentVideo')
                }]
                videos.push(curVideo)
            }
            resolve(videos)
        })
    })
}

const onPlay = async e => {
    const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
    const activeTab = await getCurrentTab();
  
    chrome.tabs.sendMessage(activeTab.id, {
      type: "PLAY",
      value: bookmarkTime,
    });
};
  
const onDelete = async e => {
    console.log('Delete Bookmark')
    const activeTab = await getCurrentTab();
    
    const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
    const bookmarkElementToDelete = document.querySelector(`[timestamp="${bookmarkTime}"]`);
    console.log('POPUP - BookMark Time to delete:', bookmarkElementToDelete)
    bookmarkElementToDelete.parentNode.removeChild(bookmarkElementToDelete);
    
    await chrome.tabs.sendMessage(activeTab.id, {
        type: "DELETE",
        value: bookmarkTime,
    }, () => {
        console.log('POPUP - Bookmark Deleted Callback Called')
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
    });
};

const setBookmarkAttributes =  (src, eventListener, controlParentElement) => {
    const controlElement = document.createElement("img");
  
    controlElement.src = "assets/" + src + "64x64.png";
    controlElement.style.cursor = "pointer";
    controlElement.style.boxShadow = "0 4px 4px rgba(255, 0, 0, 0.65)"
    controlElement.style.transition = "box-shadow 0.3s"
    switch (src) {
        case "play":
            controlElement.title = chrome.i18n.getMessage("playBookmark");
            break;
        case "delete":
            controlElement.title = chrome.i18n.getMessage("deleteTheBookmark");
            break;
    }
    controlElement.height = 20;
    controlElement.width = 20;
    controlElement.style.borderRadius = "50%";
    controlElement.addEventListener("mouseover", () => {
        controlElement.style.boxShadow = "0 8px 16px rgba(255, 0, 0, 0.78)"
    });
    controlElement.addEventListener("mouseout", () => {
        controlElement.style.boxShadow = "0 4px 4px rgba(255, 0, 0, 0.2)"
    });
    controlElement.addEventListener("mousedown", () => {
        controlElement.style.boxShadow = "none"
    });
    controlElement.addEventListener("mouseup", () => {
        controlElement.style.boxShadow = "0 8px 16px rgba(234, 2, 2, 0.71)"
    });
    controlElement.addEventListener("click", eventListener);
    controlParentElement.appendChild(controlElement);
}

document.addEventListener('DOMContentLoaded', async () => {
    const getUrlParams = async (url) => {
        const allowedUrls = await fetchAllowedUrls()
        let urlParams = null
        if (url.includes('youtube.com/watch')) {
            const queryParam = url.split('?')[1];
            urlParams = new URLSearchParams(queryParam).get('v');
        } else if (/vk(video\.ru|\.com)\/video/.test(url)) {
            urlParams = url.split('/video-')[1];
        } else if (allowedUrls && allowedUrls.includes(url)) {
            urlParams = url
        }
        return urlParams
    }
    const container = document.getElementById('container')

    const activeTab = await getCurrentTab()
    const urlParams = await getUrlParams(activeTab.url)

    const videoId = urlParams
    addListOfVideos(videoId)
    if (videoId) {
        if (activeTab.url.includes('youtube.com/watch') || /vk(video\.ru|\.com)\/video/.test(activeTab.url)) {
            const currentVideoBookmarks = await fetchBookmarks(videoId)
            console.log('POPUP - VIEW BOOKMARKS CALLED', currentVideoBookmarks)
            const listTitle = document.getElementById('listTitle')
            listTitle.textContent = chrome.i18n.getMessage('extentionTitle')
            viewBookmarks(currentVideoBookmarks)
        } else {
            const currentVideoBookmarks = await fetchBookmarks(videoId)
            const checkSetUp = checkSetUpResult(currentVideoBookmarks, videoId)
            if (checkSetUp) {
                const listTitle = document.getElementById('listTitle')
                listTitle.textContent = chrome.i18n.getMessage('extentionTitle')
                viewBookmarks(currentVideoBookmarks)
            } else {
                const listTitle = document.getElementById('listTitle')
                listTitle.textContent = chrome.i18n.getMessage('setUpButton')
            }
        }
    } else {
        const hasVideoElement = await checkIfTabHasVideoElement(activeTab)
        console.log('POPUP - Has Video Element:', hasVideoElement)
        hasVideoElement ? addSetUpButton(activeTab) : document.getElementById('listTitle').textContent = chrome.i18n.getMessage('openVideoMessage'
        )
    }
    const port = chrome.runtime.connect({ name: "popup" });

    port.postMessage({ type: 'POPUP_READY' });

    port.onMessage.addListener((response) => {
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
        return true;
    });
    
    chrome.storage.onChanged.addListener((changes, _areaName) => {
        console.log('POPUP - Storage Changed:', changes)
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
        return true;
    });

    localizeContent()
})
