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
export const NAME = "EthersCall";
export const VERSION = "0.0.0";

export const API_PARAM_INDEX = 0;
export const CONTRACT_ADDRESS_PARAM_INDEX = 1;
export const NUM_ATTEMPTS_PARAM_INDEX = 2;
export const ABI_SNIPPET_PARAM_INDEX = 3;
export const ARG_0_PARAM_INDEX = 4;
export const ARG_1_PARAM_INDEX = 5;
export const ARG_2_PARAM_INDEX = 6;
export const ARG_3_PARAM_INDEX = 7;
export const ARG_4_PARAM_INDEX = 8;
export const ARG_5_PARAM_INDEX = 9;
export const ARG_6_PARAM_INDEX = 10;
export const ARG_7_PARAM_INDEX = 11;
export const ARG_8_PARAM_INDEX = 12;
export const ARG_9_PARAM_INDEX = 13;
export const AUTH_PARAM_INDEX = 14;
export const CUSTOM_GAS_PRICE_PARAM_INDEX = 15;
export const MAX_GAS_PRICE_PARAM_INDEX = 16;
export const VALUE_FIELD_PARAM_INDEX = 17;

export function getDescription(){
    return "todo"
}


export function getTitle(customParameters){
    if (customParameters[ABI_SNIPPET_PARAM_INDEX].asJson){
        return "ETHERS CALL " + customParameters[ABI_SNIPPET_PARAM_INDEX].asJson.name;
    } else {
        return "ETHERS CALL";
    }
}


export function getResultKeys(){
    return ['done'];
}




