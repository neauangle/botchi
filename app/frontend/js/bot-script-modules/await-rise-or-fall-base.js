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

export const RESTRICT_TO_TRACKER_TYPES = undefined;


export const TYPE = {
    AWAIT_RISE: "AWAIT_RISE",
    AWAIT_FALL: "AWAIT_FALL"
}

export const TRIGGER_PARAM_INDEX = 0;
export const TIME_SCALE_PARAM_INDEX = 1;


export function getDescription(type){
    let description;
    if (type === TYPE.AWAIT_RISE){
        description = "Blocks until the price rises above (or equal to) the trigger. ";
    } else {
        description = "Blocks until the price falls below (or equal to) the trigger. ";
    }
    description +=  "Percentages are relative to the price on entering this module (otherwise it is just the price value)."
    return description;
}

export function getTitle(type, customParameters){
    let title = '';
    if (customParameters[TRIGGER_PARAM_INDEX].value){
        if (customParameters[TRIGGER_PARAM_INDEX].value.toString().endsWith('%')){
            title += `AWAIT ${type === TYPE.AWAIT_RISE?'↑':'↓'} ${customParameters[TRIGGER_PARAM_INDEX].value}`;
        } else {
            title += `AWAIT ${type === TYPE.AWAIT_RISE?'>=':'<='} ${customParameters[TRIGGER_PARAM_INDEX].value}`;
        }
    }
    if (!title.length){
        title = 'AWAIT INF';
    }
    
    return title;
}


export function getResultKeys(){
    return ['done'];
}

export function getDefaultParameters(type){
    let ret = [];
    if (type == TYPE.AWAIT_RISE){
        ret.push({name: 'riseTrigger', value: '', type: 'text', visible: true, valid: true, placeholder: ''});
    } else {
        ret.push({name: 'fallTrigger', value: '', type: 'text', visible: true, valid: true, placeholder: ''});
    }    
    return ret;    
}

export function handleTrackerChanged(type, parameters, extraInfo){
    
}

export function updateParameterMetaSettings(parameters, changedParameterIndex, extraInfo){
    const parameter =  parameters[changedParameterIndex];
    if (parameter.name === 'riseTrigger' || parameter.name === 'fallTrigger'){
        parameter.value = ScriptModuleCommon.formatPotentialPercentage(parameter.value);  
        parameter.valid = ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: true, allowEmpty: true});
    }
}






export function getInstance(type, customParameters){
    let closestPriceToTriggerSoFar;
    let triggerPrice;

    const instance = ScriptModuleCommon.getModuleInstance();


    const activate = function(priceOnActivation, outerRowIndex, rowResults, localVariables, tracker){
        triggerPrice = type === TYPE.AWAIT_RISE ? Infinity : -Infinity
        closestPriceToTriggerSoFar = null;
        
        if (!priceOnActivation){
            instance.finishWithError("Error: No initial price yet for " + tracker.tokenSymbol);
            return;
        }

        const firstAction = type === TYPE.AWAIT_RISE ? "Rise" : "Fall";

        if (customParameters[TRIGGER_PARAM_INDEX].value){
            const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                expression: customParameters[TRIGGER_PARAM_INDEX].value,
                allowPercentage: true,
            });
            if (error){
                return;
            }
            const value = Number(stringValue);

            instance.addOutputLine(getTitle(type, [{value: customParameters[TRIGGER_PARAM_INDEX].value}]));
            for (const derivationLine of derivationLines){
                instance.addOutputLine('= ' + getTitle(type, [{value: derivationLine + percentageSuffix}]));
            }

            if (percentageSuffix){
                const offset = (value / 100) * priceOnActivation;
                triggerPrice = priceOnActivation + (type === TYPE.AWAIT_RISE ? offset : -offset);
                instance.addOutputLine('= ' + getTitle(type, [{value: triggerPrice}]));
            } else {
                triggerPrice = value;
            }

            instance.addTriggerLine({
                color: ScriptModuleCommon.getNeutralLinecolour(),
                price: triggerPrice,
                lineWidth: 2,
                lineStyle: ScriptModuleCommon.Chart.LineStyle.Solid,
                title: `${firstAction.toLowerCase()} trigger`
            });
        }
    
        instance.addOutputLineSilently('');
        
    }


    const updatePrice = function(prices){
        checkTrigger(prices.comparator)
    }

    function checkTrigger(price){
        if (closestPriceToTriggerSoFar === null 
        || (type === TYPE.AWAIT_RISE && price >= closestPriceToTriggerSoFar)
        || (type === TYPE.AWAIT_FALL && price <= closestPriceToTriggerSoFar)){
            closestPriceToTriggerSoFar = price;
        }
        let output = `${ScriptModuleCommon.p(price)} ${type === TYPE.AWAIT_RISE?'>':'<'}= ${ScriptModuleCommon.p(triggerPrice)} ?`;
        if ((type === TYPE.AWAIT_RISE && price >= triggerPrice)
        || (type === TYPE.AWAIT_FALL && price <= triggerPrice)){
            output += ' ✓';
            instance.editOutputLine(undefined, output);
            instance.finish('done', {price: price});
        } else {
            output += ' 🞪';
            instance.editOutputLine(undefined, output);
        }
    }

    instance.registerFunctions({
        activate,
        updatePrice,
    });

    return instance;
}


