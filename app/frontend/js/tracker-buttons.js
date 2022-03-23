/*
Copyright (C) 2022 https://github.com/neauangle (neauangle@protonmail.com)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import * as Emitter from  './event-emitter.js'; const emitter = Emitter.instance(); export {emitter};
import * as Templates from './templates.js';
import * as ContextMenu from './context-menu.js';
import * as Util from './util.js';

export const EVENTS = {
    ORDER_UPDATED: "ORDER_UPDATED",
    TRACKER_SELECTED: "TRACKER_SELECTED",
    USER_SELECTED_ACTIVATE_TRACKER: "USER_SELECTED_ACTIVATE_TRACKER",
    USER_SELECTED_DEACTIVATE_TRACKER: "USER_SELECTED_DEACTIVATE_TRACKER",
    USER_SELECTED_REMOVE_TRACKER: "USER_SELECTED_REMOVE_TRACKER",
    MANUAL_PRICE_INPUT: "MANUAL_PRICE_INPUT",

}

const trackerButtonsFilterInput = document.getElementById('tracker-buttons-filter-input');
trackerButtonsFilterInput.addEventListener('mouseup', ev => {
    trackerButtonsFilterInput.select();
});
trackerButtonsFilterInput.addEventListener('input', ev => {
    const filterUpperCase = trackerButtonsFilterInput.value.trim().toUpperCase();
    for (const button of trackerButtonsContainer.children){
        if (!filterUpperCase){
            button.classList.remove('hidden');
        } else {
            const tracker = buttonToInfoMap.get(button).tracker;
            const searchstring = (tracker.tokenSymbol + tracker.backendName + tracker.fullName).toUpperCase();
            if (!searchstring.includes(filterUpperCase)){
                button.classList.add('hidden');
            } else {
                button.classList.remove('hidden');
            }
        }
    }
})
const trackerButtonsContainer = document.getElementById('tracker-buttons');
let dragAndDropLine;

//normal objects don't work with dom elements as keys
const buttonToInfoMap = new Map();

let isDraggingTrackerButton = false;


export function update(tracker){
    if (tracker.comparatorIsFiat){
        const f = `= $${Util.locale(Util.roundAccurately(tracker.mostRecentPrice.fiat, 10))}`;
        tracker.button.getElementsByClassName("tracker-button-price-comparator")[0].style.display = 'none';
        tracker.button.getElementsByClassName("tracker-button-price-fiat")[0].innerText = f;
    } else {
        const c = `= ${Util.locale(Util.roundAccurately(tracker.mostRecentPrice.comparator, 10))}`
        tracker.button.getElementsByClassName("tracker-button-price-comparator")[0].style.display = 'grid';
        tracker.button.getElementsByClassName("tracker-button-price-comparator-amount")[0].innerText = c;
        if (tracker.mostRecentPrice.fiat){
            const f = `= $${Util.locale(Util.roundAccurately(tracker.mostRecentPrice.fiat, 10))}`;
            tracker.button.getElementsByClassName("tracker-button-price-fiat")[0].style.display = 'block';
            tracker.button.getElementsByClassName("tracker-button-price-fiat")[0].innerText = f;
        } else {
            tracker.button.getElementsByClassName("tracker-button-price-fiat")[0].style.display = 'none';
        }

    }
}

export function getTrackerButton(tracker){
    for (const button of buttonToInfoMap.keys()){
        if (tracker === buttonToInfoMap.get(button).tracker){
            return button;
        }
    }
}

export function moveButtonToBeLastActive(button){
    let buttonToGoAfter = trackerButtonsContainer.lastChild;
    for (let i = trackerButtonsContainer.children.length-1; i >=0; --i){
        const child = trackerButtonsContainer.children[i];
        const tracker = buttonToInfoMap.get(child).tracker;
        if (tracker.isActive){
            buttonToGoAfter = child;
            break;
        }
    }
    if (!buttonToGoAfter){
        trackerButtonsContainer.appendChild(button);
    } else {
        trackerButtonsContainer.insertBefore(button, buttonToGoAfter.nextElementSibling);
    }
    
    const trackerUriStringsInOrder = [];
    for (const b of trackerButtonsContainer.children){
        if (buttonToInfoMap.has(b)){
            trackerUriStringsInOrder.push(buttonToInfoMap.get(b).tracker.uriString);
        }
    }
    emitter.emitEvent(EVENTS.ORDER_UPDATED, {trackerUriStringsInOrder});
}

export function addButton(backendType, tracker){
    const button = createButton(backendType, tracker);
    tracker.button = button;
    buttonToInfoMap.set(button, {tracker});

    if (tracker.isActive){
        button.classList.add('active');
    }
    if (!tracker.tokenSymbol.toUpperCase().includes(trackerButtonsFilterInput.value.trim().toUpperCase())){
        button.classList.add('hidden');
    } else {
        button.classList.remove('hidden');
    }
    return button;
}




function createButton(backendType, tracker){
    const button = Templates.getTrackerButton(backendType, tracker); 
    trackerButtonsContainer.append(button);
    button.addEventListener('dragstart', event => {
        event.dataTransfer.setData("text/plain", tracker.uriString);
        event.dataTransfer.effectAllowed = "move";
        isDraggingTrackerButton = true;
        dragAndDropLine = Templates.getDragAndDropLine();
        trackerButtonsContainer.insertBefore(dragAndDropLine, button);
        dragAndDropLine.addEventListener('dragover', event => { event.preventDefault();});
        dragAndDropLine.addEventListener('dragenter', event => {event.preventDefault();});
    });
    button.addEventListener('dragenter', event => {
        if (!isDraggingTrackerButton){
            return;
        }
        event.preventDefault();
        trackerButtonsContainer.insertBefore(dragAndDropLine, button);
    });
    button.addEventListener('dragover', event => {
        if (!isDraggingTrackerButton){
            return;
        }
        event.preventDefault();
    });
    button.addEventListener("drop" , event => {
        const data = event.dataTransfer.getData("text/plain");
        let draggedButton;
        for (const b of buttonToInfoMap.keys()){
            if (buttonToInfoMap.get(b).tracker.uriString === data){
                draggedButton = b;
                break;
            }
        }
        if (draggedButton){
            Util.removeElementSafe(dragAndDropLine);
            dragAndDropLine = null;
            trackerButtonsContainer.insertBefore(draggedButton, button);
            const trackerUriStringsInOrder = [];
            for (const b of trackerButtonsContainer.children){
                trackerUriStringsInOrder.push(buttonToInfoMap.get(b).tracker.uriString);
            }
            emitter.emitEvent(EVENTS.ORDER_UPDATED, {trackerUriStringsInOrder});
            
        }
    });
    button.addEventListener('dragend', event => {
        isDraggingTrackerButton = false;
        if (dragAndDropLine){
            Util.removeElementSafe(dragAndDropLine);
            dragAndDropLine = null;
        }
    })

    button.addEventListener('click', () => {
        emitter.emitEvent(EVENTS.TRACKER_SELECTED, {tracker})
    });

    button.addEventListener('contextmenu', async event => {
        event.preventDefault();
        const items = [];
        if (tracker.isActive){
            items.push("Deactivate");
        } else {
            items.push("Activate");
        }
        items.push('Remove');
        const result = await ContextMenu.show(items);
        if (result === 'Remove'){
            emitter.emitEvent(EVENTS.USER_SELECTED_REMOVE_TRACKER, {tracker});
        } else if (result === "Activate"){
            emitter.emitEvent(EVENTS.USER_SELECTED_ACTIVATE_TRACKER, {tracker});
        } else if (result === "Deactivate"){
            emitter.emitEvent(EVENTS.USER_SELECTED_DEACTIVATE_TRACKER, {tracker});
        }
    });

    const manualComparatorInput = button.getElementsByClassName('tracker-button-manual-comparator-input')[0];
    const manualFiatInput = button.getElementsByClassName('tracker-button-manual-fiat-input')[0];
    if (backendType === 'test'){
        for (const input of [manualComparatorInput, manualFiatInput]){
            input.addEventListener('change', event => {
                if (Number(input.value) && Number(input.value).toString() === input.value){ 
                    const price = Number(input.value);
                    input.value = '';
                    input.focus();
                    const key = input === manualComparatorInput ? 'comparator' : 'fiat';
                    emitter.emitEvent(EVENTS.MANUAL_PRICE_INPUT, {price: {[key]: price}, tracker});
                } else {
                    input.value = 'invalid';
                    input.setSelectionRange(0, input.value.length);
                }
            });
        }
    } else {
        manualComparatorInput.style.display = 'none';
        manualFiatInput.style.display = 'none';
    }
    
    return button;
}

export function remove(tracker){
    delete buttonToInfoMap[tracker.button];
    Util.removeElementSafe(tracker.button);
}

export function activate(tracker){
    tracker.button.classList.add('active');
}
export function deactivate(tracker){
    tracker.button.classList.remove('active');
}
