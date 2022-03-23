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

import * as Prompt from '../frontend/js/prompt.js';
import * as Waiting from '../frontend/js/waiting.js';
import * as Util from '../frontend/js/util.js';
import {getOption} from '../frontend/js/templates.js';
import * as Emitter from  '../frontend/js/event-emitter.js'; const emitter = Emitter.instance(); export {emitter};






export async function createAddTrackerSubmodule(name, backendId, formParent){
    const htmlFormString = `
        <div>
            <label id="add-tracker-${name}-api-label">API Key: </label>
            <select name="add-tracker-${name}-api-input" id="add-tracker-${name}-api-input"></select> 
            <button id="add-tracker-${name}-new-api-button">Manage</button>

            <label id="add-tracker-${name}-token-symbol-label">Token Symbol: </label>
            <input id="add-tracker-${name}-token-symbol-input" type="text" placeholder="Base asset"/>
            <div></div>

            <label id="add-tracker-${name}-comparator-symbol-label">Comparator Symbol: </label>
            <input id="add-tracker-${name}-comparator-symbol-input" type="text" placeholder="Quote asset"/>
            <div></div>

            <label id="add-tracker-${name}-comparator-is-fiat-label">Comparator is Fiat: </label>
            <input id="add-tracker-${name}-comparator-is-fiat-input" type="checkbox"/>
            <div></div>
        </div>
`
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = htmlFormString;
    const dom = dummyParent.firstElementChild;
    formParent.appendChild(dom);
    
    const apiEntryInput = document.getElementById(`add-tracker-${name}-api-input`);
    const manageApiEntriesButton = document.getElementById(`add-tracker-${name}-new-api-button`);

    const tokenSymbolInput = document.getElementById(`add-tracker-${name}-token-symbol-input`);
    const comparatorSymbolInput = document.getElementById(`add-tracker-${name}-comparator-symbol-input`);

    const comparatorIsFiatInput = document.getElementById(`add-tracker-${name}-comparator-is-fiat-input`);

    const addTrackerForm = {
        dom
    };

    let apiEntries;

    async function resetApiEntries(lastSelectedApiId){
        apiEntryInput.innerHTML = '';
        apiEntries = await window.bridge.callBackendFunction(backendId, 'getApiEntries');
        Util.sortArrayOfObjectsOnProperty({array: apiEntries, property: "name", caseSensitive: false});
        for (let i = 0; i < apiEntries.length; ++i){
            apiEntryInput.appendChild(getOption(i, `${apiEntries[i].name}`));
            if (lastSelectedApiId !== undefined && apiEntries[i].id === lastSelectedApiId){
                apiEntryInput.value = i;
            }
        }
        updateDisableds();
    }
    
    addTrackerForm.refresh = async function(){
        if (!comparatorSymbolInput.value){
            comparatorSymbolInput.value = 'USDT';
            comparatorIsFiatInput.checked = true;
        }
        resetApiEntries(apiEntries && apiEntries[apiEntryInput.value] ? apiEntries[apiEntryInput.value].id : undefined);
    }

    
    addTrackerForm.getArgs = function(){
        const apiId = apiEntries[apiEntryInput.value].id;
        const tokenSymbol = tokenSymbolInput.value;
        const comparatorSymbol = comparatorSymbolInput.value;
        const comparatorIsFiat = comparatorIsFiatInput.checked;
        return {type: "TRACKER", tokenSymbol, comparatorSymbol, apiId, comparatorIsFiat};
    }

    function checkNonEmptyTrimmed(value){
        const trimmed = value.trim();
        return {valid: !!trimmed, cleaned: trimmed};
    }

    //inputInfos = [{label, placeholder, key, test},...]
    //test is a function (string) => {valid: boolean, cleaned: string}
    const keyToSelectInfo = {
        API: {
            title: 'Manage Binance APIs',
            inputInfos: [
                {label: 'API Key', key: "key", placeholder: "", type: 'password', test: checkNonEmptyTrimmed},
            ]
        },
    }

    
    async function manageApiEntries(type){
        const input = apiEntryInput;
        const nodes = apiEntries;
        const selectedItemBefore = nodes[input.value] ? nodes[input.value].name : null;
        
        const nonEditableItems = [];
        let nonEditableNodes = await window.bridge.callBackendFunction(backendId, 'getAPIsWithTrackers');
        for (const node of nonEditableNodes){
            nonEditableItems.push(node.name);
        }
        
        const database = {};
        for (const node of nodes){
            database[node.name] = node
        }

        const databaseStringBefore = JSON.stringify(database);

        const title = keyToSelectInfo[type].title;
        const inputInfos = keyToSelectInfo[type].inputInfos;
        const {lastSelectedItem, cancelled} = await Prompt.showSelectManager({
            title, inputInfos, database, 
            selectedItem: selectedItemBefore,
            nonEditableItems
        });
        if (cancelled){
            return;
        }
        const databaseBefore = JSON.parse(databaseStringBefore);
        const lastSelectedInfo = database[lastSelectedItem];

        const removed = [];
        const edited = [];
        for (const itemNameBefore of Object.keys(databaseBefore)){
            if (!database[itemNameBefore]){
                removed.push(databaseBefore[itemNameBefore]);
            } else {
                const oldApi = databaseBefore[itemNameBefore];
                const newapi = database[itemNameBefore];
                for (const oldNodevalueKey of Object.keys(oldApi)){
                    if (!newapi[oldNodevalueKey]){
                        newapi[oldNodevalueKey] = oldApi[oldNodevalueKey];
                    } else if (newapi[oldNodevalueKey] !== oldApi[oldNodevalueKey]){
                        if (!edited.includes(newapi)){
                            edited.push(newapi);
                        }
                    }
                }
            }
        }
        const added = [];
        for (const itemNameAfter of Object.keys(database)){
            if (!databaseBefore[itemNameAfter]){
                database[itemNameAfter].name = itemNameAfter;
                database[itemNameAfter].type = type; 
                added.push(database[itemNameAfter]);
            }
        }

        if (added.length || edited.keys.length || removed.length){
            Waiting.startWaiting(`Updating database...`);
            try {
                const {success, error, addedInfos} = await window.bridge.callBackendFunction(backendId, 'updateDatabase', {added, edited, removed});
                if (!success){
                    console.log('Error updating database: ' + error);
                    throw 'Error updating database';
                }
                for (const node of addedInfos){
                    if (lastSelectedInfo && lastSelectedInfo.name === node.name){
                        lastSelectedInfo.id = node.id;
                        break;
                    }
                }
                resetApiEntries(lastSelectedInfo ? lastSelectedInfo.id : undefined);
                Waiting.stopWaiting();
                Prompt.showMessage({title: "Success!", message: `Updated ${type.toLowerCase()} database`});
            } catch (error){
                console.log(error);
                Waiting.stopWaiting();
                Prompt.showMessage({title: "Error", message: `Error occured updating ${type.toLowerCase()} database`});
            }
        } else {
            if (lastSelectedInfo){
                for (let i = 0; i < apiEntries.length; ++i){
                    if (apiEntries[i].id === lastSelectedInfo.id){
                        apiEntryInput.value = i;
                        break;
                    }
                }
                
            }
        }
    }


    manageApiEntriesButton.addEventListener("click", () => {manageApiEntries("API")});
    comparatorIsFiatInput.addEventListener('change', updateDisableds);
    tokenSymbolInput.addEventListener('input', (e) => {e.target.value = e.target.value.toUpperCase(); updateDisableds();});
    comparatorSymbolInput.addEventListener('input', (e) => {e.target.value = e.target.value.toUpperCase(); updateDisableds();});
    
    function updateDisableds(){
        const focussedElement = document.activeElement;
        let okayToTryAdd = true;
        
        if (!apiEntryInput.children.length){
            okayToTryAdd = false;
        }

        if (!tokenSymbolInput.value.length){
            okayToTryAdd = false;
        } 

        if (!comparatorSymbolInput.value.length){
            okayToTryAdd = false;
        } 

        if (focussedElement && !focussedElement.disabled){
            focussedElement.focus();
        }

        emitter.emitEvent('updatedDisableds', {addTrackerButtonShouldBeDisabled: !okayToTryAdd})
    }


    return {emitter, addTrackerForm};

        
}

    





