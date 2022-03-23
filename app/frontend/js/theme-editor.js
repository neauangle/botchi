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
import * as JSColor from './third_party/js-color.js';
/* const jscolor = function(){
    return {
        fromString: function(){return '00'},
        toHEXAString: function(){return '00'},
        option: () => {}
    };
} */
import * as Chart from './chart.js';
import * as Prompt from './prompt.js';
import * as Emitter from  './event-emitter.js'; const emitter = Emitter.instance(); export {emitter};
export const EVENT = {
    THEME_VARIABLES_CHANGE_CONFIRMED: "THEME_VARIABLES_CHANGE_CONFIRMED",
}

const preambleBlocker = document.getElementById("pre-themed-blocker");
let appReady = false;
let endReached = false;
export function setAppReady(){
    appReady = true;
    if (endReached){
        preambleBlocker.classList.add('botchi-animate-opacity-out');
        preambleBlocker.classList.add('invisible-to-mouse')
    }
}


const themeEditorFrame = document.getElementById("theme-editor-frame");
const themeEditorModal = document.getElementById('theme-editor-modal');
const themeEditorInputsContainer = document.getElementById("theme-editor-inputs-container");
const themeEditorLoadButton = document.getElementById("theme-editor-load-button");
const themeEditorSaveButton = document.getElementById("theme-editor-save-button");
const themeEditorOKButton = document.getElementById("theme-editor-ok-button");
const themeEditorCancelButton = document.getElementById("theme-editor-cancel-button");

const variableInfos = [
    {type: 'colour', label: "Text Colour A:", variable: '--text-colour-a'},
    {type: 'colour', label: "Text Colour B:", variable: '--text-colour-b'},
    null,
    
    {type: 'colour', label: "Line Colour:", variable: '--line-colour-a'},
    {type: 'colour', label: "Background Colour:",  variable: '--background-colour-a'},
    {type: 'colour', label: "Shadow Colour:",  variable: '--shadow-colour-a'},
    {type: 'colour', label: "Alternate Row Highlight:",  variable: '--nth-row-background-colour'},
    null,

    {type: 'colour', label: "Buy Colour:", variable: '--buy-colour'},
    {type: 'colour', label: "Sell Colour:", variable: '--sell-colour'},
    {type: 'colour', label: "Priceline Colour:", variable: '--neutral-priceline-colour'},
    null,

    {type: 'font-family', label: "Font Family Main:", variable: '--font-family-main'},
    {type: 'font-family', label: "Font Family Secondary:", variable: '--font-family-a'},
    {type: 'font-family', label: "Font Family Monospace:", variable: '--font-family-monospace'},
    null,

    {type: 'font-size', label: "Font Size H1:", variable: '--font-size-h1'},
    {type: 'font-size', label: "Font Size H2:", variable: '--font-size-h2'},
    {type: 'font-size', label: "Font Size H3:", variable: '--font-size-h3'},
    {type: 'font-size', label: "Font Size H4:", variable: '--font-size-h4'},
    {type: 'font-size', label: "Font Size H5:", variable: '--font-size-h5'},
    {type: 'font-size', label: "Font Size H6:", variable: '--font-size-h6'},
    {type: 'font-size', label: "Font Size H7:", variable: '--font-size-h7'},
    {type: 'font-size', label: "Font Size H8:", variable: '--font-size-h8'},
    {type: 'font-size', label: "Font Size H9:", variable: '--font-size-h9'},
    {type: 'font-size', label: "Font Size H10:", variable: '--font-size-h10'},
];
let variableToVariableInfo = {};

const gridColourvariables = {
    '--line-colour-a': 'HERE_PURELY_TO_TRIGGER', 
    '--line-colour-a-three-quarters': 'gridlineColour', 
    '--buy-colour': 'upColour', 
    '--sell-colour': 'downColour', 
    '--background-colour-a': 'backgroundColour',
    '--text-colour-a': 'textColour'
}

const pickerColourvariables = {
    '--background-colour-a': 'backgroundColor',
    '--line-colour-a': 'borderColor',
}

