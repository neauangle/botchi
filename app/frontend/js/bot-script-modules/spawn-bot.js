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

export const NAME = "SpawnBot";
export const VERSION = "0.0.0";

export const BOT_GROUP_PARAM_INDEX = 0;
export const BOT_NAME_PARAM_INDEX = 1;
export const START_FROM_ROW_PARAM_INDEX = 2;
export const STATEMENTS_PARAM_INDEX = 3;
export const IS_BLOCKING_PARAM_INDEX = 4; //bots.js uses this to stop bot on deactivation if blocking


export function getDescription(){
    return "Starts Bot";
}

export function getTitle(customParameters){
    if (customParameters[BOT_GROUP_PARAM_INDEX].value && customParameters[BOT_NAME_PARAM_INDEX].value){
        return `Spawn <${customParameters[BOT_GROUP_PARAM_INDEX].value}.${customParameters[BOT_NAME_PARAM_INDEX].value}>`;
    } else {
        return 'Spawn Bot';
    }
}

export function getResultKeys(){
    return ['done'];
}

export function getDefaultParameters(){
    return [
        {name: 'botGroup', value: '', type: 'text', visible: true, valid: false},
        {name: 'botName', value: '', type: 'text', visible: true, valid: false},
        {name: 'startFromRow', value: '0', type: 'text', visible: true, valid: true},
        {name: 'initialStatements', value: '', type: 'textArea', visible: true, valid: true, placeholder: ''},
        {name: 'isBlocking', value: true, type: 'boolean', visible: true, valid: true}
    ]
}


export function handleTrackerChanged(parameters, extraInfo){
   
}


export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'initialStatements'){
        parameter.value = parameter.value.trim();
        parameter.valid = ScriptModuleCommon.validateStatements(parameter.value, true);//allow empty
    
    } else if (parameter.name === 'startFromRow'){
        parameter.value = parameter.value.trim().toUpperCase();
        parameter.valid = !!parameter.value;


    } else if (parameter.name === 'botGroup'){
        parameter.value = parameter.value.trim();
        parameter.valid = !!parameter.value;
    } else if (parameter.name === 'botName'){
        parameter.value = parameter.value.trim();
        parameter.valid = !!parameter.value;
    }

}




export function getInstance(customParameters){

    const instance = ScriptModuleCommon.getModuleInstance();

    const activate = async function(priceOnActivation, outerRowIndex, rowResults, localVariabless, tracker, auxillaryFunctions){
        const activationCount = instance.activationCount;

        const botGroupName = customParameters[BOT_GROUP_PARAM_INDEX].value;
        const botName = customParameters[BOT_NAME_PARAM_INDEX].value;
        const startFromRow = customParameters[START_FROM_ROW_PARAM_INDEX].value;
        const isBlocking = customParameters[IS_BLOCKING_PARAM_INDEX].value;

        const initialVariables = {};
        if (customParameters[STATEMENTS_PARAM_INDEX].value){
            const {error, result} = instance.processStatements(customParameters[STATEMENTS_PARAM_INDEX].value, initialVariables);
            if (error){
                return;
            }
        }

        instance.addOutputLine(`Spawning ${botGroupName}.${botName} with initial arguments: ${JSON.stringify(initialVariables)}`);

        try {
            const copyOfInitialVariables = {...initialVariables};
            const botPromise = auxillaryFunctions.duplicateStartBotFromModule({
                botGroupName, botName, startFromRow, initialVariables
            });
            if (isBlocking){
                const {error, variables} = await botPromise;
                if (error){
                    throw error;
                }
                if (activationCount === instance.activationCount){
                    instance.finish('done', variables);
                }
            } else {
                instance.addOutputLine('Non-blocking- moving on...');
                instance.finish('done', copyOfInitialVariables);
            }
        } catch (error){
            if (activationCount === instance.activationCount){
                instance.finishWithError(error);
            }
        }
        
    }

    instance.registerFunctions({activate});

    return instance;
    
}

