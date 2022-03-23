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

import * as Floater from './floater.js';
import * as Util from './util.js';



export function getFloater(message){
    const template = `
        <div class="floater">${Util.htmlEncode(message)}</div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}

export function getContextMenuButton(itemString){
    const template = `
        <button class="context-menu-button">${Util.htmlEncode(itemString)}</button>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}

export function getInput({inputId, inputPlaceholder, inputType, labelString}){
    const label = document.createElement('label');
    label.innerText = labelString;

    const input = document.createElement('input');
    input.setAttribute('placeholder', inputPlaceholder);
    input.id = inputId;
    input.setAttribute('type', inputType === 'boolean' ? 'checkbox' : inputType);
    let eyeIcon;
    if (inputType === 'password'){
        const template = `
            <div>
                <svg class="eye-icon open" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" /></svg>
                <svg class="eye-icon closed" style="display:none;" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z" /></svg>
            </div>
        `   
        const dummyParent = document.createElement('div');
        dummyParent.innerHTML = template;
        eyeIcon = dummyParent.firstElementChild;
    }
    return {label, input, eyeIcon};
}

export function getPromptInput(placeholder){
    const template = `
        <input id="prompt-input" type="text" placeholder="${Util.htmlEncode(placeholder)}"/>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}


export function getInputBlock(message, inputVariables, okayButtonText, cancelButtonText){
    let template = `<div class="input-block">`;
        if (message){
            template += `<div class="input-block-message is-center">${Util.htmlEncode(message)}</div>`;
        }
        if (Object.keys(inputVariables).length){
            template += `<div class="input-block-inputs">`
            for (const variable of Object.keys(inputVariables)){
                template += `<label class="input-block-label">${Util.htmlEncode(variable)}: </label>`;
                template += `<input class="input-block-input" variable="${Util.htmlEncode(variable)}" type="text" value="${Util.htmlEncode(inputVariables[variable])}"/>`;
            }
            template += `</div>`;
        }
        template += `<div class="input-block-buttons">`;
            if (cancelButtonText){
                template += `<button class="input-block-button cancel-button">${Util.htmlEncode(cancelButtonText)}</button>`;
            }
            template += `<button class="input-block-button ok-button">${Util.htmlEncode(okayButtonText)}</button>`;
        template += `</div>`;
       
    template += `</div>`;

    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}










export function getOption(value, label){
    const template = `
        <option ${value === null ? "value=''" : `value="${Util.htmlEncode(value)}"`}>${Util.htmlEncode(label)}</option>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}

export function getDragAndDropLine(){
    const template = `
        <div class="drag-and-drop-line"></div>
    `   
    //this method seems to handle html quoting automatically
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}

export function getTrackerButton(type, tracker){
    //we need a container (with padding) because we need elements in the flexbox to be gapless, because
    //if there's a gap the drag-n-drop icon flashes not-allowed in the gap.
    type = tracker.intraBackendSignature ? type+'/'+tracker.intraBackendSignature : type;
    const template = `
    <div class="tracker-button-container"> 
        <div draggable="true" class="tracker-button button shaded-panel">
        <div class="tracker-button-header">
            <div class="tracker-button-smallprint">
                <div class="tracker-button-type">${Util.htmlEncode(type)}</div>
                <div class="tracker-button-uri">${Util.htmlEncode(tracker.backendIndex+'-'+tracker.id)}</div>
            </div>
            <div class="tracker-button-title">${Util.htmlEncode(tracker.tokenSymbol)}</div>
        </div>
            
            <div class="tracker-button-body">
                <div class="tracker-button-price-comparator">
                    <div class="tracker-button-price-comparator-amount">= --</div>
                    <div class="tracker-button-price-comparator-symbol">${Util.htmlEncode(tracker.comparatorSymbol)}</div>
                </div>
                <div class="tracker-button-price-fiat"></div>
                <input class="tracker-button-manual-comparator-input" type="text" placeholder="comparator"/>
                <input class="tracker-button-manual-fiat-input" type="text" placeholder="fiat"/>
            </div>
        </div>
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}




export function getTrackerTypeOption(trackerName){
    const template = `
    <option value="${Util.htmlEncode(trackerName)}">${Util.htmlEncode(trackerName)}</option>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
                    

}