export function getDefaultParameters(){
    return [
        {name: 'api', label: "API", value: null, type: 'select', visible: true, valid: false, options: []}, 
        {name: 'contract', value: '$t.tokenAddress', type: 'text', visible: true, valid: false, placeholder: ''}, 
        {name: 'numAttempts', value: '1', type: 'text', visible: true, valid: true, placeholder: ''},
        {name: 'ABIFragment', label: "ABI Fragment",  value: '', type: 'text', visible: true, valid: true, placeholder: 'Function fragment'},
        {name: 'arg0', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'arg1', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'arg2', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'arg3', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'arg4', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'arg5', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'arg6', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'arg7', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'arg8', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'arg9', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
        {name: 'auth', value: null, type: 'select', visible: true, valid: true, key:'ethers-auth', allowNull: true}, 
        {name: 'customGasPrice', value: '', type: 'text', visible: true, valid: true, placeholder: 'in gwei, optional'}, 
        {name: 'maxGasPrice', value: '', type: 'text', visible: true, valid: true, placeholder: 'In gwei, optional'}, 
        {name: 'valueField', value: '', type: 'text', visible: true, valid: true, placeholder: '(Optional)'},
    ];
}

export function handleTrackerChanged(parameters, extraInfo){

}

export async function updateParameterMetaSettings(parameters, changedParameterIndex, {tracker}){
    const parameter = parameters[changedParameterIndex];

    if (parameter.name === 'api'){
        parameters[changedParameterIndex] = await ScriptModuleCommon.handleParameterMetaEthersNetwork(parameter, tracker);
    
    } else if (parameter.name === 'contract'){
        parameter.value = parameter.value.trim();
        parameter.valid = (
            ScriptModuleCommon.Util.isValidERC20(parameter.value)
            || ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: false, allowEmpty: false})
        ) 

    } else if (parameter.name === 'numAttempts'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: false, allowPercentage: false, allowNegative: false, allow0: false});

    } else if (parameter.name === 'ABIFragment'){
        let args = null;
        let jsonObject;
        try {
            const backendIndex = ScriptModuleCommon.getBackendIndex('ethers');
            jsonObject = await window.bridge.callBackendFunction(backendIndex, 'getAbiAsJson', parameter.value.trim());
            if (!jsonObject){
                throw 'Incorrect json';
            }
            if (jsonObject.length !== 1){
                throw 'Incorrect number of ABI fragments';
            }
            jsonObject = jsonObject[0];
        } catch (error){
            console.log(error);
        }
        if (!jsonObject || !jsonObject.inputs || !jsonObject.type || jsonObject.type !== 'function'){
            parameter.valid = false;
            parameter.asJson = null;
        } else {
            parameter.valid = true;
            parameter.asJson = jsonObject;
            args = jsonObject.inputs;
        }
       
        let argNum = 0;
        
        for (let i = ARG_0_PARAM_INDEX; i <= ARG_9_PARAM_INDEX; ++i){
            if (args && argNum < args.length){
                parameters[i].visible = true;
                parameters[i].placeholder = `${args[argNum].name} (${args[argNum].type})`;
            } else {
                parameters[i].visible = false;
            }
            argNum += 1;
        }

    } else if (parameter.name.startsWith('arg')){
        parameter.valid = true;
    }
    
    else if (parameter.name === 'auth'){
        //no auth we will call it using the ordinary endpointJS provider (can do reads)
        parameter.valid = true;
        parameters[MAX_GAS_PRICE_PARAM_INDEX].visible = !!parameter.value;
        parameters[CUSTOM_GAS_PRICE_PARAM_INDEX].visible = !!parameter.value;
        parameters[VALUE_FIELD_PARAM_INDEX].visible = !!parameter.value;
        
    } else if (parameter.name === 'customGasPrice'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: true, allowPercentage: true, allowNegative: false});

    } else if (parameter.name === 'maxGasPrice'){
        parameter.valid = ScriptModuleCommon.validateNumber({expression: parameter.value, allowEmpty: true, allowPercentage: false, allowNegative: false});

    } else if (parameter.name === 'valueField'){
        parameter.value = parameter.value.trim();
        parameter.valid = parameter.value === "" || ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: false, allowEmpty: false});
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
            instance.addOutputLine("Calling without auth...");
        }
        let contractAddress;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[CONTRACT_ADDRESS_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            instance.addOutputLine(`Contract address: ${customParameters[CONTRACT_ADDRESS_PARAM_INDEX].value}`);
            for (let i = 0; i < derivationLines.length; ++i){
                instance.addOutputLine(`Contract address: ${derivationLines[i]}`);
            }
            contractAddress = stringValue;
        }

        let valueField;
        if (customParameters[VALUE_FIELD_PARAM_INDEX].visible && customParameters[VALUE_FIELD_PARAM_INDEX].value !== ''){
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[VALUE_FIELD_PARAM_INDEX].value
            });
            if (error){
                return;
            }
            instance.addOutputLine(`Value field = ${customParameters[VALUE_FIELD_PARAM_INDEX].value}`);
            for (let i = 0; i < derivationLines.length; ++i){
                instance.addOutputLine(`= ${derivationLines[i]}`);
            }
            valueField = stringValue;
        }
     
        const functionArgsDerivedValues = [];
        for (let i = ARG_0_PARAM_INDEX; i <= ARG_9_PARAM_INDEX; ++i){
            if (customParameters[i].visible){
                const functionArgDerivedValues = [customParameters[i].value];
                const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                    expression: customParameters[i].value,
                    isText: true
                });
                if (error){
                    return;
                }
                for (const derivationLine of derivationLines){
                    functionArgDerivedValues.push(derivationLine);
                }

                

                functionArgsDerivedValues.push(functionArgDerivedValues)
            } 
        }

        const callbackTicket = instance.getManagedCallbackTicket((type, args, ticket) => {
            instance.addOutputLine(args.message);
            return instance.isActive && activationCount === instance.activationCount;
        });
        
        const args = {
            endpointName: customParameters[API_PARAM_INDEX].value,
            privateKey: auth ? auth.privateKey : null,
            contractAddress,
            customGasPriceStringGwei: customParameters[CUSTOM_GAS_PRICE_PARAM_INDEX].value,
            maxGasPriceStringGwei: customParameters[MAX_GAS_PRICE_PARAM_INDEX].value,
            valueField,
            abiFragment: customParameters[ABI_SNIPPET_PARAM_INDEX].value,
            functionArgsDerivedValues,
            callbackTicket
        }
        const numAttempts = Number(customParameters[NUM_ATTEMPTS_PARAM_INDEX].value);
        const backendIndex = ScriptModuleCommon.getBackendIndex('ethers');
        let attemptNumber = 0;
        while (attemptNumber < numAttempts){
            attemptNumber += 1;
            instance.addOutputLine(`Attempt: ${attemptNumber} / ${numAttempts}`);
            try {
                const result = await window.bridge.callBackendFunction(backendIndex, 'generalContractCall', args);
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



