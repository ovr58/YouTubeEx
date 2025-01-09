export async function getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    return tabs[0]
}

export function localizeContent() {
    const elements = [...document.querySelectorAll('[i18n]'), ...document.querySelectorAll('[i18n-title]')]
    elements.forEach(element => {
        let key = element.getAttribute('i18n') 
        if (!key) {
            key = element.getAttribute('i18n-title')
            element.title = chrome.i18n.getMessage(key)
        } else {
            element.textContent = chrome.i18n.getMessage(key)
        }
    })
}