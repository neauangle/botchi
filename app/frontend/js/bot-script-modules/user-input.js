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

export const NAME = "UserInput";
export const VERSION = "0.0.0";

export const MESSAGE_PARAM_INDEX = 0;
export const INPUT_VARIABLES_PARAM_INDEX = 1;
export const OKAY_BUTTON_TEXT_PARAM_INDEX = 2;
export const CANCEL_BUTTON_TEXT_PARAM_INDEX = 3;

export function getDescription(){
    return "todo";
}

export function getTitle(customParameters){
    return "USER INPUT";
}


export function getResultKeys(){
    return ['cancel', 'ok'];
}


export function getDefaultParameters(){
    return [
        {name: 'message', value: '', type: 'textArea', visible: true, valid: true, placeholder:""}, 
        {name: 'inputVariables', value: '', type: 'textArea', visible: true, valid: true, placeholder:""}, 
        {name: 'okayButtonText', value: 'OK', type: 'text', visible: true, valid: false, placeholder: ''}, 
        {name: 'cancelButtonText', value: 'Cancel', type: 'text', visible: true, valid: false, placeholder: ''},
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
    
}


export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'message'){
        ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: false, allowEmpty: false});

    } else if (parameter.name === 'inputVariables'){
        parameter.value = parameter.value.trim();
        parameter.valid = !parameter.value || ScriptModuleCommon.validateStatements(parameter.value);
        
    } else if (parameter.name === 'okayButtonText'){
        parameter.value = parameter.value.trim();
        parameter.valid = !!parameter.value; //need at least one button to know when to move on
    
    } else if (parameter.name === 'cancelButtonText'){
        parameter.value = parameter.value.trim();
        parameter.valid = true; //empty means no "false" button
    }
}



export function getInstance(customParameters){

    const instance = ScriptModuleCommon.getModuleInstance();

    const init = function(){
    }

    const activate = async function(priceOnActivation, outerRowIndex, rowResults, localVariabless, tracker, auxillaryFunctions){
        const activationCount = instance.activationCount;

        let message;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[MESSAGE_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            instance.addOutputLine(`Message: ${customParameters[MESSAGE_PARAM_INDEX].value}`);
            for (let i = 0; i < derivationLines.length; ++i){
                instance.addOutputLine(`Message: ${derivationLines[i]}`);
            }
            message = stringValue;
        }


        instance.addOutputLine(`Processing default values...`);
        const inputVariables = {};
        {
            const {error, result}  = instance.processStatements(customParameters[INPUT_VARIABLES_PARAM_INDEX].value, inputVariables);
            if (error){
                console.log(error);
                return;
            }
        }

        const okayButtonText = customParameters[OKAY_BUTTON_TEXT_PARAM_INDEX].value.trim();
        const cancelButtonText = customParameters[CANCEL_BUTTON_TEXT_PARAM_INDEX].value.trim();

        instance.addOutputLine(`Waiting for user input:`);

        try {
            const {okayButtonClicked} = await auxillaryFunctions.waitForInputInModuleTrace(
                message, inputVariables, okayButtonText, cancelButtonText
            );
            if (activationCount === instance.activationCount){
                for (const variableName of Object.keys(inputVariables)){
                    instance.addOutputLine(`Setting  "$v.${variableName}" = ${inputVariables[variableName]}`);
                    localVariabless[variableName] = inputVariables[variableName];
                }
                instance.finish(!okayButtonClicked ?  'cancel' : 'ok', inputVariables);
            }
           
        } catch (error){
            if (activationCount === instance.activationCount){
                instance.finishWithError(error);
            }
        }
    }

    instance.registerFunctions({init, activate});

    return instance;
}



