import { getCurrentTab } from "./utils.js";

const addNewBookmark = (bookmarksContainer, bookmark, index) => { 
    const bookmarkTitleElement = document.createElement('div')
    const newBookmarkElement = document.createElement('div')
    const controlsElement = document.createElement('div')

    controlsElement.className = 'bookmarks-controls'

    bookmarkTitleElement.textContent = bookmark.title
    bookmarkTitleElement.className = 'bookmark-title'

    newBookmarkElement.id = 'bookmark-' + index + '-' + bookmark.time
    newBookmarkElement.className = 'bookmark'
    newBookmarkElement.setAttribute('timestamp', bookmark.time)

    setBookmarkAttributes('play', onPlay, controlsElement)

    newBookmarkElement.appendChild(bookmarkTitleElement)
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
        bookmarksContainer.innerHTML = '<div class="title">Закладок нет</div>'
    }
}

const fetchBookmarks = (videoId) => {
    return new Promise((resolve, reject) => {
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
    const activeTab = await getCurrentTab();
    const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
    const bookmarkElementToDelete = document.getElementById(
        "bookmark-" + bookmarkTime
    );

    bookmarkElementToDelete.parentNode.removeChild(bookmarkElementToDelete);

    chrome.tabs.sendMessage(activeTab.id, {
        type: "DELETE",
        value: bookmarkTime,
    }, viewBookmarks);
};

const setBookmarkAttributes =  (src, eventListener, controlParentElement) => {
    const controlElement = document.createElement("img");
  
    controlElement.src = "assets/" + src + "64x64.png";
    switch (src) {
        case "play":
            controlElement.title = "Воспроизвести закладку";
            break;
        case "delete":
            controlElement.title = "Удалить закладку";
            break;
    }
    controlElement.height = 20;
    controlElement.width = 20;
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
        viewBookmarks(currentVideoBookmarks)
    } else {
        const container = document.getElementsByClassName('container')[0]
        container.innerHTML = '<div class="title">Откройте видео на YouTube, чтобы добавить закладки.</div>'
    }
})