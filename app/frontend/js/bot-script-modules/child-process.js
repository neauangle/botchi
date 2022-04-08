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

let ScriptModuleCommon;
export function init(scriptModuleCommon){
    ScriptModuleCommon = scriptModuleCommon;
}

export const NAME = "ChildProcess";
export const VERSION = "0.0.0";

export const COMMAND_PARAM_INDEX = 0;
export const HIDE_WINDOW_PARAM_INDEX = 1;
export const IS_BLOCKING_PARAM_INDEX = 2;


export function getTitle(customParameters){
    let firstPhrase;
    const command = customParameters[COMMAND_PARAM_INDEX].value;
    if (command.length){
        if (command.startsWith("'")){
            const indexOfSecond = command.indexOf("'", 1);
            if (indexOfSecond >= 0){
                firstPhrase = command.slice(1, indexOfSecond);
            }
        } else if (command.startsWith('"')){
            const indexOfSecond = command.indexOf('"', 1);
            if (indexOfSecond >= 0){
                firstPhrase = command.slice(1, indexOfSecond);
            }
        } 
    }
    if (!firstPhrase){
        firstPhrase = command.split(" ")[0];
    }

    let commandFirstWord = firstPhrase.split(/[\\/]/).pop();
    if (commandFirstWord.length > 10){
        commandFirstWord = commandFirstWord.slice(0, 10) + '...';
    }
    return "$" + commandFirstWord;
}


export function getResultKeys(){
    return ['done'];
}


export function getDefaultParameters(){
    return [
        {name: 'command', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'hideWindow', value: false, type: 'boolean', visible: true, valid: true},
        {name: 'isBlocking', value: false, type: 'boolean', visible: true, valid: true},
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
    
}


export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'hideWindow'){
        
    }
}



export function getInstance(customParameters){

    const instance = ScriptModuleCommon.getModuleInstance();


    const activate = async function(priceOnActivation, taskRowIndex, rowResults, localVariabless, tracker){
        const activationCount = instance.activationCount;

        const command = customParameters[COMMAND_PARAM_INDEX].value;
        const isBlocking = customParameters[IS_BLOCKING_PARAM_INDEX].value;
        const windowsHide = customParameters[HIDE_WINDOW_PARAM_INDEX].value;
        
        instance.addOutputLine(`Running: ${command}`);

        try {
            const result = await window.bridge.executeCommand({command, isBlocking, windowsHide});
            if (activationCount === instance.activationCount){
                instance.finish('done', result);
            }
        } catch (error){
            if (activationCount === instance.activationCount){
                 instance.finishWithError('Error: ' + error);
            }
        }
    }

    instance.registerFunctions({activate});

    return instance;
}
