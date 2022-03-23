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

export const NAME = "Random Number";
export const VERSION = "0.0.0";

export const IS_INTEGER_PARAM_INDEX = 0;
export const MIN_PARAM_INDEX = 1;
export const MAX_PARAM_INDEX = 2;

export function getDescription(){
    return "Generates a random number. Integers are inclusive both ends; floats are inclusive minimum only. NOT crypto secure.";
}

export function getTitle(customParameters){
    return 'RANDOM ' + (customParameters[IS_INTEGER_PARAM_INDEX].value ? "INT" : "FLOAT");
; 
}


export function getResultKeys(){
    return ['done'];
}



export function getDefaultParameters(){
    return [
        {name: 'isInteger', value: true, type: 'boolean', visible: true, valid: true},
        {name: 'min', value: '0', type: 'text', visible: true, valid: true, placeholder: ''},
        {name: 'max', value: '10', type: 'text', visible: true, valid: true, placeholder: ''},
    ]
}


export function handleTrackerChanged(parameters, extraInfo){
   
}

export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'min' || parameter.name === 'max'){
        parameter.value = parameter.value.trim();
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: false, allowPercentage: false, allow0: true, allowNegative: true});                         
    } 
}







export function getInstance(customParameters){
    const instance = ScriptModuleCommon.getModuleInstance();
    instance.registerFunctions({
        activate: function(priceOnActivation, taskRowIndex, rowResults, localVariabless, tracker){
            
            const isInteger = customParameters[IS_INTEGER_PARAM_INDEX].value;
            const min = ScriptModuleCommon.Big(customParameters[MIN_PARAM_INDEX].value);
            const max = ScriptModuleCommon.Big(customParameters[MAX_PARAM_INDEX].value);
            
            let random;
            const rBig = ScriptModuleCommon.Big(Math.random());
            if (isInteger){
                const ROUND_MODE_FLOOR = 0;
                random = rBig.times(max.minus(min)).round(0, ROUND_MODE_FLOOR).add(min);
            } else {
                random =  rBig.times(max.minus(min)).plus(min);
            }


            const randomAsString = random.toFixed(20);
            console.log(randomAsString);
            let i = randomAsString.length-1;
            while (randomAsString[i] === '0' || randomAsString[i] === '.'){
                i -= 1;
                if (randomAsString[i] === '.'){
                    i -= 1;
                    break;
                }
            }
            const result = randomAsString.slice(0, i+1);

            instance.finish('done', result);
        }
    });
    return instance;
}


