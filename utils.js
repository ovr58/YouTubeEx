export async function getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    return tabs[0]
}

export function localizeContent() {
    const elements = document.querySelectorAll('[i18n]')
    elements.forEach(element => {
        const key = element.getAttribute('i18n')
        const message = chrome.i18n.getMessage(key)
        message.length > 0 && (element.textContent = message)
    })
}