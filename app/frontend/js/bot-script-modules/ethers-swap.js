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
export const NAME = "EthersSwap";
export const VERSION = "0.0.0";


/*
    buy + swapExactTokensForTokens: we're buying as much token as we can with an exact quantity of comparator.
    buy + swapTokensForExactTokens: we're buying an exact amount of token with as few comparator as possible.
    sell + swapExactTokensForTokens: we're selling an exact amount of token for as much comparator as we can.
    sell + swapTokensForExactTokens: we're selling as little token as possible for an exact amount of comparator.
*/

export const RESTRICT_TO_TRACKER_TYPES = ['ethers'];



export const TYPE_PARAM_INDEX = 0;
export const METHOD_PARAM_INDEX = 1;
export const QUANTITY_PARAM_INDEX = 2;
export const SLIPPAGE_PARAM_INDEX = 3;
export const CUSTOM_GAS_PRICE_PARAM_INDEX = 4;
export const MAX_GAS_PRICE_PARAM_INDEX = 5;
export const TIMEOUT_PARAM_INDEX = 6;
export const NUM_ATTEMPTS_PARAM_INDEX = 7;
export const AUTH_PARAM_INDEX = 8;

export const STATIC_OPTIONS_TYPE = ['Buy', 'Sell'];


export function getTitle(customParameters){
    return "ETHERS " + customParameters[TYPE_PARAM_INDEX].value.toUpperCase();
}


export function getResultKeys(){
    return ['done'];
}




export function getDefaultParameters(){
    return [
        {name: 'type', value:'Buy', type: 'select', visible: true, valid: true, options: 'STATIC_OPTIONS_TYPE'}, 
        {name: 'specifying', value: 'swapExactTokensForTokens', type: 'select', visible: true, valid: true, options: ['swapExactTokensForTokens', 'swapTokensForExactTokens']}, 
        {name: 'quantity', value: '0', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'slippage', value: '1%', type: 'text', visible: true, valid: true, placeholder: ''},
        {name: 'customGasPrice', value: '', type: 'text', visible: true, valid: true, placeholder: 'in gwei, optional'}, 
        {name: 'maxGasPrice', value: '', type: 'text', visible: true, valid: true, placeholder: 'in gwei, optional'}, 
        {name: 'timeoutSecs', value: '60', type: 'text', visible: true, valid: true, placeholder: ''},
        {name: 'numAttempts', value: '1', type: 'text', visible: true, valid: true, placeholder: ''},
        {name: 'auth', value: null, type: 'select', visible: true, valid: false, key:'ethers-auth'}, 
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
    parameters[TYPE_PARAM_INDEX].options = [`Buy ${extraInfo.tracker.tokenSymbol}`, `Sell ${extraInfo.tracker.tokenSymbol}`];
    if (parameters[TYPE_PARAM_INDEX].value.startsWith('Buy')){
        parameters[TYPE_PARAM_INDEX].value = parameters[TYPE_PARAM_INDEX].options[0];
    } else {
        parameters[TYPE_PARAM_INDEX].value = parameters[TYPE_PARAM_INDEX].options[1];
    }
    parameters[TYPE_PARAM_INDEX].optionsHaveChanged = true;
    updateParameterMetaSettings(parameters, TYPE_PARAM_INDEX, extraInfo);
}


export function updateParameterMetaSettings(parameters, changedParameterIndex, extraInfo){
    const parameter = parameters[changedParameterIndex];

    if (parameter.name === 'type'){
        if (!extraInfo.tracker){
            return;
        }
        const tracker = extraInfo.tracker;
        let newOptions;
        if (parameter.value.startsWith('Buy')){
            newOptions = [`Exact ${tracker.comparatorSymbol}`, `Exact ${tracker.tokenSymbol}`];
        } else {
            newOptions = [`Exact ${tracker.tokenSymbol}`, `Exact ${tracker.comparatorSymbol}`];
        }
        const oldIndex = parameters[METHOD_PARAM_INDEX].options.indexOf(parameters[METHOD_PARAM_INDEX].value);
        parameters[METHOD_PARAM_INDEX].options = newOptions;
        parameters[METHOD_PARAM_INDEX].value = newOptions[oldIndex];
        parameters[METHOD_PARAM_INDEX].optionsHaveChanged = true;


    } else if (parameter.name === 'quantity'){
        parameter.value = ScriptModuleCommon.formatPotentialPercentage(parameter.value);
        parameter.valid =ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: true, allowEmpty: false});
        

    } else if (parameter.name === 'slippage'){
        parameter.value = ScriptModuleCommon.formatForcePercentage(parameter.value);
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: false, allowPercentage: true, allowNegative: false});
        
    } else if (parameter.name === 'customGasPrice'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: true, allowPercentage: true, allowNegative: false});

    } else if (parameter.name === 'maxGasPrice'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: true, allowPercentage: false, allowNegative: false});
    
    } else if (parameter.name === 'timeoutSecs'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: false, allowPercentage: false, allowNegative: false});
    
    } else if (parameter.name === 'numAttempts'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: false, allowPercentage: false, allowNegative: false, allow0: false});

    } else if (parameter.name === 'auth'){
        parameter.valid = !!parameter.value;
    }
}


