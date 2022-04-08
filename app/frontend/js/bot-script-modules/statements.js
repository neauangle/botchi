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

export const NAME = "Statements";
export const VERSION = "0.0.0";

/*
An expression can contain 
    <this info is outdated>
 * literal numbers
 * arithmeitc operators
 * comparison operators
 * "$P" - substituted for current price
 * "$R"<row#>.<parameter> - substituted for the last output of a row (e.g. R3.exitPrice refers to Row 3's last exit price)
    * where <parameter> is RESULT, you can also append .<result_param> to access a value of the result if the result was a dictionary
 * "$t.<parameter>" substitutes token parameters
 * $d{<format_string>} substites the current date formatted with <format_string>
Comparison operators have lowest precedence, and result in 0 (false) or 1 (true).

When an expression is used as the first internal row of a conditional, an evaluation of 0 is false and anything else is true.
 
*/

export const STATEMENTS_PARAM_INDEX = 0;


export function getTitle(customParameters){
    let title = '';
    if (!customParameters[STATEMENTS_PARAM_INDEX].value){
        return "STATEMENTS";
    }
    const lines = customParameters[STATEMENTS_PARAM_INDEX].value.split('\n');
    for (let i = 0; i < lines.length; ++i){
        if (i !== 0){
            title += '<br>';
        }
        title += lines[i];
    }
    return title;
}

export function getResultKeys(){
    return ['false/0', 'true/1'];
}

export function getDefaultParameters(){
    return [
        {name: 'statements', value: '', type: 'textArea', visible: true, valid: false, placeholder: ''},
    ]
}

export function handleTrackerChanged(parameters, extraInfo){
   
}


export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'statements'){
        parameter.value = parameter.value.trim();
        parameter.valid = ScriptModuleCommon.validateStatements(parameter.value);
    } 

}




export function getInstance(customParameters){

    const instance = ScriptModuleCommon.getModuleInstance();

    const activate = async function(priceOnActivation, outerRowIndex, rowResults, localVariables, tracker){
        const {error, result}  = instance.processStatements(customParameters[STATEMENTS_PARAM_INDEX].value);
        if (error){
            return;
        }

        instance.finish(result === '0' || !result ? 'false/0' : 'true/1', result);
    }

    instance.registerFunctions({activate});

    return instance;
    
}

