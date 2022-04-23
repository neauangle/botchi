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
import * as Prompt from './prompt.js';
import * as Waiting from './waiting.js';

const backends = {};

export const EVENTS = {
    TRACKER_ADDED: 'TRACKER_ADDED',
    TRACKER_TYPE_CHANGED: 'TRACKER_TYPE_CHANGED'
}


const frame = document.getElementById("add-tracker-frame");
const modal = document.getElementById("add-tracker-modal");
const trackerTypeInput = document.getElementById('add-tracker-tracker-type-input');
const backendSection = document.getElementById('add-tracker-backend-section');
const addTrackerButton = document.getElementById("add-tracker-add-button");
const cancelButton = document.getElementById("add-tracker-cancel-button");


export async function init(backendInfos, lastTrackerType){
    for (let i = 0; i < backendInfos.length; ++i){
        const backendInfo = backendInfos[i];
        backends[backendInfo.name] = {
            index: i,
            addTrackerSubmodule: await backendInfo.frontend.createAddTrackerSubmodule(i, backendSection),
            //reference, so no need to update when new token added- app.js already does that
            info: backendInfo,
            name: backendInfo.name
        }
        trackerTypeInput.appendChild(Templates.getTrackerTypeOption(backendInfo.name));
        if (backendInfo.name === lastTrackerType){
            trackerTypeInput.value = backendInfo.name;
        }
        addTrackerButton.disabled = true;
        backendSection.lastChild.classList.add('add-tracker-backend-section-form');
        backends[backendInfo.name].info.frontend.emitter.addEventListener('updatedDisableds', e => {
            addTrackerButton.disabled = e.data.addTrackerButtonShouldBeDisabled;
        })
    }
}

function resetForm(){
    for (const backend of Object.values(backends)){
        if (backend.name === trackerTypeInput.value){
            backend.addTrackerSubmodule.addTrackerForm.dom.style.display = 'grid'
            backend.addTrackerSubmodule.addTrackerForm.refresh();
        } else {
            backend.addTrackerSubmodule.addTrackerForm.dom.style.display = 'none'
        }
    }
}


trackerTypeInput.addEventListener('input', e => {
    emitter.emitEvent(EVENTS.TRACKER_TYPE_CHANGED, {trackerType: trackerTypeInput.value});
    resetForm();
});


cancelButton.addEventListener('click', () => {
    hide();
})



export function show(){
    frame.style.display = 'flex';
    resetForm();
}
export function hide(){
    frame.style.display = 'none';
}

modal.addEventListener("mousedown", ev => {
    ev.stopPropagation();
})

frame.addEventListener("mousedown", ev => {
    hide();
})


addTrackerButton.addEventListener('click', async () => {
    //general callback in app.js will handle updating waiting message
    const backend = backends[trackerTypeInput.value];
    const args = backend.addTrackerSubmodule.addTrackerForm.getArgs();
    addTracker(backend.index, args, true);
});

export async function addTracker(backendIndex, args, useUI){
    let backend;
    for (const backendInfo of Object.values(backends)){
        if (backendInfo.index === backendIndex){
            backend = backendInfo;
            break;
        }
    }
    let tracker;
    if (useUI){
        Waiting.startWaiting();
    }
    try {
        args.useUI = useUI;
        tracker = await window.bridge.callBackendFunction(backendIndex, 'addTracker', args);
        if (useUI){
            Waiting.stopWaiting();
        }
    } catch (error){
        console.log(`Error adding tracker: ${error}`);
        if (useUI){
            Waiting.stopWaiting();
            await Prompt.showMessage({title: `Error`, message: `Error adding tracker: ${error}`});
        } else {
            throw error;
        }
        return null;
    }
    if (tracker){
        if (!backend.info.trackers[tracker.id]){
            emitter.emitEvent(EVENTS.TRACKER_ADDED, {backendIndex: backend.index, tracker});
            if (useUI){
                await Prompt.showMessage({title: `Pair Added!`, message: `${tracker.name}`});
            }
        } else {
            if (useUI){
                await Prompt.showMessage({title: `Pair Already Exists!`, message: `${tracker.name}`});
            }
        }
        if (useUI){
            hide();
        }
        return tracker;
    } else {
        return null;
    }
}
