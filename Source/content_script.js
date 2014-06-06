/*global chrome*/
(function (self) {
    "use strict";
    var dictionary;

    function getDictionary(callback) {
        var args = arguments.slice(1);
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
            throw ("Unexpected case");
        }
    }

    chrome.extension.sendRequest({id: 'isPaused?'}, function (response) {
        var isPaused = response.value;

        // If the extension is paused, no need to try to call getExcluded
        if (isPaused) {
            return;
        }

        chrome.extension.sendRequest({id: 'getExcluded'}, function (r2) {

            var ex = r2.value;
            for (var x in ex) {
                if (window.location.href.indexOf(ex[x]) != -1) {
                    return;
                }
            }

            getDictionary(function () {
                work();
            });
        });

    });

    /**
     * Every time the resultant function is called while it's already running,
     * reset the timeout. Otherwise, run the function after so many ms.
     */
    var throttle = function (fn, after) {
        var timeout,
            running = false,  // keeps state
            context = this,
            inspect = function () {
                var wrapper = function () {
                    running = true;
                    var result = fn.apply(context, arguments);

                    // "done"
                    running = false;
                    timeout = undefined;

                    return result;
                };

                if (running) {
                    // uncomment this for debounce
                    /*
                     clearTimeout(timeout);
                     timeout = setTimeout(inspect, after);
                     */
                } else if (timeout) {
                    clearTimeout(timeout);
                    timeout = setTimeout(wrapper, after);
                } else {
                    timeout = setTimeout(wrapper, after);
                }
            };

        return inspect;
    };

    document.addEventListener('DOMSubtreeModified', throttle(walk), false);

}(this));
