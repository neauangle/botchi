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
export const NAME = "EthersLiquidity";
export const VERSION = "0.0.0";

export const TYPE_PARAM_INDEX = 0;
export const TOKEN_QUANTITY_PARAM_INDEX = 1;
export const LIQUIDITY_QUANTITY_PARAM_INDEX = 2;
export const MIN_ETH_RESERVED_PARAM_INDEX = 3;
export const SLIPPAGE_PARAM_INDEX = 4;
export const CUSTOM_GAS_PRICE_PARAM_INDEX = 5;
export const MAX_GAS_PRICE_PARAM_INDEX = 6;
export const TIMEOUT_PARAM_INDEX = 7;
export const NUM_ATTEMPTS_PARAM_INDEX = 8;
export const AUTH_PARAM_INDEX = 9;

export const STATIC_OPTIONS_TYPE = ['Add', 'Remove'];

export const RESTRICT_TO_TRACKER_TYPES = ['ethers'];

export function getDescription(){
    return "Add liquidity using the ethers backend."
}


export function getTitle(customParameters){
    return "ETHERS " + customParameters[TYPE_PARAM_INDEX].value.toUpperCase() + " LIQUIDITY";
}


export function getResultKeys(){
    return ['done'];
}




export function getDefaultParameters(){
    return [
        {name: 'type', value:'Add', type: 'select', visible: true, valid: true, options:'STATIC_OPTIONS_TYPE'}, 
        {name: 'tokenQuantity', value: '0', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'liquidityQuantity', value: '0', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'minEthReserved', value: '0', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'slippage', value: '1%', type: 'text', visible: true, valid: true, placeholder: ''},
        {name: 'customGasPrice', value: '', type: 'text', visible: true, valid: true, placeholder: 'in gwei, optional'}, 
        {name: 'maxGasPrice', value: '', type: 'text', visible: true, valid: true, placeholder: 'in gwei, optional'}, 
        {name: 'timeoutSecs', value: '60', type: 'text', visible: true, valid: true, placeholder: ''},
        {name: 'numAttempts', value: '1', type: 'text', visible: true, valid: true, placeholder: ''},
        {name: 'auth', value: null, type: 'select', visible: true, valid: false, key:'ethers-auth'}, 
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
   
}


export async function updateParameterMetaSettings(parameters, changedParameterIndex, {tracker}){
    const parameter = parameters[changedParameterIndex];

    if (parameter.name === 'type'){
        parameters[TOKEN_QUANTITY_PARAM_INDEX].visible = parameter.value === 'Add';
        parameters[MIN_ETH_RESERVED_PARAM_INDEX].visible = parameter.value === 'Add';
        parameters[LIQUIDITY_QUANTITY_PARAM_INDEX].visible = parameter.value === 'Remove';

    
    } else if (parameter.name === 'tokenQuantity' || parameter.name === 'liquidityQuantity'){
        parameter.valid =ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: true, allowEmpty: false});
        parameter.value = ScriptModuleCommon.formatPotentialPercentage(parameter.value);

    } else if (parameter.name === 'minEthReserved'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: false, allowPercentage: false, allowNegative: false});

    } else if (parameter.name === 'slippage'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: false, allowPercentage: true, allowNegative: false});
        parameter.value = ScriptModuleCommon.formatForcePercentage(parameter.value);
    
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

        const type = customParameters[TYPE_PARAM_INDEX].value;
     
        let tokenQuantity;
        let liquidityQuantity;
        let quantityIsPercentage;
        let quantityDerivationLines;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: type === 'Add' ? customParameters[TOKEN_QUANTITY_PARAM_INDEX].value : customParameters[LIQUIDITY_QUANTITY_PARAM_INDEX].value,
                allowPercentage: true
            });
            if (error){
                return;
            }

            quantityIsPercentage = !!percentageSuffix;
            if ( type === 'Add'){
                tokenQuantity = stringValue;
                quantityDerivationLines= [`Token quantity = ${customParameters[TOKEN_QUANTITY_PARAM_INDEX].value}`];
                const p = quantityIsPercentage ? ' % of wallet\'s tokens' : '';
                for (let i = 0; i < derivationLines.length; ++i){
                    quantityDerivationLines.push(`Token quantity = ${derivationLines[i]}${p}`);
                }
            } else {
                liquidityQuantity = stringValue;
                quantityDerivationLines= [`Liquidity quantity = ${customParameters[LIQUIDITY_QUANTITY_PARAM_INDEX].value}`];
                const p = quantityIsPercentage ? ' % of liquidity' : '';
                for (let i = 0; i < derivationLines.length; ++i){
                    quantityDerivationLines.push(`Liquidity quantity = ${derivationLines[i]}${p}`);
                }
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
            tokenQuantity,
            liquidityQuantity,
            quantityDerivationLines,
            quantityIsPercentage,
            minEthReserved:  customParameters[MIN_ETH_RESERVED_PARAM_INDEX].value,
            slippagePercent: customParameters[SLIPPAGE_PARAM_INDEX].value.slice(0, -1).trim(),
            timeoutSecs: customParameters[TIMEOUT_PARAM_INDEX].value,
            customGasPriceStringGwei: customParameters[CUSTOM_GAS_PRICE_PARAM_INDEX].value,
            maxGasPriceStringGwei: customParameters[MAX_GAS_PRICE_PARAM_INDEX].value,
            callbackTicket
        }

        const backendIndex = ScriptModuleCommon.getBackendIndex('ethers');
        const numAttempts = Number(customParameters[NUM_ATTEMPTS_PARAM_INDEX].value);
        let attemptNumber = 0;
        while (attemptNumber < numAttempts){
            attemptNumber += 1;
            instance.addOutputLine(`Attempt: ${attemptNumber} / ${numAttempts}`);
            try {
                const result = await window.bridge.callBackendFunction(backendIndex, 'addOrRemoveliquidity', args);
                if (activationCount === instance.activationCount){
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


