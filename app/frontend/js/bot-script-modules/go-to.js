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

export const NAME = "GoTo";
export const VERSION = "0.0.0";

export const OUTER_ROW_INDEX_PARAM_INDEX = 0;


export function getTitle(customParameters){
    return 'GOTO ' + customParameters[OUTER_ROW_INDEX_PARAM_INDEX].value;
; 
}


export function getResultKeys(){
    return ['done'];
}



export function getDefaultParameters(){
    return [
        {name: 'goto', value: '0', type: 'select', visible: true, valid: true, options: 'STATIC_OPTIONS_GOTO'},
    ]
}



export function getInstance(customParameters){
    const instance = ScriptModuleCommon.getModuleInstance();
    instance.registerFunctions({
        activate: function(priceOnActivation, taskRowIndex, rowResults, localVariabless, tracker){
            instance.finish('done', rowResults[instance.previousOuterRowIndex].result);
        }
    });
    return instance;
}




export function handleTrackerChanged(parameters, extraInfo){
   
}


export function updateParameterMetaSettings(parameters, changedParameterIndex, {gotoOptions}){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'goto'){
        parameter.valid = gotoOptions.includes(parameter.value);
    }
} 


function clamp(value, minimum, maximum){
    return value < minimum ? minimum : value > maximum ? maximum : value;
}