function isEmpty(obj) {
    if(obj) return Object.keys(obj).length === 0;
    return true;
}
function checkArrayForString(arr, string) {
    for(let i = 0; i < arr.length; i++) {
        if(arr[i].indexOf(string) > -1) {
            return true;
        }
    };
    return false;
}

function startJustRead(tab) {
    if(tab) {
        continueJustRead(tab);
    } else {
        chrome.tabs.query({
            active: true,
            lastFocusedWindow: true
        }, function(tabs) {
            continueJustRead(tabs[0]);
        });
    }
}

function continueJustRead(tab) {
    // Load our external scripts, then our content script
    chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        files: [
            "/external-libraries/datGUI/dat.gui.min.js",
            "/external-libraries/DOMPurify/purify.min.js",
            "/external-libraries/Rangy/rangy.min.js",
            "/external-libraries/Rangy/rangy-classapplier.min.js",
            "/external-libraries/Rangy/rangy-highlighter.min.js",
            "/external-libraries/Rangy/rangy-textrange.min.js",
            "content_script.js"
        ]
    });

    // Add a badge to signify the extension is in use
    chrome.action.setBadgeBackgroundColor({color:[242, 38, 19, 230]});
    chrome.action.setBadgeText({text:"on"});

    // Check if we need to add the site to JR's autorun list
    chrome.storage.sync.get("alwaysAddAR", function(result) {
        if(result && result["alwaysAddAR"]) {
            addSiteToAutorunList(null, tab);
        }
    });

    setTimeout(function() {
        chrome.action.setBadgeText({text: ""});
        chrome.storage.sync.set({ 'useText': false });
        chrome.storage.sync.set({ 'runOnLoad': false });
        chrome.storage.sync.set({ 'textToRead': false });
    }, 2000);
}

function startSelectText() {
    chrome.storage.sync.set({ 'useText': true });
    startJustRead();
}

function createPageCM() {
    // Create a right click menu option
    pageCMId = chrome.contextMenus.create({
        title: "View this page using Just Read",
        id: "pageCM",
        contexts: ["page"]
    }, () => chrome.runtime.lastError);
}
function createHighlightCM() {
    // Create an entry to allow user to use currently selected text
    highlightCMId = chrome.contextMenus.create({
        title: "View this selection in Just Read",
        id: "highlightCM",
        contexts: ["selection"]
    }, () => chrome.runtime.lastError);
}
function createLinkCM() {
    // Create an entry to allow user to open a given link using Just read
    linkCMId = chrome.contextMenus.create({
        title: "View the linked page using Just Read",
        id: "linkCM",
        contexts: ["link"]
    }, () => chrome.runtime.lastError);
}
function createAutorunCM() {
    // Create an entry to allow user to open a given link using Just read
    autorunCMId = chrome.contextMenus.create({
        title: "Add this site to Just Read's auto-run list",
        id: "autorunCM",
        contexts: ["page"]
    }, () => chrome.runtime.lastError);
}
function addSiteToAutorunList(info, tab) {
    chrome.storage.sync.get('auto-enable-site-list', function(result) {
        let url = new URL((info != null && info.pageUrl) || tab.url);
        let entry;
        if(url.pathname !== "/"
        && url.pathname !== "") {
            entry = url.hostname + "/.+";
        } else {
            entry = url.hostname;
        }

        let currentDomains = result['auto-enable-site-list'];

        if(!isEmpty(currentDomains)) {
            if(!currentDomains.includes(entry)) {
                chrome.storage.sync.set({
                    'auto-enable-site-list': [...currentDomains, entry],
                }, function() {
                    if(checkArrayForString(currentDomains, url.hostname)) {
                        console.log("Just Read auto-run entry added.\n\nWarning: An auto-run entry with the same hostname has already been added. Be careful to not add two duplicates.");
                    } else {
                        console.log('Just Read auto-run entry added.');
                    }
                });
            } else {
                console.error("Entry already exists inside of Just Read's auto-run list. Not adding new entry.")
            }
        } else {
            chrome.storage.sync.set({ 'auto-enable-site-list': [entry] });
        }
    });
}