export function getSwapRow({action, tokenAmount, comparatorAmount, 
fiatAmount, comparatorPerToken, fiatPerToken, transactionURL, transactionHash,
previousComparatorPerToken, previousFiatPerToken}){

    let comparatorPerTokenClass = '';
    if (previousComparatorPerToken && comparatorPerToken){
        if (comparatorPerToken < previousComparatorPerToken){
            comparatorPerTokenClass = 'down';
        } else if (comparatorPerToken > previousComparatorPerToken){
            comparatorPerTokenClass = 'up';
        }
    }
    let fiatPerTokenClass = '';
    if (previousFiatPerToken && fiatPerToken){
        if (fiatPerToken < previousFiatPerToken){
            fiatPerTokenClass = 'down';
        } else if (fiatPerToken > previousFiatPerToken){
            fiatPerTokenClass = 'up';
        }
    }
    let actionClass = '';
    if (action.toLowerCase() === 'sell'){
        actionClass = 'down';
    } else if (action.toLowerCase() === 'buy'){
        actionClass = 'up';
    }
    let transactionA = '';
    if (transactionURL){
        transactionA =  `<a href="${transactionURL}">${transactionHash}</a>`;
    } else {
        transactionA = `<div style="opacity:0.5;">${transactionHash}</div>`;
    }
    //These values come from me, so is okay to just interpolate them in.
    const template = `
    <div class="swap-row">
        <div class="swap-time-ago">&lt;1m</div>
        <div class="swap-event ${actionClass}">${action}</div>
        <div class="swap-token-amount">${tokenAmount}</div>
        <div class="swap-comparator-amount">${comparatorAmount}</div>
        <div class="swap-comparator-per-token ${comparatorPerTokenClass}">${comparatorPerToken}</div>
        <div class="swap-fiat-amount">${fiatAmount? '$'+fiatAmount : '--'}</div>
        <div class="swap-fiat-per-token ${fiatPerTokenClass}">${fiatPerToken? '$'+fiatPerToken : '--'}</div>
        <div class="swap-transaction">
            ${transactionA}
        </div>
    </div>
    `

    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    if (transactionURL){
        dummyParent.getElementsByClassName("swap-transaction")[0].addEventListener('click', e => {
            window.bridge.openURL(`https://ftmscan.com/tx/${transactionHash}`);
        })
        dummyParent.getElementsByClassName("swap-transaction")[0].addEventListener('contextmenu', e => {
            navigator.clipboard.writeText(`${transactionHash}`);
            Floater.createAtMouse("Copied!");
        })
    }
    return {htmlRow: dummyParent.firstElementChild, timeElement: dummyParent.getElementsByClassName("swap-time-ago")[0]};
}


export function getTreeNode(botListingClone){
    const template = `
    <div class="spawn-tree-node">
        <div class="spawn-tree-node-listing-container">

        </div>
        <div class="spawn-tree-node-child-listings">

        </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}


export function getTracePage(){
    const dummyParent = document.createElement('div');
    dummyParent.classList.add("trace-rows");
    return dummyParent
}

export function getTrace(){
    const template = `
    <div class="bot-trace">
        <div class="trace-header">
            <div class="trace-header-button bot-uplink-button button bot-button">
                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M24 24H0V0h24v24z" fill="none" opacity=".87"/><path d="M19 15l-6 6-1.42-1.42L15.17 16H4V4h2v10h9.17l-3.59-3.58L13 9l6 6z"/></svg>
            </div>
            <div class="trace-pagination">
                <div class="trace-pagination-direct-link">0</div>
                <div class="trace-pagination-direct-link">&lt;</div>
                <input type="text" class="trace-pagination-input" value="0"/>
                <div class="trace-pagination-direct-link">&gt;</div>
                <div class="trace-pagination-direct-link">0</div>
            </div>
            <div class="trace-header-button button bot-button disabled">
               
            </div>
        </div>
        <div class="trace-pages"></div>
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}


export function getLogic(){
    const ret = document.createElement('div');
    ret.classList.add('bot-logic');
    return ret;
}


export function getBotListing(botName){
    const template = `
    <div class="listing row">
        <div class="running-indicator">
            active
        </div>
        <div class="bot-name">${Util.htmlEncode(botName)}</div>
        <div class="spawn-tree-button">
            <svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><rect fill="none" height="24" width="24"/><path d="M22,11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3H22z M7,9H4V5h3V9z M17,15h3v4h-3V15z M17,5h3v4h-3V5z"/></svg>
        </div>
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}


export function getGroupListing(groupName){
    const template = `
    <div draggable class="group-listing row">
        <div class="group-name-row">
            <svg class="group-show-hide" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M24 24H0V0h24v24z" fill="none" opacity=".87"/><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6-1.41-1.41z"/></svg>
            <div class="group-name">${Util.htmlEncode(groupName)}</div>
        </div>
        
        <div class="listings">

        </div>
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}

