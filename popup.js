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

const addSliderForContainer = (allDivElements, curValue, index) => {
    console.log('Trying to add slider for container:')
    const container = document.getElementById('sliderContainer')
    let sliderContainer = document.getElementById(`sliderElement-${index}`)
    if (sliderContainer) {
        return
    }
    sliderContainer = document.createElement('div')
    sliderContainer.id = `sliderElement-${index}`
    sliderContainer.className = 'slidecontainer'
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = 0
    slider.max = allDivElements.length - 1
    slider.value = allDivElements.indexOf(allDivElements.find(element => element.id === curValue || element.class === curValue))
    slider.className = 'slider'
    slider.id = `${index}`
    slider.addEventListener('input', async (event) => {
        allDivElements[event.target.value].sliderIndex = event.target.id
        const value = JSON.stringify(allDivElements[event.target.value]);
        const curTab = await getCurrentTab()
        await chrome.tabs.sendMessage(curTab.id, { type: 'SLIDER_UPDATE', value: value, videoId: curTab.url }, () => {
            console.log('Slider value sent:', value)
        })
    })
    sliderContainer.appendChild(slider)
    container.appendChild(sliderContainer)
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
            console.log('POPUP - VIDEOS:', Array.from(videos))
            return Array.from(videos).map(video => {
                const rect = video.getBoundingClientRect();
                return {
                    id: video.id,
                    class: video.className,
                    rect: {
                        width: rect.width,
                        height: rect.height,
                        top: rect.top,
                        left: rect.left,
                        duration: video.duration
                    }
                };
            }); 
        }
    });
    console.log('POPUP - Check If Tab Has Video Element:', results)
    return results.flatMap(result => result.result);
}

const setUpcontainersId = async (currValue) => {
    console.log('POPUP - Setup Containers Id Called:', currValue)
    const collectDivElements = async (activeTabId) => {
        const results = await chrome.scripting.executeScript({
            target: { tabId: activeTabId, allFrames: true },
            func: () => {
                const collectAllDivElements = (root) => {
                    const elements = [];
    
                    const traverseDom = (node) => {
                        if (node.nodeName.toLowerCase() === 'div') {
                            const rect = node.getBoundingClientRect();
                            elements.push({
                                id: node.id,
                                class: node.className,
                                rect: {
                                    top: rect.top,
                                    left: rect.left,
                                    width: rect.width,
                                    height: rect.height
                                }
                            });
                        }
                        node.childNodes.forEach(child => traverseDom(child));
                    };
    
                    traverseDom(root);
                    return elements;
                };
    
                return collectAllDivElements(document.body);
            }
        });
    
        const allDivElements = results.flatMap(result => result.result);
        console.log('All <div> elements:', allDivElements);
        return allDivElements;
    }

    // const curVideoElementData = currValue.videoElement
    const curContainerId = currValue.containerId
    const curControlsId = currValue.controlsId
    const curTab = await getCurrentTab() 
    const divElements = await collectDivElements(curTab.id)
    // const divElementsInVideoPlayer = divElements.filter(divElement => {
    //     const rect = divElement.rect
    //     return rect.top > curVideoElementData.top && rect.left > curVideoElementData.left && rect.width < curVideoElementData.width && rect.height < curVideoElementData.height && rect.top + rect.height < curVideoElementData.top + curVideoElementData.height && rect.left + rect.width < curVideoElementData.left + curVideoElementData.width
    // })
    console.log('POPUP - Div Elements In Video Player:', divElements)
    addSliderForContainer(divElements, curControlsId, 'controlsId')
    addSliderForContainer(divElements, curContainerId, 'containerId')
}

const setUpVideoElement = (activeTab, elements, id) => {
    const setUpListContainer = document.getElementById('setUpListContainer')
    setUpListContainer.innerHTML = ''
    const listOfElements = document.createElement('select')
    listOfElements.id = id
    listOfElements.className = 'listOfElements'
    elements.forEach((element, index) => {
        const newElement = document.createElement('option')
        newElement.className = 'videoTitle'
        newElement.textContent = `Element ${index + 1} - ${element.duration} duration`
        newElement.value = JSON.stringify(element)
        newElement.setAttribute('video-id', activeTab.url)
        newElement.id = 'element-' + index
        listOfElements.appendChild(newElement)
    })
    const placeholderOption = document.createElement('option');
    placeholderOption.textContent = chrome.i18n.getMessage('selectVideoElement');
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    listOfElements.appendChild(placeholderOption)
    listOfElements.addEventListener('change', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const curTabs = await chrome.tabs.query({ active: true, currentWindow: true })
        console.log('POPUP - VALUE AND VIDEO ID:', event.target.value, event.target.selectedOptions[0].getAttribute('video-id'))
        chrome.tabs.sendMessage(curTabs[0].id, { type: 'SETUP_VIDEO_ELEMET', value: event.target.value, videoId: event.target.selectedOptions[0].getAttribute('video-id') }, () => {
            console.log('POPUP - Setup Message Sent')
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);
        });
    });
    setUpListContainer.appendChild(listOfElements)
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
    console.log('POPUP - DOMContentLoaded')
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
            const setUpListContainer = document.getElementById('setUpListContainer')
            setUpListContainer ? setUpListContainer.innerHTML = '' : null
            await setUpcontainersId(currentVideoBookmarks[0])
            const listTitle = document.getElementById('listTitle')
            listTitle.textContent = chrome.i18n.getMessage('extentionTitle')
            viewBookmarks(currentVideoBookmarks.slice(1))
        }
    } else {
        const hasVideoElement = await checkIfTabHasVideoElement(activeTab)
        console.log('POPUP - Has Video Element:', hasVideoElement)
        hasVideoElement.length > 0 ? setUpVideoElement(activeTab, hasVideoElement, 'listOfVideos') : document.getElementById('listTitle').textContent = chrome.i18n.getMessage('openVideoMessage')
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
