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

const MINIMUM_PARAM_INDEX = 0;
const THEN_TRIGGER_PARAM_INDEX = 1;
const THEN_PERCENT_OF_INDEX = 2;

export const TYPE = {
    AWAIT_FALL_THEN_RISE: "AWAIT_FALL_THEN_RISE",
    AWAIT_RISE_THEN_FALL: "AWAIT_RISE_THEN_FALL"
}

export const STATIC_OPTIONS_FALL_PERCENT_OF = ['Delta (change)', 'Price'];


export function getTitle(type, customParameters){
    if (!customParameters[MINIMUM_PARAM_INDEX].value || !customParameters[THEN_TRIGGER_PARAM_INDEX].value){
        return 'AWAIT ---';
    }
    const symbols = type == TYPE.AWAIT_FALL_THEN_RISE ? ['↓', '↑'] : ['↑', '↓'];
    return `${symbols[0]} ${customParameters[MINIMUM_PARAM_INDEX].value} TRAIL ${symbols[1]} ${customParameters[THEN_TRIGGER_PARAM_INDEX].value}`;
}



export function getDefaultParameters(type){
    //it doesn't matter whhat the second option of percentOf is, because we only check whether it's delta or not.
    if (type == TYPE.AWAIT_FALL_THEN_RISE){
        return [
            {name: 'minimumFall', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
            {name: 'thenRise', value: '', type: 'text', visible: true, valid: true, placeholder: ''},
            {name: 'risePercentOf', value: 'Delta (change)', type: 'select', visible: true, valid: true, options: 'STATIC_OPTIONS_FALL_PERCENT_OF'},
        ];
    } else {
        return [
            {name: 'minimumRise', value: '', type: 'text', visible: true, valid: true, placeholder: ''}, 
            {name: 'thenFall', value: '', type: 'text', visible: true, valid: true, placeholder: ''},
            {name: 'fallPercentOf', value: 'Delta (change)', type: 'select', visible: true, valid: true, options: 'STATIC_OPTIONS_FALL_PERCENT_OF'},
        ];
    }
}

export function handleTrackerChanged(type, parameters, extraInfo){
    
}

export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter =  parameters[changedParameterIndex];
    if (changedParameterIndex === THEN_PERCENT_OF_INDEX){

    } else if (changedParameterIndex === MINIMUM_PARAM_INDEX){
        parameter.value = ScriptModuleCommon.formatPotentialPercentage(parameter.value);
        parameter.valid = ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: true, allowEmpty: true});
        

    }else if (changedParameterIndex === THEN_TRIGGER_PARAM_INDEX){
        parameter.value = ScriptModuleCommon.formatForcePercentage(parameter.value);
        parameter.valid = ScriptModuleCommon.validateExpression({expression: parameter.value, allowPercentage: true, allowEmpty: true});
    }
    
}


export function getResultKeys(){
    return ['done'];
}