export function getModuleListing(moduleName){
    const template = `
    <div draggable="true" class="listing row">
        <div class="module-name">${Util.htmlEncode(Util.spacedAtCapitals(moduleName))}</div>
    </div> 
    `    
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}


export function getModuleMultiOutputLayer(outputs){
    const template = `
    <div class="module-multi-output-info-layer">
        <div class="module-multi-output">${Util.htmlEncode(outputs[0])}</div>
        <div class="module-multi-output">${Util.htmlEncode(outputs[1])}</div>
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}

export function getModule(){
    const template = `
    <div draggable="true" class="bot-module">
        <div class="module-utility-button bot-module-remove-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 8 8" stroke="currentColor" strokeWidth="1"><path stroke-width="2" fill="none" d="M0 0 L8 8 M8 0 L0 8"></svg>
        </div>
        <div class="bot-module-info-container">
            <div></div>
        </div>
        <div class="tracker-uri">

        </div>
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}


export function getRaceBlockModuleTemplate(){
    const template = `
<div class="module-template race-block-module-template">
    <div class="bot-module-guide-cells row-1-span-1 column-1-span-2">
        <div class="bot-module-outline row-1 column-1"></div>
        <div class="bot-module-outline row-1 column-2"></div>
    </div>
    <div class="bot-module-race-block-link row-2-span-1 column-1-span-1"></div>
    <div class="bot-module-race-block-link row-2-span-1 column-2-span-1"></div>
    <div class="bot-module-guide-cells row-3-span-1 column-1-span-2">
        <div class="bot-module-outline row-3 column-1"></div>
        <div class="bot-module-outline row-3 column-2"></div>
    </div>
</div> 
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}

export function getSingleModuleTemplate(){
    const template = `
<div class="module-template single-module-template">
    <div class="bot-module-guide-cells row-1-span-3 column-1-span-2">
        <div class="bot-module-outline row-1 column-1"></div>
    </div>
</div> 
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}

export function getBotRow(){
    const template = `
    <div class="bot-row">
        <div class="bot-row-number">1</div>
        <div class="bot-row-body">
            <div class="bot-row-label-button">
                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path opacity=".75" d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16zM16 17H5V7h11l3.55 5L16 17z"/></svg>
            </div>
            <div class="bot-row-label">Label</div>
            <div class="bot-row-template-container">

            </div>
        </div>
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    const taskRow = dummyParent.firstElementChild;    
    return taskRow;
}

export function getJSONElement(json){
    const pre = document.createElement('pre');
    pre.classList.add('json-element');
    pre.innerText = JSON.stringify(json, null, 2);
    return pre;
}

export function getTraceModule(dateString, title){
    const [date, time] = dateString.split(' ');
    const codedTitle = title.split('<br>').map(titleLine => Util.htmlEncode(titleLine)).join('<br>');
    const template = `
    <div class="bot-module">
        <div class="module-entry-time">
            <div>${date}</div>
            <div>${time}</div>
        </div>
        <div class="module-title">${codedTitle}</div>
        <div class="module-output-lines-container">
            <div class="module-output-lines">
            </div>
        </div>
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}

export function getModuleOutputLine(text){
    const template = `
        <div class="module-output-line">${Util.htmlEncode(text, true)}</div>
    ` 
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstElementChild;
}

export function getTraceRow(){
    const template = `
    <div class="bot-row">
        <div class="bot-row-number">1</div>
        <div class="bot-row-body">
            <div class="bot-row-index">0</div>
            <div class="bot-row-label">Label</div>
            <div class="bot-row-template-container">
            
            </div>
        </div>
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    const taskRow = dummyParent.firstElementChild;    
    return taskRow;
}

export function createBotLinkRow(botListing){
    const template = `
    <div class="bot-link-row">
        
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    const row = dummyParent.firstElementChild;    
    row.appendChild(botListing);
    return row;
}

export function getTraceHaltRow(message){
    const template = `
    <div class="bot-row bot-trace-halt-row">
        <div class="bot-trace-halt">
        ${Util.htmlEncode(message)}
        </div>
    </div>
    `   
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    const taskRow = dummyParent.firstElementChild;    
    return taskRow;
}




