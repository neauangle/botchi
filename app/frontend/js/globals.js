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

import * as Templates from './templates.js';
import * as Util from './util.js';

const frame = document.getElementById("globals-frame");
const modal = document.getElementById('globals-modal');
const inputsContainer = document.getElementById("globals-inputs-container");
const okButton = document.getElementById("globals-ok-button");
const generatorName = inputsContainer.children[0];
const generatorValue = inputsContainer.children[1];
const generatorAction = inputsContainer.children[2];
generatorAction.disabled = true;

export const VARIABLE_NAME_REGEX = /^[a-zA-Z][_a-zA-Z0-9]*$/i; 


let globals = {};
const nameToElements = {};

export function init(pGlobals){
    for (const name of Object.keys(pGlobals)){
        addGlobal(name, pGlobals[name], false);
    }
}

/* export function getGlobals(){
    return globals;
} */

export function setGlobal(name, value){
    if (globals[name] === undefined){
        throw "Global variable does not exist: " + name;
    }
    globals[name] = value;
    nameToElements[name].valueElement.value =  value;
    window.bridge.saveGlobals(globals);
}

export function getGlobal(name){
    if (globals[name] === undefined){
        throw "Global variable does not exist: " + name;
    }
    return globals[name];
}

export function globalExists(name){
    return globals[name] !== undefined;
}


generatorName.addEventListener('input', checkGeneratorName);
function checkGeneratorName() {
    if (!generatorName.value){
        generatorName.classList.remove('input-invalid');
        generatorAction.disabled = true;
    } else if (Object.keys(globals).includes(generatorName.value) || !VARIABLE_NAME_REGEX.test(generatorName.value)){
        generatorName.classList.add('input-invalid');
        generatorAction.disabled = true;
    } else {
        generatorName.classList.remove('input-invalid');
        generatorAction.disabled = false;
    }
}


function removeGlobal(name){
    const {nameLabelElement, nameInputElement, valueElement, actionElement} = nameToElements[name];
    Util.removeElementSafe(nameLabelElement);
    Util.removeElementSafe(valueElement);
    Util.removeElementSafe(actionElement);
    Util.removeElementSafe(nameInputElement);
    delete globals[name];
    delete nameToElements[name];
    checkGeneratorName();
}


generatorAction.addEventListener('click', () => addGlobal(generatorName.value, generatorValue.value, true))
function addGlobal(name, value, save, moveBeforeElement){
    if (!moveBeforeElement){
        moveBeforeElement = generatorName;
    }
    generatorName.value = "";
    generatorValue.value = "";
    checkGeneratorName();
    const {nameLabelElement, nameInputElement, valueElement, actionElement} = Templates.getGlobalsRow(name, value);
    inputsContainer.insertBefore(nameInputElement, moveBeforeElement);
    inputsContainer.insertBefore(nameLabelElement, moveBeforeElement);
    inputsContainer.insertBefore(valueElement, moveBeforeElement);
    inputsContainer.insertBefore(actionElement, moveBeforeElement);
    actionElement.addEventListener('click', () => {
        removeGlobal(name);
    });
    nameInputElement.addEventListener("focusout", () => {
        nameToElements[name].nameLabelElement.style.display = 'block';
        nameToElements[name].nameInputElement.style.display = 'none';
    });
    nameLabelElement.addEventListener('click', () => {
        nameToElements[name].nameLabelElement.style.display = 'none';
        nameToElements[name].nameInputElement.style.display = 'block';
        nameToElements[name].nameInputElement.value = name;
        nameInputElement.classList.remove('input-invalid');
        nameToElements[name].nameInputElement.focus();
    });
    nameInputElement.addEventListener('input', event => {
        if (!nameInputElement.value 
        || Object.keys(globals).includes(nameInputElement.value) && nameInputElement.value !== name
        || !VARIABLE_NAME_REGEX.test(nameInputElement.value)){
            nameInputElement.classList.add('input-invalid');
        } else {
            nameInputElement.classList.remove('input-invalid');
            generatorAction.disabled = false;
        }
    });
    nameInputElement.addEventListener('keydown', async ev => {
        if (ev.key === 'Enter'){
            if (!nameInputElement.classList.contains('input-invalid')){
                if (nameInputElement.value !== name){
                    globals = Object.fromEntries(//https://stackoverflow.com/a/68571997
                        Object.entries(globals).map(([oldKey, oldValue]) => {
                            return oldKey === name ? [nameInputElement.value, oldValue] : [oldKey, oldValue];
                        })
                    );
                    nameLabelElement.innerText = '$g.'+nameInputElement.value;
                    nameToElements[name].nameLabelElement.style.display = 'block';
                    nameToElements[name].nameInputElement.style.display = 'none';
                    nameToElements[nameInputElement.value] = nameToElements[name];
                    delete nameToElements[name];
                    name = nameInputElement.value;
                    window.bridge.saveGlobals(globals);
                } else {
                    nameToElements[name].nameLabelElement.style.display = 'block';
                    nameToElements[name].nameInputElement.style.display = 'none';
                    nameToElements[nameInputElement.value] = nameToElements[name];
                }
            }
        } 
    });
    valueElement.addEventListener('change', () => {
        setGlobal(name, valueElement.value);
    })
    globals[name] = value;
    nameToElements[name] = {nameLabelElement, nameInputElement, valueElement, actionElement};
    if (save){
        setGlobal(name, globals[name]);
    }
    
    (async () => {
        await Util.wait(10);
        inputsContainer.scrollTop = inputsContainer.scrollHeight;
    })();
}

export async function show(){
    frame.style.display = 'flex';   
    return makePromise();
}


function makePromise(){
    return new Promise(function (resolve, reject) {
        const okay = function(ev){
            if (okButton.disabled){
                return;
            }
            if (!ev.key || ev.key === 'Escape'){
                frame.style.display = 'none';
                resolve();
                document.removeEventListener('keyup', okay);
            } 
        }
        document.addEventListener('keyup', okay);
        frame.addEventListener("mousedown", event => {
            if (!okButton.disabled && !event.target.closest('.shaded-panel')){
                okay({ev: {key:'Escape'}});
            }
        }); 

        okButton.addEventListener("click", okay, {once: true});
    });
}

