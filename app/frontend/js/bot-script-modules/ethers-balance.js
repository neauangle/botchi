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
export const NAME = "EthersBalance";
export const VERSION = "0.0.0";

export const API_PARAM_INDEX = 0;
export const TOKEN_ADDRESS_PARAM_INDEX = 1;
export const WALLET_ADDRESS_PARAM_INDEX = 2;


export function getTitle(customParameters){
    return "ETHERS BALANCE";
}


export function getResultKeys(){
    return ['done'];
}




export function getDefaultParameters(){
    return [
        {name: 'api', label: "API", value: null, type: 'select', visible: true, valid: false, options: []}, 
        {name: 'tokenAddress', value: "$t.tokenAddress", type: 'text', visible: true, valid: true}, 
        {name: 'walletAddress', value: '', type: 'text', visible: true, valid: false}, 
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
    
}


export async function updateParameterMetaSettings(parameters, changedParameterIndex, {tracker}){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'api'){
        parameters[changedParameterIndex] = await ScriptModuleCommon.handleParameterMetaEthersNetwork(parameter, tracker);
    
    } else if (parameter.name === 'tokenAddress' || parameter.name === 'walletAddress'){
        parameter.value = parameter.value.trim();
        parameter.valid = (
            ScriptModuleCommon.Util.isValidERC20(parameter.value)
            || ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: false, allowEmpty: false})
        )         
    } 
}


export function getInstance(customParameters){

    const instance = ScriptModuleCommon.getModuleInstance();

    const activate = async function(priceOnActivation, taskRowIndex, rowResults, localVariabless, tracker){
        const activationCount = instance.activationCount;

        let walletAddress;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[WALLET_ADDRESS_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                console.log(error);
                return;
            }
            
            walletAddress = stringValue;
            instance.addOutputLine(`Wallet address: ${customParameters[WALLET_ADDRESS_PARAM_INDEX].value}`);
            for (let i = 0; i < derivationLines.length; ++i){
                instance.addOutputLine(`Wallet address: ${derivationLines[i]}`);
            }
        }

        let tokenAddress;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[TOKEN_ADDRESS_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                console.log(error);
                return;
            }
            tokenAddress = stringValue;
        }
        

        const callbackTicket = instance.getManagedCallbackTicket((type, args, ticket) => {
            instance.addOutputLine(args.message);
            return instance.isActive && activationCount === instance.activationCount;
        });
        const args = {
            callbackTicket,
            tokenAddress,
            walletAddress,
            endpointName: customParameters[API_PARAM_INDEX].value
        }

        const backendIndex = ScriptModuleCommon.getBackendIndex('ethers');
        try {
            const result = await window.bridge.callBackendFunction(backendIndex, 'getBalance', args);
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



