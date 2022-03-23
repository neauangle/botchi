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
export const NAME = "BinanceWithdraw";
export const VERSION = "0.0.0";

const NETWORK_PARAM_INDEX = 0;
const TOKEN_PARAM_INDEX = 1;
const QUANTITY_PARAM_INDEX = 2;
const WALLET_ADDRESS_PARAM_INDEX = 3;
const AWAIT_CONFIRM_PARAM_INDEX = 4;
const CONFIRM_TIMEOUT_SECS_PARAM_INDEX = 5;
const AUTH_PARAM_INDEX = 6;



export function getDescription(){
    return "Todo"
}


export function getTitle(customParameters){
    return `BINANCE WITHDRAW`;
}


export function getResultKeys(){
    return ['done'];
}



export function getDefaultParameters(){
    return [
        {name: 'network', value: '', type: 'text', visible: true, valid: false, placeholder: 'e.g. ETH, FTM (leave blank to use default)'}, 
        {name: 'token', value: '$t.tokenSymbol', type: 'text', visible: true, valid: true},
        {name: 'quantity', value: '0', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'toAddress', value: '', type: 'text', visible: true, valid: false}, 
        {name: 'awaitConfirm', value: true, type: 'boolean', visible: true, valid: true}, 
        {name: 'confirmTimeoutSecs', value: '120', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'auth', value: null, type: 'select', visible: true, valid: false, key:'binance-auth'}, 
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
    
}


export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'network'){
        const trimmed = parameter.value.trim();
        parameter.value = trimmed;
        parameter.valid = true; // '' means default -> set undefined in args
    
    } else if (parameter.name === 'token'){
        if (parameter.value.indexOf('$') >= 0){
            parameter.value = parameter.value.trim();
        } else {
            parameter.value = parameter.value.trim().toUpperCase();
        }
        parameter.valid = !!parameter.value; 
    
    } else if (parameter.name === 'quantity'){
        parameter.valid = ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: true, allowEmpty: false});
        parameter.value = ScriptModuleCommon.formatPotentialPercentage(parameter.value);

    } else if (parameter.name === 'toAddress'){
        parameter.value = parameter.value.trim();
        parameter.valid = (
            ScriptModuleCommon.Util.isValidERC20(parameter.value)
            || ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: false, allowEmpty: false})
        ) 
    
    } else if (parameter.name === 'awaitConfirm'){
        parameters[CONFIRM_TIMEOUT_SECS_PARAM_INDEX].visible = parameter.value;

    } else if (parameter.name === 'confirmTimeoutSecs'){
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
  

        const network = customParameters[NETWORK_PARAM_INDEX].value ? customParameters[NETWORK_PARAM_INDEX].value : undefined;

        let tokenSymbol;
        let walletAddress;
        let quantity;
        let quantityDerivationLines;
        let quantityIsPercentage;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[TOKEN_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            tokenSymbol = stringValue;
        }{
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[WALLET_ADDRESS_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            walletAddress = stringValue;
            instance.addOutputLine(`Wallet address: ${customParameters[WALLET_ADDRESS_PARAM_INDEX].value}`);
            for (let i = 0; i < derivationLines.length; ++i){
                instance.addOutputLine(`Wallet address: ${derivationLines[i]}`);
            }
        }{
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[QUANTITY_PARAM_INDEX].value,
                allowPercentage: true
            });
            if (error){
                return;
            }
            quantity = stringValue;
            quantityDerivationLines= ['Quantity = ' + customParameters[QUANTITY_PARAM_INDEX].value];
            for (let i = 0; i < derivationLines.length; ++i){
                quantityDerivationLines.push('Quantity = ' + derivationLines[i] + percentageSuffix);
            }
            quantityIsPercentage = percentageSuffix;
        }
        
        const callbackTicket = instance.getManagedCallbackTicket((type, args, ticket) => {
            instance.addOutputLine(args.message);
            return instance.isActive && activationCount === instance.activationCount;
        });
        const args = {
            apiKey: auth.apiKey,
            secretKey: auth.secretKey,
            isTestnet: auth.isTestnet,
            network,
            tokenSymbol,
            walletAddress,
            quantity,
            quantityIsPercentage,
            quantityDerivationLines,
            awaitUntilComplete: customParameters[AWAIT_CONFIRM_PARAM_INDEX].value,
            awaitWithdrawTimeoutSecs: customParameters[CONFIRM_TIMEOUT_SECS_PARAM_INDEX].value,
            callbackTicket
        }
        const backendIndex = ScriptModuleCommon.getBackendIndex('binance');
        try {
            const result = await window.bridge.callBackendFunction(backendIndex, 'withdraw', args);
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