export function getInstance(type, customParameters){
    const firstAction = type === TYPE.AWAIT_FALL_THEN_RISE ? "Fall" : "Rise";
    const secondAction = type === TYPE.AWAIT_FALL_THEN_RISE ? "Rise" : "Fall";
        
    let mostExtremePricesAfterInitialTrigger;

    let usingPercentOfDelta;
    let priceOnActivation;

    const triggerIndex = type === TYPE.AWAIT_FALL_THEN_RISE ? 0 : 1;
    let initialTrigger;
    const initialOp = type === TYPE.AWAIT_FALL_THEN_RISE ? '<=' : '>=';
    let hasHitInitialTrigger = false;

    let thenFraction = null;
    const thenTriggerIndex = type === TYPE.AWAIT_FALL_THEN_RISE ? 1 : 0;
    let thenTriggers;
    const thenOp = type === TYPE.AWAIT_FALL_THEN_RISE ? '>=' : '<=';

    let outputIndexBase;

    const instance = ScriptModuleCommon.getModuleInstance();

    const init = function(){
        usingPercentOfDelta = customParameters[THEN_PERCENT_OF_INDEX].value === STATIC_OPTIONS_FALL_PERCENT_OF[0];
    }
   
    const activate = function(pPriceOnActivation, outerRowIndex, rowResults, localVariables, tracker){
        mostExtremePricesAfterInitialTrigger = null;
        hasHitInitialTrigger = false;
        priceOnActivation = pPriceOnActivation;
        
        if (!priceOnActivation){
            instance.finishWithError("Error: No initial price yet for " + tracker.tokenSymbol);
            return;
        }
        
        outputIndexBase = instance.getOutputLinesLength();

        if (!customParameters[MINIMUM_PARAM_INDEX].value || !customParameters[THEN_TRIGGER_PARAM_INDEX].value){
             instance.finishWithError("Invalid parameters");
            return;
        }

        let isMinimumAPercentage;
        const originalExpressions = [];
        const derivationLineArray = [];
        const parametersEvaluatedArray = [];
        for (let i = 0; i < customParameters.length; ++i){
            originalExpressions.push({value: customParameters[i].value});
            if (i === THEN_PERCENT_OF_INDEX){
                derivationLineArray.push({value: customParameters[i].value});
                parametersEvaluatedArray.push(customParameters[i].value); //select: percent of rise, or percent of delta
            } else {
                const {derivationLines, percentageSuffix, stringValue, error} = instance.getEvaluation({
                    expression: customParameters[i].value,
                    allowPercentage: true,
                });
                if (error){
                    return;
                }
                if (i === MINIMUM_PARAM_INDEX){
                    isMinimumAPercentage = !!percentageSuffix;
                }
                derivationLineArray.push({value: derivationLines.length ? derivationLines[0] + percentageSuffix : customParameters[i].value});
                parametersEvaluatedArray.push({value: Number(stringValue)});
            }
        }

        instance.addOutputLineSilently(getTitle(type, originalExpressions));
        outputIndexBase += 1
        if (originalExpressions[MINIMUM_PARAM_INDEX].value !== derivationLineArray[MINIMUM_PARAM_INDEX].value
        || originalExpressions[THEN_TRIGGER_PARAM_INDEX].value !== derivationLineArray[THEN_TRIGGER_PARAM_INDEX].value){
            instance.addOutputLineSilently('= ' + getTitle(type, derivationLineArray));
            outputIndexBase += 1
        }
      /*   if (derivationLineArray[MINIMUM_PARAM_INDEX].value !== parametersEvaluatedArray[MINIMUM_PARAM_INDEX].value.toString()
        || derivationLineArray[THEN_TRIGGER_PARAM_INDEX].value !== parametersEvaluatedArray[THEN_TRIGGER_PARAM_INDEX].toString()){
            instance.addOutputLineSilently('= ' + getTitle(type, parametersEvaluatedArray));
            outputIndexBase += 1
        } */
        instance.emitOutputLines();

        //we assume price is never negative
        let offset;
        if (isMinimumAPercentage){
            const offset = (parametersEvaluatedArray[MINIMUM_PARAM_INDEX].value / (100)) * priceOnActivation
            initialTrigger = type === TYPE.AWAIT_FALL_THEN_RISE ? priceOnActivation - offset : priceOnActivation + offset;
        } else {
            const offset = parametersEvaluatedArray[MINIMUM_PARAM_INDEX].value;
            initialTrigger = offset;
        }
        
        thenFraction =  (parametersEvaluatedArray[THEN_TRIGGER_PARAM_INDEX].value) / 100;

        instance.addTriggerLine({
            color: ScriptModuleCommon.getNeutralLinecolour(),
            price: initialTrigger,
            lineWidth: 2,
            lineStyle: ScriptModuleCommon.Chart.LineStyle.Solid,
            title: `(1) ${firstAction.toLowerCase()} trigger`
        });

        instance.addOutputLineSilently('');
    }
    
    const opFuncs = {
        '<': (a, b) => a < b,
        '=': (a, b) => a > b,
        '<=': (a, b) => a <= b,
        '>=': (a, b) => a >= b,
    }

    const extremePriceDescriptor = [
        'Lowest price:',
        'Highest price:'
    ]

    const updatePrice = function(prices){
        const price = prices.comparator;

        if (!hasHitInitialTrigger){
            let initialQuestion = `(1) ${ScriptModuleCommon.p(price)} ${initialOp} ${ScriptModuleCommon.p(initialTrigger)} ?`;
            instance.editOutputLineSilently(outputIndexBase, initialQuestion);
            if (opFuncs[initialOp](price, initialTrigger)){
                instance.editOutputLineSilently(outputIndexBase, initialQuestion + ' ✓');
                hasHitInitialTrigger = true;
                mostExtremePricesAfterInitialTrigger = [price, price];
                if (usingPercentOfDelta){
                    const deltas = mostExtremePricesAfterInitialTrigger.map(p => Math.abs(p -  priceOnActivation));
                    thenTriggers = [
                        mostExtremePricesAfterInitialTrigger[0] + (deltas[0]*thenFraction),
                        mostExtremePricesAfterInitialTrigger[1] - (deltas[1]*thenFraction)
                    ];
                } else {
                    thenTriggers = [ 
                        mostExtremePricesAfterInitialTrigger[0] + (mostExtremePricesAfterInitialTrigger[0]*thenFraction),
                        mostExtremePricesAfterInitialTrigger[1] - (mostExtremePricesAfterInitialTrigger[1]*thenFraction)
                    ];
                }
                
                instance.addOutputLineSilently(`${extremePriceDescriptor[triggerIndex]} ${mostExtremePricesAfterInitialTrigger[triggerIndex]}`);
                instance.addOutputLine('');
                instance.updateTriggerLineOptions(0, {color: ScriptModuleCommon.getSellColour()});
              
                for (const i of [1,2]){
                    instance.addTriggerLine({
                        color: ScriptModuleCommon.getNeutralLinecolour(),
                        price: i === 1 ? mostExtremePricesAfterInitialTrigger[triggerIndex]: thenTriggers[triggerIndex],
                        lineWidth: 2,
                        lineStyle: ScriptModuleCommon.Chart.LineStyle.Solid,
                        title: i === 1 ? (type === TYPE.AWAIT_FALL_THEN_RISE ? "minima" : "maxima") : `(2) ${secondAction.toLowerCase()} trigger`
                    });
                }
            } else {
                instance.editOutputLine(outputIndexBase, initialQuestion + ' 🞪');
            }
        }

        if (hasHitInitialTrigger){
            if (price < mostExtremePricesAfterInitialTrigger[0]){
                mostExtremePricesAfterInitialTrigger[0] = price;
            } 
            if (price > mostExtremePricesAfterInitialTrigger[1]){
                mostExtremePricesAfterInitialTrigger[1] = price;
            } 

            instance.updateTriggerLineOptions(1, {price: mostExtremePricesAfterInitialTrigger[triggerIndex]});

            if (usingPercentOfDelta){
                const deltas = mostExtremePricesAfterInitialTrigger.map(p => Math.abs(p -  priceOnActivation));
                thenTriggers = [
                    mostExtremePricesAfterInitialTrigger[0] + (deltas[0]*thenFraction),
                    mostExtremePricesAfterInitialTrigger[1] - (deltas[1]*thenFraction)
                ];
            } else {
                thenTriggers = [
                    mostExtremePricesAfterInitialTrigger[0] + (mostExtremePricesAfterInitialTrigger[0]*thenFraction),
                    mostExtremePricesAfterInitialTrigger[1] - (mostExtremePricesAfterInitialTrigger[1]*thenFraction)
                ];
            }

            const mostExtreme = `${extremePriceDescriptor[triggerIndex]} ${mostExtremePricesAfterInitialTrigger[triggerIndex]}`;
            instance.editOutputLineSilently(outputIndexBase+1, mostExtreme);
            instance.updateTriggerLineOptions(2, {price: thenTriggers[triggerIndex]});
            
            const trigger = thenTriggers[triggerIndex];
            const thenQuestion = `(2) ${ScriptModuleCommon.p(price)} ${thenOp} ${ScriptModuleCommon.p(trigger)}?`;
            instance.editOutputLineSilently(outputIndexBase+2, thenQuestion);
            if (opFuncs[thenOp](price, trigger)){
                instance.editOutputLineSilently(outputIndexBase+2, thenQuestion + ' ✓');
                //I'm unsure on this. Might be better to have usingPercentOfDelta test against initialTrigger too, or use acivationPice?
                const testJumpbackAgainst = usingPercentOfDelta ? 'activation price' : 'initial trigger';
                const testJumpbackPrice = testJumpbackAgainst === 'activation price' ? priceOnActivation : initialTrigger;
                const checkJumpbackQuestion = `(3) ${ScriptModuleCommon.p(price)} ${initialOp} ${testJumpbackPrice}?`;
                instance.editOutputLineSilently(outputIndexBase+3, checkJumpbackQuestion);
                if (opFuncs[initialOp](price, testJumpbackPrice)){
                    instance.editOutputLine(outputIndexBase+3, checkJumpbackQuestion + ' ✓');
                    instance.finish('done', {price});
                    return;
                } else {
                    instance.editOutputLineSilently(outputIndexBase+3, checkJumpbackQuestion + ' 🞪');
                    const direction = type === TYPE.AWAIT_FALL_THEN_RISE ? 'over' : 'below';
                    //we reset the second-stage trigger but keep the iniital trigger as is (ie if it was given as a percentage
                    //we don't recalculate using the current price)
                    instance.addOutputLineSilently(`Price jump ${direction} ${testJumpbackAgainst}! Resetting...`);
                    instance.addOutputLineSilently(''); //will make a loud update in updatePrice
                    outputIndexBase += 5;
                    hasHitInitialTrigger = false;
                    instance.removeTriggerLine();//thentrigger
                    instance.removeTriggerLine();//maxima/minima 
                    updatePrice(prices);
                    return; 
                }
            } else {
                instance.editOutputLine(outputIndexBase+2, thenQuestion + ' 🞪');
            }
        }
    }

    instance.registerFunctions({init, activate, updatePrice});
    
    return instance;
}


