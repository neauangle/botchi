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
export const NAME = "EthersEvent";
export const VERSION = "0.0.0";

export const TRACKER_NEUTRAL = true; 

export const API_PARAM_INDEX = 0;
export const CONTRACT_ADDRESS_PARAM_INDEX = 1;
export const ABI_SNIPPET_PARAM_INDEX = 2;



export function getTitle(customParameters){
    if (customParameters[ABI_SNIPPET_PARAM_INDEX].asJson){
        return "ETHERS EVENT " + customParameters[ABI_SNIPPET_PARAM_INDEX].asJson.name;
    } else {
        return "ETHERS EVENT";
    }
}


export function getResultKeys(){
    return ['done'];
}




export function getDefaultParameters(){
    return [
        {name: 'api', label: "API", value: null, type: 'select', visible: true, valid: false, options: []}, 
        {name: 'contract', value: '$t.tokenAddress', type: 'text', visible: true, valid: false, placeholder: ''}, 
        {name: 'ABIFragment', label: "ABI Fragment",  value: '', type: 'text', visible: true, valid: true, placeholder: 'Event fragment'},
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
        console.log(parameter.value,  ScriptModuleCommon.Util.isValidERC20(parameter.value))
        parameter.valid = (
            ScriptModuleCommon.Util.isValidERC20(parameter.value)
            || ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: false, allowEmpty: false})
        ) 

    } else if (parameter.name === 'ABIFragment'){
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
        if (!jsonObject || !jsonObject.inputs || !jsonObject.type || jsonObject.type !== 'event'){
            parameter.valid = false;
            parameter.asJson = null;
        } else {
            parameter.valid = true;
            parameter.asJson = jsonObject;
        }
    } 
}



export function getInstance(customParameters){

    const instance = ScriptModuleCommon.getModuleInstance();


    const activate = async function(priceOnActivation, taskRowIndex, rowResults, localVariabless, tracker){
        const activationCount = instance.activationCount;
        
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

        const callbackTicket = instance.getManagedCallbackTicket((type, args, ticket) => {
            instance.addOutputLine(args.message);
            return instance.isActive && activationCount === instance.activationCount;
        });
        const args = {
            contractAddress,
            endpointName: customParameters[API_PARAM_INDEX].value,
            abiFragment: customParameters[ABI_SNIPPET_PARAM_INDEX].value,
            callbackTicket
        }
        const backendIndex = ScriptModuleCommon.getBackendIndex('ethers');
        try {
            const result = await window.bridge.callBackendFunction(backendIndex, 'generalContractWait', args);
            if (activationCount === instance.activationCount){
                instance.finish('done', result);
            }
        } catch (error) {
            if (activationCount === instance.activationCount){
                instance.finishWithError(error);
            }
        }        
    }

    instance.registerFunctions({activate});

    return instance;

}