export function getPropertiesParametersGrid(script, modulesDatabase, parameters, staticOptions){
    let template = '<div class="properties-parameters-grid">';

    let previousWasAdvanced= false;
    for (let parameterIndex = 0; parameterIndex < parameters.length; ++parameterIndex){
        const parameter = parameters[parameterIndex];
        const advanced = parameter.advanced ? 'advanced' : '';
        
        if (!parameter.advanced && previousWasAdvanced){
            template += `<div class="advanced column-1-span-3 horizontal-separator-line"></div>`;
        } 
        previousWasAdvanced = parameter.advanced;
        const paramaterName = Util.htmlEncode(parameter.name);
        const label = parameter.label ? parameter.label : Util.spacedAtCapitals(paramaterName, true);
        

        let row = `<div class="column-1-span-1 ${advanced} ${paramaterName} label">${Util.htmlEncode(label)}:</div>`;
        if (parameter.type === 'file'){
            row += `<input class="column-2-span-2 ${advanced} ${paramaterName} input" type="text" value="${Util.htmlEncode(parameter.value)}" placeholder="${parameter.placeholder ? parameter.placeholder : ''}"/>`;
            row += `<button class="column-3-span-1 ${advanced} ${paramaterName} file-parameter-button" parameterName="${paramaterName}" style="justify-content: center; padding-left: 2px; padding-right: 2px;">. . .</button>`;

        } else if (parameter.type === 'boolean'){
            row += `<input class="column-2-span-2 ${advanced} ${paramaterName} input" type="checkbox" ${parameter.value ? "checked=true" : ""}/>`;
        } else if (parameter.type === 'select'){
            if (parameter.options){
                let options = typeof parameter.options === 'string' ? staticOptions[parameter.options] : parameter.options;
                row += `<select class="column-2-span-2 ${advanced} ${paramaterName} input" value="">`;
                if(parameter.allowNull){
                    const selected = parameter.value === null;
                    row += `<option value="" ${selected}>&lt;none&gt;</option>`;
                }
                if (Array.isArray(options)){
                    for (const option of options){
                        const selected = option === parameter.value ? 'selected' : '';
                        row += `<option value="${Util.htmlEncode(option)}" ${selected}>${Util.htmlEncode(option)}</option>`;
                    }
                } else {
                    for (const option of Object.keys(options)){
                        const selected = option === parameter.value ? 'selected' : '';
                        row += `<option value="${Util.htmlEncode(option)}" ${selected}>${Util.htmlEncode(options[option])}</option>`;
                    }
                }
                row += '</select>';
            } else {
                row += `<select class="column-2-span-2 ${advanced} ${paramaterName} input" value="">`;
                if(parameter.allowNull){
                    const selected = parameter.value === null;
                    row += `<option value="" ${selected}>&lt;none&gt;</option>`;
                }
                if (modulesDatabase[parameter.key]){
                    for (const option of Object.keys(modulesDatabase[parameter.key])){
                        const selected = option === parameter.value ? 'selected' : '';
                        row += `<option value="${Util.htmlEncode(option)}" ${selected}>${Util.htmlEncode(option)}</option>`;
                    }
                }
                row += '</select>';
                row += `<button class="${advanced} column-3-span-1 manage-select-parameter-button" parameterName="${paramaterName}" style="justify-items: center; padding-left: 2px; padding-right: 2px;">Manage</button>`;
            }
        
        } else if (parameter.type === 'textArea'){
            row += `<textarea class=" ${advanced} column-2-span-2 ${paramaterName} input" spellcheck="false" placeholder="${parameter.placeholder ? parameter.placeholder : ''}">${Util.htmlEncode(parameter.value)}</textarea>`;
        } else {
            row += `<input class="${advanced} column-2-span-2 ${paramaterName} input" type="text" spellcheck="false" value="${Util.htmlEncode(parameter.value)}" placeholder="${Util.htmlEncode(parameter.placeholder ? parameter.placeholder : '')}"/>`;
        }
        template += row;
    }
    
    template += '</div>'
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return dummyParent.firstChild;
}


export function getGlobalsRow(name, value){
    const template = `
        <input class="globals-variable-name-input" type="text" />
        <div class="globals-variable-name-label">$g.${Util.htmlEncode(name) + ':'}</div>
        
        <input class="globals-variable-value" type="text" value="${Util.htmlEncode(value)}"/>
        <button class="globals-variable-action">X</button>
    `
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = template;
    return {
        nameInputElement: dummyParent.children[0],
        nameLabelElement: dummyParent.children[1], 
        valueElement: dummyParent.children[2], 
        actionElement: dummyParent.children[3]
    };
}