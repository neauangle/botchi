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

export const NAME = "WriteFile";
export const VERSION = "0.0.0";

export const FILE_PATH_PARAM_INDEX = 0;
export const IS_APPEND_PARAM_INDEX = 1;
export const TEXT_PARAM_INDEX = 2;
export const IS_BLOCKING_PARAM_INDEX = 3;


export function getTitle(customParameters){
    return "WRITE FILE";
}

export function getDefaultParameters(){
    return [
        {name: 'filePath', value: '', type: 'file', visible: true, valid: false, placeholder: ''}, 
        {name: 'isAppend', value: false, type: 'boolean', visible: true, valid: true},
        {name: 'text', value: '', type: 'textArea', visible: true, valid: true, placeholder: ''},
        {name: 'isBlocking', value: true, type: 'boolean', visible: true, valid: true}
    ];
}

export function getResultKeys(){
    return ['done'];
}


export function handleTrackerChanged(parameters, extraInfo){
   
}


export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'filePath'){
        parameter.value = parameter.value.trim();
        parameter.valid = !!parameter.value; 
    }
}






export function getInstance(customParameters){

    const instance = ScriptModuleCommon.getModuleInstance();

    const activate = async function(priceOnActivation, outerRowIndex, rowResults, localVariabless, tracker){
        const activationCount = instance.activationCount;

        const filePath = customParameters[FILE_PATH_PARAM_INDEX].value;
        const isAppend = customParameters[IS_APPEND_PARAM_INDEX].value;
        const isBlocking = customParameters[IS_BLOCKING_PARAM_INDEX].value;

        const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
            expression: customParameters[TEXT_PARAM_INDEX].value,
            isText: true
        });
        if (error){
            return;
        }
        const text = stringValue;

        instance.addOutputLine(`${isAppend ? 'Appending' : 'Writing'} text to "${filePath}"...`)
        try {
            const result = window.bridge.writeToFile(filePath, text, isAppend);
            if (isBlocking){
                await result;
                if (instance.isActive && activationCount === instance.activationCount){
                    instance.addOutputLine(`Done!`);
                }
            } else {
                instance.addOutputLine(`Nonblocking. Moving on...`);
            }
            instance.finish('done', 0);
        } catch (error) {
            instance.finishWithError(`Error: ${error}`);
        } 
    }


   instance.registerFunctions({activate});

    return instance;
}




