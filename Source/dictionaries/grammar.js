var dictionary = {
    "replacements": {
        "a art" : "an art",
        "affect." : "effect.",
        "affective " : "effective ",
        "alot" : "a lot",
        "could care less" : "couldn't care less",
        "could of" : "could have",
        "definately" : "definitely",
        "doggy dog" : "dog eat dog",
        "imbicile" : "imbecile",
        "ironic" : "coincidental",  // because _|_ you, that's why
        "irregardless" : "regardless",
        "lets" : "let's",
        "moo point" : "moot point",
        "nauseous" : "nauseated",
        "seperate" : "separate",
        "should of" : "should have",
        "would of" : "would have"
    },

    "expressions": {
        "\\bless th[ae]n (\\d+ \\w+s)": "fewer than $2",
        "\\b(\\w+)-ass (\\w+)": "$1 ass-$2",
        "\\b([Tt])here were": "$1here were",
        "\\b^([Mm])e and my (\\w+)": "My $2 and I",
        "\\b^loose the": "lose the"
    }
};
