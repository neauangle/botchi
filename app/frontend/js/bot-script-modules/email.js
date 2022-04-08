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

export const NAME = "Email";
export const VERSION = "0.0.0";

export const BLOCK_PARAM_INDEX = 0;
export const TO_PARAM_INDEX = 1;
export const SUBJECT_PARAM_INDEX = 2;
export const TEXT_PARAM_INDEX = 3;
export const AUTH_PARAM_INDEX = 4;


export function getTitle(customParameters){
    return "EMAIL";
}


export function getResultKeys(){
    return ['done'];
}


export function getDefaultParameters(){
    return [
        {name: 'isBlocking', value: false, type: 'boolean', visible: true, valid: true}, 
        {name: 'to', value: '', type: 'text', visible: true, valid: false, placeholder: ''}, 
        {name: 'subject', value: '', type: 'text', visible: true, valid: false, placeholder: ''},
        {name: 'text', value: '', type: 'textArea', visible: true, valid: false, placeholder: ''}, 
        {name: 'auth', value: null, type: 'select', visible: true, valid: false, key:'email-auth'},
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
    
}


export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'to'){
        parameter.value = parameter.value.trim();
        parameter.valid = ScriptModuleCommon.Util.isProbablyValidEmail(parameter.value);
    } else if (parameter.name === 'subject' || parameter.name === 'text'){
        parameter.value = parameter.value.trim();
        parameter.valid = !!parameter.value; 
    } else if (parameter.name === 'auth'){
        parameter.valid = !!parameter.value;
    }
}



export function getInstance(customParameters){
    let auth;

    const instance = ScriptModuleCommon.getModuleInstance();

    const init = function(){
        auth = ScriptModuleCommon.getValueFromDatabase('email-auth', customParameters[AUTH_PARAM_INDEX].value);
    }

    const activate = async function(priceOnActivation, outerRowIndex, rowResults, localVariabless, tracker){
        const activationCount = instance.activationCount;
        if (!auth){
            instance.finishWithError("No valid email auth selected");
            return;
        }

        const isBlocking = customParameters[BLOCK_PARAM_INDEX].value;

        let to;
        let subject;
        let text;
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[TO_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            to = stringValue;
        }
        {
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[SUBJECT_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            subject = stringValue;
        }{
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[TEXT_PARAM_INDEX].value,
                isText: true
            });
            if (error){
                return;
            }
            text = stringValue;
        }

        if (isBlocking){
            instance.addOutputLine(`Sending {${subject}} to ${to}`);
            try {
                const result = await window.bridge.sendEmail(
                    auth, to, subject, text
                );
                instance.addOutputLine(result);
                if (activationCount === instance.activationCount){
                    instance.finish('done', result);
                }
            } catch (error){
                if (activationCount === instance.activationCount){
                    instance.finishWithError('Error: ' + error);
                }
                return;
            }
        } else {
            window.bridge.sendEmail(auth, to, subject, text);
            instance.addOutputLineSilently(`Sent {${subject}} to ${to}`);
            instance.addOutputLine(`Nonblocking: not awaiting confirmation.`);
            instance.finish('done', 0);
        }
    }

    instance.registerFunctions({init, activate});

    return instance;
}



