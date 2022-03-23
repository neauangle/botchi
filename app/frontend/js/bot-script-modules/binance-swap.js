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
export const NAME = "BinanceSwap";
export const VERSION = "0.0.0";

export const RESTRICT_TO_TRACKER_TYPES = ['binance'];


export const ORDER_PARAM_INDEX = 0;
export const TYPE_PARAM_INDEX = 1;
export const TOKEN_PARAM_INDEX = 2;
export const COMPARATOR_PARAM_INDEX = 3;
export const SPECIFYING_PARAM_INDEX = 4;
export const QUANTITY_PARAM_INDEX = 5;
export const LIMIT_PRICE_PARAM_INDEX = 6;
export const TIME_IN_FORCE_PARAM_INDEX = 7;
export const AUTH_PARAM_INDEX = 8;

export const STATIC_OPTIONS_ORDER = ['Market', 'Limit'];
export const STATIC_OPTIONS_TIME_IN_FORCE = ['GTC (Good Til Cancelled)', 'IOC (Immediate Or Cancel)', 'FOK (Fill Or Kill)'];


export function getDescription(){
    return "Perform a swap using the Binance backend."
}


export function getTitle(customParameters){
    return ScriptModuleCommon.Util.htmlEncode(
        `BINANCE ${customParameters[ORDER_PARAM_INDEX].value.toUpperCase()} ${customParameters[TYPE_PARAM_INDEX].value.split(" ")[0].toUpperCase()}`
    );
}


export function getResultKeys(){
    return ['done'];
}




