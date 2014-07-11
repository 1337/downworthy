/*global chrome,document,window*/
(function (self) {
    "use strict";
    var Deferred,
        Promise,
        dictionary,
        timeout = null,
        running = true,
        getDictionary,
        replaceText,
        sendRequest,
        walk,
        work,
        regexForQuestionMark = new RegExp("\\?", "g"),
        regexForPeriod = new RegExp("\\.", "g"),
        regexForSpace = new RegExp("\\s", "g");

    /**
     * Nonstandard Promise object. if a callback raises an exception, all
     * subsequent callbacks are aborted.
     */
    Promise = function (fn) {
        var self = this;
        self.handlers = [];

        if (fn) {
            self.handlers.push(fn);
        }

        self.then = function (callback) {
            self.handlers.push(callback);
            return self;
        };
        self.run = function () {
            var i;
            for (i = 0; i < self.handlers.length; i++) {
                try {
                    self.handlers[i].apply(self, arguments);
                } catch (err) {
                    break;
                }
            }
        };
    };

    /**
     * Unused Promise wrapper
     *
     * @param fn
     * @param context
     * @returns {Promise}
     * @constructor
     */
    Deferred = function (fn, context) {
        var promise = new Promise(fn);

        context = context || self;

        setTimeout(function () {
            fn.apply(context);
            promise.run();
        }, 0);
        return promise;
    };

    getDictionary = function (callback) {
        var args = Array.prototype.slice.call(arguments, 0).slice(1);
        if (dictionary) {
            callback.apply(self, args);
        } else {
            sendRequest({id: "getDictionary"}).then(function (response) {

                // Store the dictionary for later use.
                dictionary = response;
                callback.apply(self, args);
            });
        }
    };

    sendRequest = function (kwargs) {
        var promise = new Promise();
        chrome.extension.sendRequest(kwargs, promise.run);
        return promise;
    };

    replaceText = function (textNode) {
        var i = 0,
            replacements = dictionary.replacements,
            v = textNode.nodeValue,
            matchFound = false,
            regex,
            original,
            replacement;  // replace multiple continuous spaces;

        for (i = 0; i < replacements.length; i++) {
            original = replacements[i][0];
            replacement = replacements[i][1];
            regex = replacements[i][2];

            if (regex === undefined) {
                if (original instanceof RegExp) {
                    // regex mode
                    regex = original;
                } else if (original.length && original[0] === '/') {
                    // regex mode (build)
                    regex = new RegExp(original.substring(1, original.length - 1), 'g');
                    dictionary.replacements[i][0] = regex;
                } else {
                    // string mode
                    original = original.replace(regexForQuestionMark, "\\?");
                    original = original.replace(regexForPeriod, "\\.");
                    original = original.replace(regexForSpace, "(?:\\s|&nbsp;)+");
                    regex = new RegExp('\\b' + original + '\\b', "g");
                }
                // cache compiled regexes
                replacements[i][2] = regex;
            }

            if ((v.indexOf(original) > -1) || v.match(regex)) {
                v = v.replace(regex, replacement);
                matchFound = true;
            }
        }

        // Only change the node if there was any actual text change
        if (matchFound) {
            window.console.debug(textNode.nodeValue + ' --> ' + v);
            textNode.nodeValue = v;
        }
    };

    /**
     * Original reference http://is.gd/mwZp7E
     * @param node
     */
    walk = function (node) {
        var child, next;

        switch (node.nodeType) {
        case 1:  // Element
        case 9:  // Document
        case 11: // Document fragment
            child = node.firstChild;
            while (child) {
                next = child.nextSibling;
                walk(child);
                child = next;
            }
            break;
        case 3: // Text node
            replaceText(node);
            break;
        default:
            // all other cases are unhandled (but allowed)
            // throw ("Unexpected case");
        }
    };

    // Function that calls walk() but makes sure that it only is called once
    // the first call has finished. Any changes that we make to the DOM in walk()
    // will trigger DOMSubtreeModified, so we handle this by using the running flag
    work = function () {
        // Set running to true to prevent more calls until the first one is done
        running = true;

        // Go through the DOM
        window.requestAnimationFrame(function () {
            walk(document.body);
        });

        // Set running to false to allow additional calls
        running = false;
    };

    sendRequest({id: 'isPaused?'})
        .then(function (response) {
            var isPaused = response.value;

            // If the extension is paused, no need to try to call getExcluded
            if (isPaused) {
                throw("Poop");
            }
        }).then(function (response) {
            sendRequest({id: 'getExcluded'})
                .then(function (response) {
                    var idx,
                        excludedUrl,
                        excludedUrls = response.value;  /* [""], iterated using obj notation for some reason */
                    for (idx in excludedUrls) {
                        if (excludedUrls.hasOwnProperty(idx)) {
                            excludedUrl = excludedUrls[idx];
                            if (!excludedUrl) {
                                continue;
                            }
                            if (window.location.href.indexOf(excludedUrl) !== -1) {
                                return;
                            }
                        }
                    }

                    getDictionary(function () {
                        work();
                    });
                });
        });

    document.addEventListener('DOMSubtreeModified', function () {
        // effectively, throttle()
        if (running) {
            return;
        }

        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(work, 500);
    }, false);

}(this));
