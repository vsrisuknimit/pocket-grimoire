import Store from "../classes/Store.js";
import Observer from "../classes/Observer.js";
import TokenStore from "../classes/TokenStore.js";
import Bluffs from "../classes/Bluffs.js";
import {
    empty,
    lookup,
    lookupOne,
    lookupOneCached,
    announceInput
} from "../utils/elements.js";

const store = Store.create("pocket-grimoire");
const gameObserver = Observer.create("game");
const tokenObserver = Observer.create("token");

const padElement = lookupOneCached(".js--pad");
const pad = padElement.pad;

gameObserver.on("characters-selected", ({ detail }) => {

    store.setCharacters(
        detail.name,
        detail.characters.map((character) => character.getId())
    );
    store.removeStaleInputs();

});

gameObserver.on("pad-height-change", ({ detail }) => {
    store.setHeight(detail.height);
});

tokenObserver.on("character-add", ({ detail }) => {
    store.addToken(detail.character);
});

tokenObserver.on("character-remove", ({ detail }) => {
    store.removeToken(detail.character);
});

tokenObserver.on("reminder-add", ({ detail }) => {
    store.addToken(detail.reminder);
});

tokenObserver.on("reminder-remove", ({ detail }) => {
    store.removeToken(detail.reminder);
});

tokenObserver.on("move", ({ detail }) => {

    const {
        element,
        left,
        top,
        zIndex
    } = detail;
    const token = (
        pad.getCharacterByToken(element)
        || pad.getReminderByToken(element)
    );

    store.moveToken(token, left, top, zIndex);

});

tokenObserver.on("zindex", ({ detail }) => {

    const {
        element,
        zIndex
    } = detail;
    const token = (
        pad.getCharacterByToken(element)
        || pad.getReminderByToken(element)
    );

    store.alignToken(token, zIndex);

});

tokenObserver.on("shroud-toggle", ({ detail }) => {
    store.toggleDead(pad.getCharacterByToken(detail.token), detail.isDead);
});

tokenObserver.on("rotate-toggle", ({ detail }) => {
    store.rotate(pad.getCharacterByToken(detail.token), detail.isUpsideDown);
});

tokenObserver.on("bluff", ({ detail }) => {
    store.setBluff(detail.button, detail.character);
});

const {
    body
} = document;

body.addEventListener("input", ({ target }) => {
    store.saveInput(target.closest("input"));
});

body.addEventListener("toggle", ({ target }) => {
    store.saveDetails(target.closest("details"));
}, {
    capture: true
});

const storeData = store.read();

TokenStore.ready(({
    characters,
    reminders
}) => {

    // Re-select the characters.

    const info = storeData.characters;

    if (info && info.characters && info.characters.length) {

        gameObserver.trigger("characters-selected", {
            name: info.name,
            characters: info.characters
                .map((id) => characters[id])
                .filter(Boolean)
        });

    }

    // Re-place the tokens.

    let finalZIndex = 0;

    storeData.tokens.forEach(({
        id,
        left,
        top,
        zIndex,
        isDead,
        isUpsideDown
    }) => {

        const isCharacter = TokenStore.isCharacterId(id);
        const info = (
            isCharacter
            ? pad.addCharacter(characters[id])
            : pad.addReminder(reminders[id])
        );

        pad.moveToken(info.token, left, top, zIndex);

        if (isCharacter) {

            pad.toggleDead(info.character, Boolean(isDead));
            pad.rotate(info.character, Boolean(isUpsideDown));

        }

        if (zIndex > finalZIndex) {
            finalZIndex = zIndex;
        }

    });

    pad.setZIndex(finalZIndex);

    // Re-set the bluffs.

    Object.entries(storeData.bluffs).forEach(([selector, characterId]) => {

        // const button = lookupOne(selector);
        const character = characters[characterId];

        // if (!button || !character) {
        if (!character || !Bluffs.instance) {
            return;
        }

        // empty(button).append(character.drawToken());
        Bluffs.instance.display(selector, character);

    });

    // Re-populate the inputs.

    Object.entries(storeData.inputs).forEach(([selector, value]) => {

        const inputs = lookup(selector);

        const type = inputs[0]?.type;
        const isRadio = type === "radio";
        const input = (
            isRadio
            ? inputs.find((input) => input.value === value)
            : inputs[0]
        );

        if (!input) {
            return;
        }

        if (isRadio) {
            input.checked = true;
        } else if (type === "checkbox") {
            input.checked = value;
        } else {
            input.value = value;
        }

        announceInput(input);

    });

    // Re-open or re-close the details.

    Object.entries(storeData.details).forEach(([selector, isOpen]) => {

        const details = lookupOne(selector);

        if (!details) {
            return;
        }

        const isOpenNow = details.hasAttribute("open");
        details.open = isOpen;

        if (isOpenNow !== isOpen) {

            details.dispatchEvent(new Event("toggle", {
                bubbles: false
            }));

        }

    });

    // Re-set the height of the pad.
    // CSS `resize` works by changing the `height` style on the element itself
    // which is why we're setting it like this instead of setting a CSS custom
    // property and referring to it in the style sheet.

    if (storeData.height) {
        padElement.style.height = storeData.height;
    }

});

// TODO: Scroll amount?
