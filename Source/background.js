/*global localStorage*/
/**
 * Copyright (c) <YEAR>, <OWNER>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
(function (dictionary) {
    "use strict";

    var ONE_DAY = 1000 * 60 * 60 * 24,
        KEY_LAST_CHANGED_AT = 'lastChangedAt',
        KEY_OPTIONS = 'options',
        KEY_PAUSED = 'paused',
        _alreadyQueued = false;

    function now() {
        return new Date().getTime();
    }

    function checkForRandomSwap() {
        var lastChangedAt, pollTimeout;
        var options = JSON.parse(localStorage.getItem(KEY_OPTIONS));

        if (options && options.checkDaily) {
            lastChangedAt = parseInt(localStorage.getItem(KEY_LAST_CHANGED_AT), 10);

            // If it's never been changed, or if it's been over a day since it was changed...
            if (isNaN(lastChangedAt) || lastChangedAt + ONE_DAY < now()) {
                var pause = (0.5 > Math.random()); // Flip a coin!
                lastChangedAt = setPaused(pause);
            }

            // Set up the next check.
            if (!_alreadyQueued) {
                pollTimeout = (lastChangedAt + ONE_DAY) - now();

                setTimeout(function () {
                    _alreadyQueued = false;
                    checkForRandomSwap();
                }, pollTimeout);

                _alreadyQueued = true;
            }
        }
    }

    function updateBadge(paused) {
        var badgeText = paused ? "OFF" : "";
        chrome.browserAction.setBadgeText({ text: badgeText });
    }

    function isPaused() {
        return 'true' === localStorage.getItem(KEY_PAUSED);
    }

    function setPaused(paused) {
        var lastChangedAt = now();

        localStorage.setItem(KEY_PAUSED, paused);
        chrome.storage.sync.set({ 'paused': paused });
        updateBadge(paused);

        localStorage.setItem(KEY_LAST_CHANGED_AT, lastChangedAt);
        return lastChangedAt;
    }

    function togglePause(tab) {
        setPaused(!isPaused());

        // Reload the current tab.
        chrome.tabs.update(tab.id, {url: tab.url});
    }

    function getExcluded() {
        var opts = JSON.parse(localStorage.getItem(KEY_OPTIONS));
        return opts ? opts.excluded : [];
    }

    function onMessage(request, sender, sendResponse) {
        var i,
            requestId = request.id,
            stringifiedRegexDict = {'replacements': []};

        switch (requestId) {
        case 'isPaused?':
            // TODO: Convert to boolean.
            sendResponse({value: isPaused()});
            break;
        case 'getExcluded':
            sendResponse({value: getExcluded()});
            break;
        case 'setOptions':
            localStorage.setItem(KEY_OPTIONS, request.options);
            break;
        case 'getDictionary':
            for (i = 0; i < dictionary.replacements.length; i++) {
                if (dictionary.replacements[i][0] instanceof RegExp) {
                    stringifiedRegexDict.replacements.push([
                        dictionary.replacements[i][0].toString(),
                        dictionary.replacements[i][1]
                    ]);
                } else {
                    stringifiedRegexDict.replacements.push(
                        dictionary.replacements[i]);
                }
            }
            sendResponse(stringifiedRegexDict);
            break;
        default:
            throw new Error("Unmanaged case " + requestId);
        }
    }

    chrome.browserAction.onClicked.addListener(togglePause);
    chrome.extension.onRequest.addListener(onMessage);

    // TODO: Have an option where you can select a specific replacement set, such as "Standard", "Cynical Millenial", etc.
    // TODO: The option value would then be passed into loadDictionary for appropriate dictionary file selection.

    updateBadge(isPaused());

    checkForRandomSwap();

}(this.dictionary));
