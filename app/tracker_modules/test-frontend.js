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

import * as Emitter from  '../frontend/js/event-emitter.js'; const emitter = Emitter.instance(); export {emitter};


export function attachTrackerDetailsElement(parent){
    parent.innerHTML = '';
}


export async function createAddTrackerSubmodule(backendId, formParent){
    const HTML_FORM = `
    <div>
        <label id="add-tracker-test-comparator-per-fiat">Comparator Per Fiat: </label>
        <input id="add-tracker-test-comparator-per-fiat-input" type="text" placeholder="Comparator per fiat"/>
        <div></div>
    </div>
    `

    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = HTML_FORM;
    const dom = dummyParent.firstElementChild;
    formParent.appendChild(dom);
    
    const comparatorPerFiatInput = document.getElementById("add-tracker-test-comparator-per-fiat-input");

    const addTrackerForm = {
        dom
    };

    addTrackerForm.refresh = async function(){
        comparatorPerFiatInput.value = '1';
        updateDisableds();
    }

    addTrackerForm.getArgs = function(){
        return {comparatorPerFiat: Number(comparatorPerFiatInput.value)};
    }

    comparatorPerFiatInput.addEventListener('input', updateDisableds);

    function updateDisableds(){
        const focussedElement = document.activeElement;
        let okayToTryAdd = false;
        if (Number(comparatorPerFiatInput.value) && Number(comparatorPerFiatInput.value).toString() === comparatorPerFiatInput.value){
            okayToTryAdd = true;
        }

        if (focussedElement && !focussedElement.disabled){
            focussedElement.focus();
        }

        emitter.emitEvent('updatedDisableds', {addTrackerButtonShouldBeDisabled: !okayToTryAdd})
    }


    return {emitter, addTrackerForm};

        
}

    