let pageCMId = highlightCMId = linkCMId = autorunCMId = undefined;
function updateCMs() {
    chrome.storage.sync.get(["enable-pageCM", "enable-highlightCM", "enable-linkCM", "enable-autorunCM"], function (result) {
        let size = 0;

        for(let key in result) {
            size++;

            if(key === "enable-pageCM") {
                if(result[key]) {
                    if(typeof pageCMId == "undefined")
                        createPageCM();
                } else {
                    if(typeof pageCMId != "undefined") {
                        chrome.contextMenus.remove("pageCM");
                        pageCMId = undefined;
                    }
                }
            } else if(key === "enable-highlightCM") {
                if(result[key]) {
                    if(typeof highlightCMId == "undefined")
                        createHighlightCM();
                } else {
                    if(typeof highlightCMId != "undefined") {
                        chrome.contextMenus.remove("highlightCM");
                        highlightCMId = undefined;
                    }
                }
            }
            else if(key === "enable-linkCM") {
                if(result[key]) {
                    if(typeof linkCMId == "undefined")
                        createLinkCM();
                } else {
                    if(typeof linkCMId != "undefined") {
                        chrome.contextMenus.remove("linkCM");
                        linkCMId = undefined;
                    }
                }
            }
            else if(key === "enable-autorunCM") {
                if(result[key]) {
                    if(typeof autorunCMId == "undefined")
                        createAutorunCM();
                } else {
                    if(typeof autorunCMId != "undefined") {
                        chrome.contextMenus.remove("autorunCM");
                        autorunCMId = undefined;
                    }
                }
            }
        }

        if(size === 0) {
            createPageCM();
            createHighlightCM();
            createLinkCM();
            createAutorunCM();
        }
    });
}

// Listen for the extension's click
chrome.action.onClicked.addListener(startJustRead);

// Add our context menus
updateCMs();

// Listen for the keyboard shortcut
chrome.commands.onCommand.addListener(function(command) {
    if(command == "open-just-read")
        startJustRead();
    if(command == "select-text")
        startSelectText();
});

// Listen for messages
let lastClosed = Date.now();
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request === "Open options") {
        chrome.runtime.openOptionsPage();
    } else if(request.updateCMs === "true") {
        updateCMs();
    } else if(request.closeTab === "true") {
        chrome.tabs.query({
            active: true,
            lastFocusedWindow: true
        }, function(tabs) {
            const tab = tabs[0];
            setTimeout(function() { chrome.tabs.remove(tab.id) }, 100);
        });
    } else if(request.savedVersion) {
        const data = {
            content: request.savedVersion,
            url: sender.url,
        };
        if(request.savedComments) {
            data.savedComments = request.savedComments;
            data.savedCompactComments = request.savedCompactComments;
        }
        localStorage.setItem('JRSavedPage', JSON.stringify(data));
    } else if(request.hasSavedVersion) {
        const lastSavedPage = JSON.parse(localStorage.getItem('JRSavedPage'));
        if(lastSavedPage
        && sender.url === lastSavedPage.url) {
            if(lastSavedPage.savedComments) {
                sendResponse({
                    content: lastSavedPage.content,
                    savedComments: lastSavedPage.savedComments,
                    savedCompactComments: lastSavedPage.savedCompactComments
                });
            } else {
                sendResponse({ content: lastSavedPage.content });
            }
        }
    }
    else if(request.lastClosed) {
        lastClosed = request.lastClosed;
    }
    // For JRP
    else if(request.jrSecret) {
        chrome.storage.sync.set({'jrSecret': request.jrSecret});
    }
    else if (request.resetJRLastChecked) {
        chrome.storage.sync.set({'jrLastChecked': ''});
    }
});

// Create an entry to allow user to select an element to read from
chrome.contextMenus.create({
    title: "Select content to read",
    contexts: ["browser_action"],
    id: "selectContentCM"
}, () => chrome.runtime.lastError);

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId === "selectContentCM") {
        startSelectText();
    } else if (info.menuItemId === "pageCM") {
        startJustRead();
    } else if (info.menuItemId === "highlightCM") {
        chrome.storage.sync.set({ 'textToRead': true });
        startJustRead();
    } else if (info.menuItemId === "linkCM") {
        // TODO fix? Bug currently prevents: https://bugs.chromium.org/p/chromium/issues/detail?id=1191971
        chrome.tabs.create(
            { url: info.linkUrl, active: false },
            function(newTab) {
                chrome.storage.sync.set({ 'runOnLoad': true });
                startJustRead(newTab);
            }
        );
    } else if (info.menuItemId === "autorunCM") {
        addSiteToAutorunList();
    }
});

chrome.tabs.onUpdated.addListener( function (tabId, changeInfo, tab) {
    const change = Date.now() - lastClosed;
    if (changeInfo.status === 'complete' && change > 300) {
        // Auto enable on sites specified
        chrome.storage.sync.get('auto-enable-site-list', function (siteListObj) {
            let siteList;
            if(siteListObj) {
                siteList = siteListObj['auto-enable-site-list'];
                const url = tab.url;

                if(typeof siteList !== "undefined") {
                    for(let i = 0; i < siteList.length; i++) {
                        const regex = new RegExp(siteList[i], "i");

                        if( url.match( regex ) ) {
                            chrome.storage.sync.set({ 'runOnLoad': true });
                            startJustRead(tab);
                            return;
                        }
                    }
                }
            }
        });
    }
});
