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
export const NAME = "EthersTransfer";
export const VERSION = "0.0.0";

export const API_PARAM_INDEX = 0;
export const TOKEN_ADDRESS_PARAM_INDEX = 1;
export const TO_ADDRESS_PARAM_INDEX = 2;
export const QUANTITY_PARAM_INDEX = 3;
export const CUSTOM_GAS_PRICE_PARAM_INDEX = 4;
export const MAX_GAS_PRICE_PARAM_INDEX = 5;
export const NUM_ATTEMPTS_PARAM_INDEX = 6;
export const AUTH_PARAM_INDEX = 7;


export function getDescription(){
    return "todo"
}


export function getTitle(customParameters){
    return "ETHERS TRANSFER";
}


export function getResultKeys(){
    return ['done'];
}



export function getDefaultParameters(){
    return [
        {name: 'api', label: "API", value: null, type: 'select', visible: true, valid: false, options: []}, 
        {name: 'tokenAddress', value: "$t.tokenAddress", type: 'text', visible: true, valid: true}, 
        {name: 'toAddress', value: '', type: 'text', visible: true, valid: false}, 
        {name: 'quantity', value: '0', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'customGasPrice', value: '', type: 'text', visible: true, valid: true, placeholder: 'in gwei, optional'}, 
        {name: 'maxGasPrice', value: '', type: 'text', visible: true, valid: true, placeholder: 'in gwei, optional'}, 
        {name: 'numAttempts', value: '1', type: 'text', visible: true, valid: true, placeholder: ''},
        {name: 'auth', value: null, type: 'select', visible: true, valid: false, key:'ethers-auth'}, 
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
   
}

export async function updateParameterMetaSettings(parameters, changedParameterIndex, {tracker}){
    const parameter = parameters[changedParameterIndex];

    if (parameter.name === 'api'){
        parameters[changedParameterIndex] = await ScriptModuleCommon.handleParameterMetaEthersNetwork(parameter, tracker);
    
    } else if (parameter.name === 'toAddress'){
        parameter.value = parameter.value.trim();
        parameter.valid = (
            ScriptModuleCommon.Util.isValidERC20(parameter.value)
            || ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: false, allowEmpty: false})
        ) 
    
    } else if (parameter.name === 'quantity'){
        parameter.value = ScriptModuleCommon.formatPotentialPercentage(parameter.value);
        parameter.valid = ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: true, allowEmpty: false});
        
    } else if (parameter.name === 'customGasPrice'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: true, allowPercentage: true, allowNegative: false});

    } else if (parameter.name === 'maxGasPrice'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: true, allowPercentage: false, allowNegative: false});
    
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
     
        let toAddress;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[TO_ADDRESS_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            toAddress = stringValue;
            instance.addOutputLine(`To address: ${customParameters[TO_ADDRESS_PARAM_INDEX].value}`);
            for (let i = 0; i < derivationLines.length; ++i){
                instance.addOutputLine(`To address: ${derivationLines[i]}`);
            }

        }


        let {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
            expression: customParameters[QUANTITY_PARAM_INDEX].value,
            allowPercentage: true
        });
        if (error){
            return;
        }
        const quantityIsPercentage = percentageSuffix;
        const quantity = stringValue;
        const p = quantityIsPercentage ? ' % of wallet\'s balance' : '';
        const quantityDerivationLines = [`Quantity = ${customParameters[QUANTITY_PARAM_INDEX].value}`];
        for (let i = 0; i < derivationLines.length; ++i){
            quantityDerivationLines.push(`Quantity = ${derivationLines[i]}${p}`);
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
        }

        const callbackTicket = instance.getManagedCallbackTicket((type, args, ticket) => {
            instance.addOutputLine(args.message);
            return instance.isActive && activationCount === instance.activationCount;
        });
        console.log(customParameters[CUSTOM_GAS_PRICE_PARAM_INDEX])
        const args = {
            endpointName: customParameters[API_PARAM_INDEX].value,
            privateKey: auth.privateKey,
            toAddress,
            tokenAddress,
            quantity: quantity.toString(),
            quantityIsPercentage,
            quantityDerivationLines,
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
                const result = await window.bridge.callBackendFunction(backendIndex, 'transfer', args);
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