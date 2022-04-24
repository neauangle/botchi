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

export const GROUP_NAME = "Ethers";
export const NAME = "EthersAddTracker";
export const VERSION = "0.0.0";

export const RESTRICT_TO_TRACKER_TYPES = ['ethers'];

export const API_PARAM_INDEX = 0;
export const EXCHANGE_PARAM_INDEX = 1;
export const TOKEN_ADDRESS_PARAM_INDEX = 2;
export const COMPARATOR_ADDRESS_PARAM_INDEX = 3;
export const COMPARATOR_IS_FIAT_PARAM_INDEX = 4;
export const UPDATE_METHOD_PARAM_INDEX = 5;
export const POLLING_INTERVAL_SECONDS_PARAM_INDEX = 6;
export const QUOTE_TOKEN_AMOUNT_PARAM_INDEX = 7;

export const STATIC_OPTIONS_UPDATE_METHOD = ['Swaps', 'Poll'];


export function getTitle(customParameters){
    return "ETHERS ADD TRACKER";
}


export function getResultKeys(){
    return ['done'];
}




export function getDefaultParameters(){
    return [
        {name: 'api', label: "API", value: null, type: 'select', visible: true, valid: false, options: []}, 
        {name: 'exchange', value: null, type: 'select', visible: true, valid: false, options: []}, 
        {name: 'tokenAddress', value: "", type: 'text', visible: true, valid: false},
        {name: 'comparatorAddress', value: "", type: 'text', visible: true, valid: false},
        {name: 'comparatorIsFiat', value: false, type: 'boolean', visible: true, valid: true},
        {name: 'updateMethod', value:'Swaps', type: 'select', visible: false, valid: true, options: 'STATIC_OPTIONS_UPDATE_METHOD'}, 
        {name: 'pollingInterval', value: '5', type: 'text', visible: false, valid: true, placeholder: '(seconds)'},
        {name: 'quoteAmount', value: '100', type: 'text', visible: false, valid: true, placeholder: '(tokens)'},
    ];
}

export function handleTrackerChanged(parameters, extraInfo){

}


export async function updateParameterMetaSettings(parameters, changedParameterIndex, {tracker}){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'api'){
        parameters[changedParameterIndex] = await ScriptModuleCommon.handleParameterMetaEthersNetwork(parameter, tracker);
    
    } else  if (parameter.name === 'exchange'){
        parameters[changedParameterIndex] = await ScriptModuleCommon.handleParameterMetaEthersNetwork(parameter, tracker);
    
    } else  if (parameter.name === 'tokenAddress' || parameter.name === 'comparatorAddress'){
        parameter.value = parameter.value.trim();
        parameter.valid = (
            ScriptModuleCommon.Util.isValidERC20(parameter.value)
            || ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: false, allowEmpty: false})
        ) 
    
    } else  if (parameter.name === 'updateMethod'){
        parameters[POLLING_INTERVAL_SECONDS_PARAM_INDEX].visible = parameter.value === 'Poll';
        parameters[QUOTE_TOKEN_AMOUNT_PARAM_INDEX].visible = parameter.value === 'Poll';
    }
    
}


export function getInstance(customParameters){
    const instance = ScriptModuleCommon.getModuleInstance();

    const activate = async function(priceOnActivation, taskRowIndex, rowResults, localVariabless, tracker){
        const backendIndex = ScriptModuleCommon.getBackendIndex('ethers');
        const endpointName = customParameters[API_PARAM_INDEX].value;
        const exchangeName = customParameters[EXCHANGE_PARAM_INDEX].value;
        const exchangeId = await window.bridge.callBackendFunction(backendIndex, 'getExchangeId', {endpointName, exchangeName});
        if (exchangeId === null || exchangeId === undefined){
            instance.finishWithError(`No exchange with name "${exchangeName}" under api "${endpointName}"`);
            return;
        }



        let tokenAddress;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[TOKEN_ADDRESS_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            tokenAddress = stringValue;
            instance.addOutputLine(`Token address: ${customParameters[TOKEN_ADDRESS_PARAM_INDEX].value}`);
            for (let i = 0; i < derivationLines.length; ++i){
                instance.addOutputLine(`Token address: ${derivationLines[i]}`);
            }
        }
        let comparatorAddress;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[COMPARATOR_ADDRESS_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            comparatorAddress = stringValue;
            instance.addOutputLine(`Comparator address: ${customParameters[COMPARATOR_ADDRESS_PARAM_INDEX].value}`);
            for (let i = 0; i < derivationLines.length; ++i){
                instance.addOutputLine(`Comparator address: ${derivationLines[i]}`);
            }

        }

        const comparatorIsFiat = customParameters[COMPARATOR_IS_FIAT_PARAM_INDEX].value;
        const updateMethod = customParameters[UPDATE_METHOD_PARAM_INDEX].value === "Swaps" ? "SWAPS" : "POLL";
        const pollIntervalSeconds = updateMethod === "SWAPS" ? null : Number(customParameters[POLLING_INTERVAL_SECONDS_PARAM_INDEX].value);
        const pollQuoteTokenAmount = updateMethod === "SWAPS" ? null : Number(customParameters[QUOTE_TOKEN_AMOUNT_PARAM_INDEX].value);
        const args = {
            type: "PAIR", 
            exchangeId, tokenAddress, comparatorAddress, 
            comparatorIsFiat, updateMethod, pollIntervalSeconds, pollQuoteTokenAmount
        };
        
        instance.addOutputLine(`Adding tracker for ${comparatorAddress}...`);
        let newTracker;
        try {
            newTracker = await ScriptModuleCommon.addTracker(backendIndex, args);
        } catch (error){
            instance.finishWithError(`Error adding tracker: ${error}`);
            return;
        }
        if (!newTracker){
            instance.finishWithError(`Unknown error adding tracker`);
            return;
        }
        instance.finish('done', newTracker);
    }


    instance.registerFunctions({activate});

    return instance;

}


