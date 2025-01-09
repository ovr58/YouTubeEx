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

const addListOfVideos = async (videoId) => {
    const videos = await fetchVideosWithBookmarks(videoId)
    console.log('POPUP - Videos:', videos)
    const dropdown = document.getElementById('dropdown')
    videos.forEach((video, index) => {
        const newVideoElement = document.createElement('option')
        newVideoElement.className = 'videoTitle'
        newVideoElement.textContent = video[0].title
        newVideoElement.id = 'video-' + video[0].videoId
        newVideoElement.value = video[0].videoId
        const deleteVideoElement = document.createElement('div')
        deleteVideoElement.className = 'bookmarks-controls'
        setBookmarkAttributes('delete', onDeleteVideo, deleteVideoElement)
        video[0].videoId === videoId ? newVideoElement.selected = true : null
        dropdown.appendChild(newVideoElement)
    })
    dropdown.addEventListener('change', async (event) => {
        console.log('POPUP - Selected Video:', event.target)
        const selectedVideoId = event.target.value;
        const url = `https://www.youtube.com/watch?v=${selectedVideoId}`;

        // Проверяем, открыта ли уже вкладка с этим видео
        const tabs = await chrome.tabs.query({ url: `*://*.youtube.com/watch?v=${selectedVideoId}` });
        if (tabs.length > 0) {
            // Если вкладка уже открыта, делаем ее активной
            chrome.tabs.update(tabs[0].id, { active: true });
        } else {
            // Если вкладка не открыта, открываем новую вкладку
            chrome.tabs.create({ url });
        }
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
            console.log('POPUP - Fetch Videos:', obj)   
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
                }
                if (video.length > 0) {
                    videos.push(video)
                }
            })
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
    
    chrome.tabs.sendMessage(activeTab.id, {
        type: "DELETE",
        value: bookmarkTime,
    }, () => {
        console.log('POPUP - Bookmark Deleted Callback Called')
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
    });
};

const onDeleteVideo = async e => {
    console.log('Delete Video')
    
    const videoId = e.target.value;
    
    chrome.tabs.sendMessage(activeTab.id, {
        type: "DELETEVIDEO",
        value: videoId,
    }, () => {
        console.log('POPUP - Video Deleted Callback Called')
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
    const container = document.getElementsByClassName('container')[0]

    const activeTab = await getCurrentTab()
    const queryParam = activeTab.url.split('?')[1]
    const urlParams = new URLSearchParams(queryParam)

    const videoId = urlParams.get('v')
    addListOfVideos(videoId)
    if (activeTab.url.includes('youtube.com/watch') && videoId) {
        const currentVideoBookmarks = await fetchBookmarks(videoId)
        
        console.log('POPUP - VIEW BOOKMARKS CALLED', currentVideoBookmarks)
        viewBookmarks(currentVideoBookmarks)
    } else {
        container.innerHTML = '<div class="title"><span i18n="openYoutubeVideoMessage"></span></div>'
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
