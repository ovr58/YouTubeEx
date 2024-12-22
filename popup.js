import { getCurrentTab, localizeContent } from "./utils.js";

const createNewBookmarkSpinner = (bookmarksContainer) => {
    const spinnerElement = document.createElement('div')
    spinnerElement.className = 'bookmark'
    spinnerElement.id = 'bookmark-spinner'
    const newSpinner = document.createElement('div')
    const message = document.createElement('span')
    message.className = 'bookmark-title'
    message.textContent = chrome.i18n.getMessage('creatingBookmark')
    newSpinner.className = 'spinner'
    bookmarksContainer.appendChild(newSpinner)
    bookmarksContainer.appendChild(message)
}

const addNewBookmark = (bookmarksContainer, bookmark, index) => { 
    const newBookmarkElement = document.createElement('div')
    const bookmarkTitleElement = document.createElement('div')
    const controlsElement = document.createElement('div')
    const pictureElement = document.createElement('img')

    controlsElement.className = 'bookmarks-controls'

    bookmarkTitleElement.textContent = bookmark.title
    bookmarkTitleElement.className = 'bookmark-title'

    newBookmarkElement.id = 'bookmark-' + index + '-' + bookmark.time
    newBookmarkElement.className = 'bookmark'
    newBookmarkElement.setAttribute('timestamp', bookmark.time)

    if (bookmark.bookMarkCaption) {
        newBookmarkElement.title = `...${bookmark.bookMarkCaption.join(' ')}...`
    }

    pictureElement.src = bookmark.frame
    pictureElement.className = 'bookmark-thumbnail'

    setBookmarkAttributes('play', onPlay, controlsElement)
    setBookmarkAttributes('delete', onDelete, controlsElement)

    newBookmarkElement.appendChild(bookmarkTitleElement)
    newBookmarkElement.appendChild(pictureElement)
    newBookmarkElement.appendChild(controlsElement)
    bookmarksContainer.appendChild(newBookmarkElement)

}

const viewBookmarks = (bookmarks = []) => {
    const bookmarksContainer = document.getElementById('bookmarks')
    bookmarksContainer.innerHTML = ''
    if (bookmarks.length > 0) {
        bookmarks.forEach((bookmark, index) => {
            addNewBookmark(bookmarksContainer, bookmark, index)
        })
    } else {
        bookmarksContainer.innerHTML = '<div class="title"><span i18n="noBookmarks"></span></div>'
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
    console.log('BookMark Time to delete:', bookmarkElementToDelete)
    bookmarkElementToDelete.parentNode.removeChild(bookmarkElementToDelete);
    
    chrome.tabs.sendMessage(activeTab.id, {
        type: "DELETE",
        value: bookmarkTime,
    }, () => {
        console.log('Bookmark Deleted Callback Called')
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

    const activeTab = await getCurrentTab()
    const queryParam = activeTab.url.split('?')[1]
    const urlParams = new URLSearchParams(queryParam)

    const videoId = urlParams.get('v')

    if (activeTab.url.includes('youtube.com/watch') && videoId) {
        const currentVideoBookmarks = await fetchBookmarks(videoId)
        
        console.log('VIEW BOOKMARKS CALLED', currentVideoBookmarks)
        viewBookmarks(currentVideoBookmarks)
    } else {
        const container = document.getElementsByClassName('container')[0]
        container.innerHTML = '<div class="title"><span i18n="openYoutubeVideoMessage"></span></div>'
    }
    localizeContent()
})

const port = chrome.runtime.connect({ name: "popup" });

port.onMessage.addListener((response) => {
    if (response.type === 'CREATING') {
        console.log("CREATING BOOKMARK ACKNOWLEDGED");
        const bookmarksContainer = document.getElementById('bookmarks')
        createNewBookmarkSpinner(bookmarksContainer)
        port.postMessage({ type: 'ACK' });
    } else if (response.type === 'STOP_CREATING') {
        console.log("STOP CREATING BOOKMARK ACKNOWLEDGED");
        const spinnerElement = document.getElementById('bookmark-spinner');
        if (spinnerElement) {
            spinnerElement.parentNode.removeChild(spinnerElement)
        }
        port.postMessage({ type: 'ACK' });
    }
})