const computedStyle = getComputedStyle(document.documentElement);
for (const variableInfo of variableInfos){
    if (!variableInfo){
        const div = document.createElement('div');
        div.classList.add('column-1-span-2');
        div.classList.add('spacer');
        themeEditorInputsContainer.appendChild(div);
        continue;
    }
    variableToVariableInfo[variableInfo.variable] = variableInfo;
    variableInfo.value = computedStyle.getPropertyValue(variableInfo.variable).trim();
    variableInfo.defaultValue = computedStyle.getPropertyValue(variableInfo.variable).trim();
    const label = document.createElement('label');
    label.innerText = variableInfo.label;
    label.classList.add('column-1-span-1');
    themeEditorInputsContainer.appendChild(label);

    const input = document.createElement('input');
    input.id = variableInfo.variable;
    variableInfo.input = input;
    if (variableInfo.type === 'colour'){
        input.setAttribute('value', variableInfo.value);
        variableInfo.picker = new jscolor(input, {
            'backgroundColor': computedStyle.getPropertyValue('--background-colour-a'),
            'borderColor': computedStyle.getPropertyValue('--line-colour-a'),
            'borderWidth': 3,
            'padding': 17
        });
        variableInfo.picker.onChange = () => changeVariable(variableInfo, variableInfo.picker.toHEXAString());

    } else {
        input.setAttribute('type', 'text');
        input.value = computedStyle.getPropertyValue(variableInfo.variable);
        input.addEventListener('change', () => changeVariable(variableInfo, input.value));
    }
    
    input.classList.add('column-2-span-1');
    themeEditorInputsContainer.appendChild(input);
}

const defaultPath = await window.bridge.getDirectoryPath('THEMES_PATH');
const currentThemePath = defaultPath + '/_current_theme.json';

window.bridge.writeToFile(defaultPath + '/_default_theme.json', JSON.stringify(getCurrentTheme(), null, "  "), false);

try {
    const themeString = await window.bridge.readFromFile(currentThemePath);
    const themeJson = JSON.parse(themeString);
    for (const themevariable of Object.keys(themeJson)){
        const variableInfo = variableToVariableInfo[themevariable];
        if (variableInfo){
            variableInfo.value = themeJson[themevariable];
            changeVariable(variableInfo, null);
        }
    }
} catch (error) {
    console.log(error);
    for (const variableInfo of variableInfos){
        if (variableInfo){
            variableInfo.value = variableInfo.defaultValue;
            changeVariable(variableInfo, null);
        }
    }
}



export function show(){
    themeEditorFrame.style.display = 'flex';
    for (const variableInfo of variableInfos){
        if (variableInfo){
            variableInfo.hasChanged = false;
        }
    }
    return makePromise();

}

//set value to null to reset to before editor popped up
function changeVariable(variableInfo, value){
    if (value === null){
        value = variableInfo.value;
        variableInfo.input.value = value;
        if (variableInfo.type === 'colour'){
            variableInfo.picker.fromString(variableInfo.value);
        } 
    } else {
        variableInfo.hasChanged = true;
    }

    document.documentElement.style.setProperty(variableInfo.variable, value);

    if (variableInfo.variable === '--line-colour-a'){
        const threeQuarters =  variableInfo.picker.toHEXAString().slice(0, 7) + 'BE';
        document.documentElement.style.setProperty('--line-colour-a-three-quarters', threeQuarters);
        const half =  variableInfo.picker.toHEXAString().slice(0, 7) + '90';
        document.documentElement.style.setProperty('--line-colour-a-half', half);
        const oneQuarter =  variableInfo.picker.toHEXAString().slice(0, 7) + '60';
        document.documentElement.style.setProperty('--line-colour-a-one-quarter', oneQuarter);
    } 
    if (Object.keys(gridColourvariables).includes(variableInfo.variable)){
        const options = {};
        for (const gridVar of Object.keys(gridColourvariables)){
            options[gridColourvariables[gridVar]] = Util.getCSSVariable(gridVar).trim();
        }
        Chart.setColours(options);
    }

    if (Object.keys(pickerColourvariables).includes(variableInfo.variable)){
        const options = {};
        for (const pickerVar of Object.keys(pickerColourvariables)){
            options[pickerColourvariables[pickerVar]] = Util.getCSSVariable(pickerVar).trim();
        }
        for (const vInfo of variableInfos){
            if (vInfo && vInfo.picker){
                vInfo.picker.option(options);
            }
        }
    }


    
}


