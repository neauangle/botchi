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

export const GROUP_NAME = "Binance";
export const NAME = "BinanceQuery";
export const VERSION = "0.0.0";

export const QUERY_PARAM_INDEX = 0;
export const AUTH_PARAM_INDEX = 1;



export function getDescription(){
    return "Perform a general query to the Binance API."
}


export function getTitle(customParameters){
    return `BINANCE QUERY`;
}


export function getResultKeys(){
    return ['done'];
}




export function getDefaultParameters(){
    return [
        {name: 'query', value: '', type: 'text', visible: true, valid: false, placeholder: '/api/v3/account'}, 
        {name: 'auth', value: null, type: 'select', visible: true, valid: true, allowNull: true, key:'binance-auth'}, 
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
    
}

export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'query'){
        parameter.value = parameter.value.trim();
        parameter.valid = !!parameter.value; 
    } 
}



export function getInstance(customParameters){
    let auth;

    const instance = ScriptModuleCommon.getModuleInstance();
    
    const init = function(){
        auth = ScriptModuleCommon.getValueFromDatabase('binance-auth', customParameters[AUTH_PARAM_INDEX].value);
    }

    const activate = async function(priceOnActivation, taskRowIndex, rowResults, localVariables, tracker){
        const activationCount = instance.activationCount;
        /* if (!auth){
            instance.addOutputLine("No auth supplied");
            return;
        } */


        const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
            expression: customParameters[QUERY_PARAM_INDEX].value,
            isText: true
        });
        if (error){
            return;
        }
        const query = stringValue;

       
        const callbackTicket = instance.getManagedCallbackTicket((type, args, ticket) => {
            instance.addOutputLine(args.message);
            return instance.isActive && activationCount === instance.activationCount;
        });
        const args = {
            apiKey: auth ? auth.apiKey : undefined,
            secretKey: auth ? auth.secretKey : undefined,
            isTestnet: auth ? auth.isTestnet : false,
            query,
            callbackTicket
        }

        const backendIndex = ScriptModuleCommon.getBackendIndex('binance');
        try {
            const result = await window.bridge.callBackendFunction(backendIndex, 'generalQuery', args);
            if (activationCount === instance.activationCount){
                instance.finish('done', result);
            }
        } catch (error) {
            if (activationCount === instance.activationCount){
                instance.finishWithError(error);
            }
        }
    }

    instance.registerFunctions({init, activate});

    return instance;
}