export function getInstance(customParameters){
    let auth;

    const instance = ScriptModuleCommon.getModuleInstance();

    const init = function(){
        auth = ScriptModuleCommon.getValueFromDatabase('ethers-auth', customParameters[AUTH_PARAM_INDEX].value);
    }

    const activate = async function(priceOnActivation, taskRowIndex, rowResults, localVariabless, tracker){
        const activationCount = instance.activationCount;
        if (!auth){
            instance.finishWithError("No valid ethers auth selected");
            return;
        }

        const methodIndex = customParameters[METHOD_PARAM_INDEX].options.indexOf(customParameters[METHOD_PARAM_INDEX].value);
        const method = methodIndex === 0 ? 'swapExactTokensForTokens' : 'swapTokensForExactTokens';
        const type = customParameters[TYPE_PARAM_INDEX].value.split(" ")[0];
        let exactSymbol;
        if (type === 'Buy' && method === 'swapExactTokensForTokens'
        || type === 'Sell' && method === 'swapTokensForExactTokens'){
            exactSymbol = tracker.comparatorSymbol;
        } else {
            exactSymbol = tracker.tokenSymbol;
        }

        let quantity;
        let quantityIsPercentage;
        let quantityDerivationLines;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[QUANTITY_PARAM_INDEX].value,
                allowPercentage: true
            });
            if (error){
                return;
            }
            quantity = stringValue;
            quantityIsPercentage = percentageSuffix;
            quantityDerivationLines= [`Exact quantity = ${customParameters[QUANTITY_PARAM_INDEX].value}`];
            const p = quantityIsPercentage ? ' % of wallet\'s' : '';
            for (let i = 0; i < derivationLines.length; ++i){
                quantityDerivationLines.push(`Exact quantity = ${derivationLines[i]}${p} ${exactSymbol}`);
            }
        }

        const callbackTicket = instance.getManagedCallbackTicket((type, args, ticket) => {
            instance.addOutputLine(args.message);
            return instance.isActive && activationCount === instance.activationCount;
        });
        const args = {
            id: tracker.id,
            privateKey: auth.privateKey,
            type,
            method,
            quantity: quantity.toString(),
            quantityIsPercentage,
            priceInComparator: priceOnActivation,
            slippagePercent: customParameters[SLIPPAGE_PARAM_INDEX].value.slice(0, -1).trim(),
            timeoutSecs: customParameters[TIMEOUT_PARAM_INDEX].value,
            customGasPriceStringGwei: customParameters[CUSTOM_GAS_PRICE_PARAM_INDEX].value,
            maxGasPriceStringGwei: customParameters[MAX_GAS_PRICE_PARAM_INDEX].value,
            quantityDerivationLines,
            callbackTicket
        }

        const backendIndex = ScriptModuleCommon.getBackendIndex('ethers');
        const numAttempts = Number(customParameters[NUM_ATTEMPTS_PARAM_INDEX].value);
        let attemptNumber = 0;
        while (attemptNumber < numAttempts){
            attemptNumber += 1;
            instance.addOutputLine(`Attempt: ${attemptNumber} / ${numAttempts}`);
            try {
                const result = await window.bridge.callBackendFunction(backendIndex, 'swap', args);
                if (instance.activationCount){
                    instance.finish('done', result);
                }
                return;
            } catch (error) {
                if (activationCount === instance.activationCount){
                    if (attemptNumber === numAttempts || !instance.isActive){
                        instance.finishWithError(error);
                        return;
                    } else {
                        instance.addOutputLine(`Error: ${error}`);
                    } 
                } else {
                    return;
                }
            }        
        }
    }

    instance.registerFunctions({init, activate});

    return instance;

}


