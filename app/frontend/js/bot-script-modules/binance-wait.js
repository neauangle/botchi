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
export const NAME = "BinanceWait";
export const VERSION = "0.0.0";

export const TYPE_PARAM_INDEX = 0;
export const TX_PARAM_INDEX = 1;
export const TIMEOUT_SECS_PARAM_INDEX = 2;
export const AUTH_PARAM_INDEX = 3;

export const STATIC_OPTIONS_TYPE = ['Deposit', 'Withdraw'];


export function getDescription(){
    return "Todo"
}


export function getTitle(customParameters){
    return `BINANCE WAIT`;
}


export function getResultKeys(){
    return ['done'];
}



export function getDefaultParameters(){
    return [
        {name: 'type', value: 'Deposit', type: 'select', visible: true, valid: true, options: 'STATIC_OPTIONS_TYPE'}, 
        {name: 'tx', value: '', type: 'text', visible: true, valid: false, placeholder: ''}, 
        {name: 'timeoutSecs', value: '120', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'auth', value: null, type: 'select', visible: true, valid: false, key:'binance-auth'}, 
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
    
}


export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'tx'){
        const trimmed = parameter.value.trim();
        parameter.value = trimmed;
        parameter.valid = !!parameter.value;
    
    } else if (parameter.name === 'timeoutSecs'){
        const timeoutSecs = Number(parameter.value);
        parameter.valid = !isNaN(timeoutSecs) && timeoutSecs > 0;
        if (parameter.valid){
            parameter.value = timeoutSecs.toString();
        }
    
    } else if (parameter.name === 'auth'){
        parameter.valid = !!parameter.value;
    }
       
}

export function getInstance(customParameters){
    let auth;

    const instance = ScriptModuleCommon.getModuleInstance();

    const init = function(){
        auth = ScriptModuleCommon.getValueFromDatabase('binance-auth', customParameters[AUTH_PARAM_INDEX].value);
    }

   
    const activate = async function(priceOnActivation, taskRowIndex, rowResults, localVariabless, tracker){
        const activationCount = instance.activationCount;
        if (!auth){
            instance.finishWithError("No valid binance auth selected");
            return;
        }

        const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
            expression: customParameters[TX_PARAM_INDEX].value,
            isText: true
        });
        if (error){
            return;
        }
        const transactionHash = stringValue;
    
        const callbackTicket = instance.getManagedCallbackTicket((type, args, ticket) => {
            instance.addOutputLine(args.message);
            return instance.isActive && activationCount === instance.activationCount;
        });
        const args = {
            apiKey: auth.apiKey,
            secretKey: auth.secretKey,
            callbackTicket,
            type: customParameters[TYPE_PARAM_INDEX].value,
            filter: {txId: transactionHash},
            timeoutSecs: Number(customParameters[TIMEOUT_SECS_PARAM_INDEX].value)
        }

        const backendIndex = ScriptModuleCommon.getBackendIndex('binance');
        try {
            const result = await window.bridge.callBackendFunction(backendIndex, 'awaitDepositOrWithdraw', args);
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



