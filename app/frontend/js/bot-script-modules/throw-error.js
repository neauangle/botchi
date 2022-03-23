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

export const NAME = "ThrowError";
export const VERSION = "0.0.0";

export const CUSTOM_ERROR_PARAM_INDEX = 0;

export function getDescription(){
    return "Halts bot with error";
}

export function getTitle(customParameters){
    return 'THROW ERROR';
; 
}


export function getResultKeys(){
    return ['done'];
}



export function getDefaultParameters(){
    return [
        {name: 'errorPrefix', value: '', type: 'text', visible: true, valid: true, plaecholder: 'Optional'},
    ]
}



export function getInstance(customParameters){
    const instance = ScriptModuleCommon.getModuleInstance();
    instance.registerFunctions({
        activate: function(activationPrice, outerRowIndex, rowResults, localVariables, tracker, auxillaryFunctions){
            const customError = customParameters[CUSTOM_ERROR_PARAM_INDEX].value;
            const lastModuleError = instance.previousOuterRowIndex === undefined ? '' : rowResults[instance.previousOuterRowIndex].error;
            const errorMessage = customError + (lastModuleError ? lastModuleError : '');
            instance.addOutputLine('Throwing: ' + errorMessage);
            throw errorMessage;
        }
    });
    return instance;
}




export function handleTrackerChanged(parameters, extraInfo){
   
}


export function updateParameterMetaSettings(parameters, changedParameterIndex, {gotoOptions}){
    
} 

