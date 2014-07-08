/*global chrome*/
(function (self) {
    "use strict";
    var dictionary,
        timeout = null,
        running = true;

    function getDictionary(callback) {
        var args = Array.prototype.slice.call(arguments, 0).slice(1);
        chrome.extension.sendRequest({id: "getDictionary"}, function (response) {
            dictionary = response; // Store the dictionary for later use.
            callback.apply(self, args);
        });
    }

    function handleText(textNode) {
        var replacements = dictionary.replacements,
            expressions = dictionary.expressions,
            v = textNode.nodeValue,
            matchFound = false,
            regex,
            original,
            original_escaped,
            regex_for_question_mark,
            regex_for_period;

        //text replacements
        for (original in replacements) {
            if (replacements.hasOwnProperty(original)) {
                original_escaped = original;

                regex_for_question_mark = /\?/g;
                regex_for_period = /\./g;

                original_escaped = original_escaped.replace(regex_for_question_mark, "\\?");
                original_escaped = original_escaped.replace(regex_for_period, "\\.");

                regex = new RegExp('\\b' + original_escaped + '\\b', "gi");
                if (v.match(regex)) {
                    v = v.replace(regex, replacements[original]);
                    matchFound = true;
                }
            }
        }

        // regex replacements
        for (original in expressions) {
            if (expressions.hasOwnProperty(original)) {
                regex = new RegExp(original, "g");
                if (v.match(regex)) {
                    v = v.replace(regex, expressions[original]);
                    matchFound = true;
                }
            }
        }

        // Only change the node if there was any actual text change
        if (matchFound) {
            textNode.nodeValue = v;
        }

    }

    /**
     * Original reference http://is.gd/mwZp7E
     * @param node
     */
    function walk(node) {
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
            handleText(node);
            break;
        default:
            // all other cases are unhandled (but allowed)
            // throw ("Unexpected case");
        }
    }

    // Function that calls walk() but makes sure that it only is called once
    // the first call has finished. Any changes that we make to the DOM in walk()
    // will trigger DOMSubtreeModified, so we handle this by using the running flag
    function work() {
        // Set running to true to prevent more calls until the first one is done
        running = true;

        // Go through the DOM
        walk(document.body);

        // Set running to false to allow additional calls
        running = false;
    }

    chrome.extension.sendRequest({id: 'isPaused?'}, function (response) {
        var isPaused = response.value;

        // If the extension is paused, no need to try to call getExcluded
        if (isPaused) {
            return;
        }

        chrome.extension.sendRequest({id: 'getExcluded'}, function (response) {

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

    // Add an eventlistener for changes to the DOM, e.g. new content has been loaded via AJAX or similar
    // Any changes that we do to the DOM will trigger this event, so we need to prevent infinite looping
    // by checking the running flag first. 
    document.addEventListener('DOMSubtreeModified', function () {
        if (running) {
            return;
        }

        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(work, 500);
    }, false);

}(this));