export function getDefaultParameters(){
    return [
        {name: 'order', value: 'Market', type: 'select', visible: true, valid: true, options: "STATIC_OPTIONS_ORDER"},
        {name: 'type', value:'Buy', type: 'select', visible: true, valid: true, options: ['Buy', 'Sell']}, 
        {name: 'token', value:'$t.tokenSymbol', type: 'text', visible: true, valid: true}, 
        {name: 'comparator', value:'$t.comparatorSymbol', type: 'text', visible: true, valid: true},  
        {name: 'specifyingExact', value: 'Token', type: 'select', visible: true, valid: true, options: ['Token', 'Comparator']}, 
        {name: 'quantity', value: '0', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'price', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'timeInForce', value: 'GTC (Good Til Cancelled)', type: 'select', visible: true, valid: true, options: 'STATIC_OPTIONS_TIME_IN_FORCE'},
        {name: 'auth', value: null, type: 'select', visible: true, valid: false, key:'binance-auth'}, 
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
    updateParameterMetaSettings(parameters, TOKEN_PARAM_INDEX, extraInfo);
}

export function updateParameterMetaSettings(parameters, changedParameterIndex, {outerRowIndex, numOuterRows, tracker, gotoOptions}){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'type'){


    } else if (parameter.name === 'token' || parameter.name === 'comparator'){
        if (parameter.value.indexOf('$') === -1){
            parameter.value = parameter.value.trim().toUpperCase();
        }
        parameter.valid = !!parameter.value; 


        let displayTokenSymbol = parameters[TOKEN_PARAM_INDEX].value;
        let displayComparatorSymbol = parameters[COMPARATOR_PARAM_INDEX].value;
        try {
            const {parsedArray, substitutedString, substitutions} = ScriptModuleCommon.Parser.expressionParser.parse(
                displayTokenSymbol, {}, {}, tracker, gotoOptions, outerRowIndex, true
            );
            displayTokenSymbol = substitutedString;
        } catch { }
        try {
            const {parsedArray, substitutedString, substitutions} = ScriptModuleCommon.Parser.expressionParser.parse(
                displayComparatorSymbol, {}, {}, tracker, gotoOptions, outerRowIndex, true
            );
            displayComparatorSymbol = substitutedString;
        } catch { }

        const oldTypeIndex = parameters[TYPE_PARAM_INDEX].value.startsWith('Buy') ? 0 : 1;
        parameters[TYPE_PARAM_INDEX].options = [`Buy ${displayTokenSymbol}`, `Sell ${displayTokenSymbol}`];
        parameters[TYPE_PARAM_INDEX].value = parameters[TYPE_PARAM_INDEX].options[oldTypeIndex];
        parameters[TYPE_PARAM_INDEX].optionsHaveChanged = true; 

        const oldSpecifyingIndex = parameters[SPECIFYING_PARAM_INDEX].options.indexOf(parameters[SPECIFYING_PARAM_INDEX].value);
        parameters[SPECIFYING_PARAM_INDEX].options = [`${displayTokenSymbol}`, `${displayComparatorSymbol}`];;
        parameters[SPECIFYING_PARAM_INDEX].value = parameters[SPECIFYING_PARAM_INDEX].options[oldSpecifyingIndex];
        parameters[SPECIFYING_PARAM_INDEX].optionsHaveChanged = true;

    } else if (parameter.name === 'quantity'){
        parameter.value = ScriptModuleCommon.formatPotentialPercentage(parameter.value);
        parameter.valid = ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: true, allowEmpty: false});
        
        
    } else if (parameter.name === 'auth'){
        parameter.valid = !!parameter.value;
    } else if (parameter.name === 'price'){
        parameter.valid = ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: false, allowEmpty: false});
    }

    if (parameters[ORDER_PARAM_INDEX].value === 'Limit'){
        parameters[TIME_IN_FORCE_PARAM_INDEX].visible = true;
        parameters[SPECIFYING_PARAM_INDEX].visible = false;
        parameters[LIMIT_PRICE_PARAM_INDEX].visible = true;
    } else {
        parameters[TIME_IN_FORCE_PARAM_INDEX].visible = false;
        parameters[SPECIFYING_PARAM_INDEX].visible = true;
        parameters[LIMIT_PRICE_PARAM_INDEX].visible = false;
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

        const type = customParameters[TYPE_PARAM_INDEX].value.split(" ")[0];
        const order = customParameters[ORDER_PARAM_INDEX].value;
        
        let token;
        let comparator;
        let quantity;
        let quantityDerivationLines;
        let quantityIsPercentage;
        let limitPrice;
        let limitPriceDerivationLines;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[TOKEN_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            token = stringValue;
        }{
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[COMPARATOR_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            comparator = stringValue;
        }{
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[QUANTITY_PARAM_INDEX].value,
                allowPercentage: true,

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
        }{
            if (order === 'Limit'){
                    const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                    expression: customParameters[LIMIT_PRICE_PARAM_INDEX].value,
                    allowPercentage: false
                });
                if (error){
                    return;
                }
                limitPrice = stringValue;
                limitPriceDerivationLines = ['Price = ' + customParameters[LIMIT_PRICE_PARAM_INDEX].value];
                for (let i = 0; i < derivationLines.length; ++i){
                    limitPriceDerivationLines.push('Price = ' + derivationLines[i] + percentageSuffix);
                }
            }
        }
        const specifyingExactOf =  customParameters[SPECIFYING_PARAM_INDEX].options.indexOf(customParameters[SPECIFYING_PARAM_INDEX].value) == 0 ? token : comparator;
        
        const callbackTicket = instance.getManagedCallbackTicket((type, args, ticket) => {
            instance.addOutputLine(args.message);
            return instance.isActive && activationCount === instance.activationCount;
        });
        const args = {
            apiKey: auth.apiKey,
            secretKey: auth.secretKey,
            isTestnet: auth.isTestnet,

            type,
            order,
            specifyingExactOf,
            timeInForce: customParameters[TIME_IN_FORCE_PARAM_INDEX].value.split(" ")[0],

            base: token, 
            quote: comparator,
            currentMarketPrice: priceOnActivation,
            
            quantity: quantity.toString(),
            quantityDerivationLines,
            quantityIsPercentage,

            limitPrice: limitPrice ? limitPrice.toString() : null,
            limitPriceDerivationLines,

            callbackTicket
        }
        const backendIndex = ScriptModuleCommon.getBackendIndex('binance');
        try {
            const result = await window.bridge.callBackendFunction(backendIndex, 'swap', args);
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