function makePromise(){
    return new Promise(function (resolve, reject) {
        const cancel = function(ev){
            if (themeEditorCancelButton.disabled || themeEditorOKButton.disabled){
                return;
            }
            if (!ev.key || ev.key === 'Escape'){
                themeEditorFrame.style.display = 'none';
                for (const variableInfo of variableInfos){
                    if (variableInfo && variableInfo.hasChanged){
                        changeVariable(variableInfo, null);
                    }
                }
                resolve();
                document.removeEventListener('keyup', cancel);
                document.removeEventListener('keyup', ok);
            } 
        }
        document.addEventListener('keyup', cancel);
        themeEditorFrame.addEventListener("mousedown", event => {
            if (!themeEditorCancelButton.disabled && !event.target.closest('.shaded-panel')){
                cancel({ev: {key:'Escape'}});
            }
        }); 

        const ok = function(ev){
            if (themeEditorCancelButton.disabled || themeEditorOKButton.disabled){
                return;
            }
            if (!ev.key){
                themeEditorOKButton.disabled = true;
                themeEditorFrame.style.display = 'none';
                const changedvariables = {};
                for (const variableInfo of variableInfos){
                    if (variableInfo && variableInfo.hasChanged){
                        changedvariables[variableInfo.variable] = {old: variableInfo.value, new: variableInfo.input.value};
                        variableInfo.value = variableInfo.input.value;
                        
                    }
                }
                
                window.bridge.writeToFile(currentThemePath, JSON.stringify(getCurrentTheme(), null, "  "), false);
                themeEditorOKButton.disabled = false;
                emitter.emitEvent(EVENT.THEME_VARIABLES_CHANGE_CONFIRMED, changedvariables);
                resolve();
                document.removeEventListener('keyup', cancel);
                document.removeEventListener('keyup', ok);
            }
        }
        document.addEventListener('keyup', ok);

        themeEditorOKButton.addEventListener("click", ok, {once: true});
        themeEditorCancelButton.addEventListener("click", cancel, {once: true});
    });
}


function getCurrentTheme(){
    const theme = {};
    for (const variableInfo of variableInfos){
        if (variableInfo){
            theme[variableInfo.variable] = variableInfo.input.value;
        }
    }
    return theme;
}

themeEditorSaveButton.addEventListener('click', async () => {
    themeEditorSaveButton.disabled = true;
    const filePath = await window.bridge.showFileDialogue({
        type: 'save',
        title: "Save Current Theme As...",
        buttonLabel: "Save",
        defaultFilename: 'theme.json',
        defaultPath,
        filters :[{name: 'Botchi Theme', extensions: ['json']}],
    });
    if (filePath){
        await window.bridge.writeToFile(filePath, JSON.stringify(getCurrentTheme(), null, "  "), false);
        Prompt.showMessage({title: 'Theme Saved', message: 'Theme saved to ' + filePath});
    }
    themeEditorSaveButton.disabled = false;
});

themeEditorLoadButton.addEventListener('click', async () => {
    themeEditorLoadButton.disabled = true;
    const filePaths = await window.bridge.showFileDialogue({
        type: 'load',
        title: "Load Theme...",
        buttonLabel: "Load",
        defaultFilename: 'theme.json',
        defaultPath,
        filters :[{name: 'Botchi Theme', extensions: ['json']}],
    });
    if (filePaths && filePaths.length){
        const filePath = filePaths[0];
        try {
            await window.bridge.readFromFile(filePath);
            const themeString = await window.bridge.readFromFile(filePath);
            const themeJson = JSON.parse(themeString);
            for (const themevariable of Object.keys(themeJson)){
                const variableInfo = variableToVariableInfo[themevariable]
                if (variableInfo){
                    variableInfo.value = themeJson[themevariable];
                    changeVariable(variableInfo, null);
                }
            }
            Prompt.showMessage({title: 'Success!', message: 'Theme loaded successfully.'});
        } catch (error) {
            console.log(error);
            Prompt.showMessage({title: 'Error Loading Theme', message: error});
        }
    }
    themeEditorLoadButton.disabled = false;
})




endReached = true;
if (appReady){
    preambleBlocker.classList.add('botchi-animate-opacity-out-fast');
    preambleBlocker.classList.add('invisible-to-mouse')
}

