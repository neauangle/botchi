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

import * as Util from '../util.js'; export {Util};
import * as Parser from './lib/parser.js'; export {Parser};
import * as Chart from '../chart.js'; export {Chart};
import * as XDate from '../third_party/xdate.js'; export {XDate}; //https://arshaw.com/xdate/
import * as Globals from '../globals.js'; export {Globals};
import * as BigRational from '../third_party/big.mjs'; const Big = BigRational.Big; export {Big};
import * as Prompt from '../prompt.js';
import * as Emitter from  '../event-emitter.js';
import * as Addtracker from  '../add-tracker.js';

export function getNeutralLinecolour(){
    return getComputedStyle(document.documentElement).getPropertyValue('--neutral-priceline-colour').trim();
}
export function getBuyColour(){
    return getComputedStyle(document.documentElement).getPropertyValue('--buy-colour').trim();
}
export function getSellColour(){
    return getComputedStyle(document.documentElement).getPropertyValue('--sell-colour').trim();
}
/* export const neutralPriceLineColour = 
export const upPriceLineColour = '#00ff4c';
export const downPriceLineColour = 'red'; */
export const SeriesType = {
    LINE: "LINE"
}

export const EVENTS = {
    ACTIVATED: "ACTIVATED",
    OUTPUT_LINES_UPDATED: "OUTPUT_LINES_UPDATED",
    SET_GOTO: "SET_GOTO",
}

export const ASSIGNMENT_TOKEN_REGEX = /(?:^|\n)\$(V|G)\.([a-zA-Z][_a-zA-Z0-9]*)\s*(=|:=)\s*/i; 
export const VARIABLE_NAME_REGEX = /[a-zA-Z][_a-zA-Z0-9]*/i; 

export function addTracker(backendIndex, args){
    return Addtracker.addTracker(backendIndex, args, false);
}

export function validateExpression({expression, allowEmpty, allowPercentage}){
    expression = expression.trim();
    if (expression.endsWith('%')){
        if (!allowPercentage){
            return false;
        }
        expression = expression.slice(0, -1);
    }
    return (allowEmpty && !expression) || Parser.expressionParser.isExpresionValid(expression);
}

export function validateStatements(statementsText, allowEmpty){
    if (!statementsText){
        return !!allowEmpty;
    }
    const lines =statementsText.split('\n');
    for (const line of lines){
        let expression;
        const assignmentTokenMatch = line.match(ASSIGNMENT_TOKEN_REGEX);
        if (assignmentTokenMatch){
            expression = line.slice(assignmentTokenMatch.index + assignmentTokenMatch[0].length);
        } else {
            return false;
        }
        if (!validateExpression({expression, allowPercentage: false, allowEmpty: false})){
           return false;
        }
    } 
    return true;
}


export function validateNumber({expression, allowEmpty, allowPercentage, allow0, allowNegative}){
    if (allowEmpty === undefined){
        allowEmpty = true;
    }
    if (allowPercentage === undefined){
        allowPercentage = true;
    }
    if (allow0 === undefined){
        allow0 = true;
    }
    if (allowNegative === undefined){
        allowNegative = true;
    }
    expression = expression.trim();
    if (!allowEmpty && !expression){
        return false;
    }
    if (expression.endsWith('%')){
        if (!allowPercentage){
            return false;
        }
        expression = expression.slice(0, -1);
    }
    return !isNaN(expression) && (allow0 || Number(expression) && (allowNegative || Number(expression) > 0));
}
    

export function formatForcePercentage(string){
    string = string.trim();
    if (!string){
        return string;
    }
    if (string.endsWith('%')){
        string = string.slice(0,-1);
    }
    string = string.trim() + ' %';
    return string;
}

export function formatPotentialPercentage(string){
    string = string.trim();
    if (string.endsWith('%')){
        string = string.slice(0,-1).trim() + ' %';
    }
    return string;
}

export function p(price){
    if (typeof price === 'object'){
        let ret = p(price.comparator);
        if (!isNaN(price.fiat)){
            ret += ` ($${p(price.fiat)})`;
        }
        return ret;
    } else {
        return Util.roundAccurately(price, 10).toString();
    }
} 

export let database;
let backendNames;

export function init(pDatabase, pBackendNames){
    database = pDatabase;
    backendNames = pBackendNames;
};

export function getBackendIndex(backendName){
    return backendNames.indexOf(backendName);
}
export function getBackendName(backendIndex){
    return backendNames[backendIndex];
}



export function checkNonEmptyTrimmed(value){
    const trimmed = value.trim();
    return {valid: !!trimmed, cleaned: trimmed};
}






//inputInfos = [{label, placeholder, key, test},...]
//test is a function (string) => {valid: boolean, cleaned: string}
const keyToSelectInfo = {
    'email-auth': {
        title: 'Manage Email Authentications',
        inputInfos: [
            {label: 'Host', key: "host", placeholder: "", test: checkNonEmptyTrimmed},
            {label: 'Username', key: "username", placeholder: "", test: (value) => {
                const trimmed = value.trim();
                return {valid: !!trimmed && Util.isProbablyValidEmail(trimmed), cleaned: trimmed};
            }},
            {label: 'Password', key: "password", placeholder: "", type: 'password', test: checkNonEmptyTrimmed},
        ]
    },
    'ethers-auth': { 
        title: 'Manage Ethers Authentications',
        inputInfos: [
            {label: 'Private Key', key: "privateKey", placeholder: "", type: 'password', test: (value) => {
                const trimmed = value.trim();
                return {valid: !!trimmed && Util.isValidERC20PrivateKey(trimmed), cleaned: trimmed};
            }},
        ]
    },
    'wallet-address': { 
        title: 'Manage Wallet Addresses',
        inputInfos: [
            {label: 'Address', key: "address", placeholder: "", test: (value) => {
                const trimmed = value.trim();
                return {valid: !!trimmed, cleaned: trimmed};
            }},
        ]
    },
    'binance-auth': { 
        title: 'Manage Binance Authentications',
        inputInfos: [
            {label: 'API key', key: "apiKey", placeholder: "", type: 'password', test: checkNonEmptyTrimmed},
            {label: 'Secret key', key: "secretKey", placeholder: "", type: 'password', test: checkNonEmptyTrimmed},
        ]
    }
}



export const databaseFrontEnd = (() => {
    async function show(key, currentSelected){
        if (!database[key]){
            database[key] = {};
        }
        const title = keyToSelectInfo[key].title;
        const inputInfos = keyToSelectInfo[key].inputInfos;
        const databaseStringBefore = JSON.stringify(database);
        const {lastSelectedItem, cancelled} = await Prompt.showSelectManager({title, inputInfos, selectedItem: currentSelected, database: database[key]});
        if (cancelled){
            database = JSON.parse(databaseStringBefore);
            return {lastSelectedItem, cancelled};
        }
        window.bridge.updateScriptModuleDatabase(database)
        return {lastSelectedItem, cancelled};
    }

    function hide(){
        Prompt.hideSelectManager();
    }

    return {
        show,
        hide
    }
})();


export function getValueFromDatabase(type, key){
    if (type && key && database[type] && database[type][key]){
        return database[type][key];
    }
}





export function getModuleInstance(){
    let showingOverlay = false;
    let triggerLineInfos = []; 
    let secondarySeriesInfos = [];
    let outputArray=[];
    const emitter = Emitter.instance();
    let moduleId;

    let initFunc;
    let activateFunc;
    let updatePriceFunc;
    let candlesClosedFunc;
    let historyUpdatedFunc;
    let deactivateFunc;
    let roundPromiseResolver;

    let tracker;
    let rowResults;
    let localVariables;
    let rowLabels;
    let outerRowIndex;

    let callbackTicketToReceivedDataCapsuleIds;
    

    const instance = {
        emitter, 
        activationCount: 0,
        isActive: false,   
        tracker: undefined,  
        previousOuterRowIndex: null, 

        //these are called by bots.js. 

        //the assumption is that references for pTracker, pLocalVariables and pRowResults remain valid over the life of the module
        init: function(id, pTracker, pLocalVariables, pRowLabels, pOuterRowIndex, pRowResults){
            moduleId = id;
            tracker = pTracker;
            localVariables = pLocalVariables;
            rowLabels = pRowLabels;
            outerRowIndex = pOuterRowIndex;
            rowResults = pRowResults;
            instance.tracker = tracker;
            if (initFunc){
                initFunc(tracker);
            }
        },

        activate: function(statementsBefore, auxillaryFunctions, pPreviousOuterRowIndex){
            callbackTicketToReceivedDataCapsuleIds = {};
            instance.previousOuterRowIndex = pPreviousOuterRowIndex;

            triggerLineInfos.splice(0, triggerLineInfos.length);
            secondarySeriesInfos.splice(0, secondarySeriesInfos.length);
            outputArray = [];
            const entryPrices = {
                comparator: tracker.mostRecentPrice ? Number(tracker.mostRecentPrice.comparator) : 0, 
                fiat: tracker.mostRecentPrice ? Number(tracker.mostRecentPrice.fiat) : 0
            }
            instance.addOutputLine(`Tracker: ${tracker.uriSignature}`);
            let entryPriceLine = `Entry price: ${p(entryPrices.comparator)} ${tracker.comparatorSymbol} / ${tracker.tokenSymbol}`;
            if (entryPrices.fiat){
                entryPriceLine += ` ($${entryPrices.fiat})`;
            }
            instance.addOutputLine(entryPriceLine);
            instance.activationCount += 1;
            instance.isActive = true;
            
            const returnPromise = new Promise((resolve, reject) => {
                roundPromiseResolver = resolve;
            });
            instance.emitter.emitEvent(EVENTS.ACTIVATED, {moduleId});
            if (statementsBefore){
                instance.addOutputLineSilently(`   ---------------------------------`);
                const {error, result} = instance.processStatements(statementsBefore, null, '   |');
                if (error){
                    return returnPromise;
                } else {
                    instance.addOutputLine(`   ---------------------------------`);
                }
            }
            
            
            if (activateFunc){
                activateFunc(entryPrices.comparator, outerRowIndex, rowResults, localVariables, tracker, auxillaryFunctions);
            }

            
            instance.updatePrice(entryPrices);
            return returnPromise;
        },

        updatePrice: function(prices){
            if (instance.isActive && updatePriceFunc){
                updatePriceFunc(prices);
            }
        },
        candlesClosed: function(args){
            if (instance.isActive && candlesClosedFunc){
                candlesClosedFunc(args.durations, args.currentMS);
            }
        },
        historyUpdated: function(args){
            if (instance.isActive && historyUpdatedFunc){
                historyUpdatedFunc(tracker);
            }
        },

        getOutputArray: function(){
            return outputArray;
        },

        showChartOverlays: function(){
            showingOverlay = true;
            for (const lineInfo of triggerLineInfos){
                lineInfo.line.applyOptions({color: lineInfo.color, axisLabelVisible: true});
            }
            for (const seriesInfo of secondarySeriesInfos){
                if (checkSeriesValidToshow(seriesInfo) && !seriesInfo.isShowing){
                    seriesInfo.isShowing = true;
                    seriesInfo.series.applyOptions({visible: true});
                    seriesInfo.series.setData(seriesInfo.data);
                }
            }
        },
        hideChartOverlays: function(){
            showingOverlay = false;
            for (const lineInfo of triggerLineInfos){
                lineInfo.line.applyOptions({color: 'transparent', axisLabelVisible: false});
            }
            for (const seriesInfo of secondarySeriesInfos){
                if (seriesInfo.series && seriesInfo.isShowing){
                    seriesInfo.isShowing = false;
                    seriesInfo.series.applyOptions({visible: false});
                    seriesInfo.series.setData([]);
                }
            }
        },
        isShowingChartOverlays: function(){
            return showingOverlay;
        },

        deactivate: function(){
            if (deactivateFunc){
                deactivateFunc();
            }
            instance.activationCount += 1;
            instance.isActive = false;
            flushIPCMessages(); //also removed callback tickets, which backend uses to see whether module still active
            for (const lineInfo of triggerLineInfos){
                Chart.removePriceLine(lineInfo.line); 
            }
            triggerLineInfos.splice(0, triggerLineInfos.length);
            
            for (const seriesInfo of secondarySeriesInfos){
                if (seriesInfo.series){
                    Chart.removeSecondarySeries(seriesInfo.series); 
                }
            }
            
            secondarySeriesInfos.splice(0, secondarySeriesInfos.length);
            if (roundPromiseResolver){
                const resolver = roundPromiseResolver;
                roundPromiseResolver = null;
                resolver();
            }

        },

        updateChartcolours: function(changedThemeVariables){
            for (const lineInfo of triggerLineInfos){
                for (const variable of ['--neutral-priceline-colour', '--buy-colour', '--sell-colour']){
                    if (changedThemeVariables[variable] && lineInfo.color === changedThemeVariables[variable].old){
                        instance.updateTriggerLineOptions(lineInfo.index, {color: changedThemeVariables[variable].new});
                    }
                }
            }
            for (const seriesInfo of secondarySeriesInfos){
                for (const variable of ['--neutral-priceline-colour', '--buy-colour', '--sell-colour']){
                    if (changedThemeVariables[variable] && seriesInfo.options['color'] === changedThemeVariables[variable].old){
                        instance.updateSecondarySeriesOptions(seriesInfo.index, {color: changedThemeVariables[variable].new});
                    }
                }
            }
        },


        //the rest are called by modules. registerFunctions must be called in the module's getInstance function. 
        //init and updatePrice are optional

        registerFunctions: function({init, activate, updatePrice, candlesClosed, historyUpdated, deactivate}){
            initFunc = init;
            activateFunc = activate;
            updatePriceFunc = updatePrice;
            deactivateFunc = deactivate;
            candlesClosedFunc = candlesClosed;
            historyUpdatedFunc = historyUpdated;
        },

        getManagedCallbackTicket: function(func) {
            const callbackTicket = window.bridge.getCallbackTicket((type, dataCapsule, ticket) => {
                if (!callbackTicketToReceivedDataCapsuleIds[callbackTicket].includes(dataCapsule.id)){
                    callbackTicketToReceivedDataCapsuleIds[callbackTicket].push(dataCapsule.id);
                    return func(type, dataCapsule.data, ticket);
                }
            });
            callbackTicketToReceivedDataCapsuleIds[callbackTicket] = [];
            return callbackTicket;
        },


        getEvaluation: function({expression, allowPercentage, isText}){
            let percentageSuffix = '';
            if (!isText && allowPercentage && expression.endsWith('%')){
                expression = expression.slice(0, -1).trim();
                percentageSuffix = ' %';
            }
            try {
                const {parsedArray, substitutedString, substitutions} = Parser.expressionParser.parse(
                    expression, rowResults, localVariables, tracker, rowLabels, outerRowIndex, isText
                );
                const derivationLines = [];
                if (substitutions.length){
                    derivationLines.push(substitutedString);
                };
                const currentPrice = tracker.mostRecentPrice ? Number(tracker.mostRecentPrice.comparator) : 0;

                let stringValue;
                if (isText){
                    stringValue = substitutedString;
                } else {
                    stringValue = Parser.expressionParser.evaluate(parsedArray, currentPrice, rowResults, localVariables, tracker, rowLabels, outerRowIndex);
                }
                if (stringValue.toString() != substitutedString){
                    derivationLines.push(stringValue.toString());
                }
                return {derivationLines, stringValue, percentageSuffix, error: false};

            } catch (error) {
                instance.finishWithError(`${error}`);
                return {derivationLines: null, percentageSuffix: null, stringValue: null, error};
            }
        },

        processStatements: function(statements, retDict, outputPrefix=''){
            if(!retDict){
                retDict = localVariables;
            }
            let resultValue;
        
            const lines = statements.split('\n');
            for (const line of lines){
                if (!line){
                    continue;
                }
                let variableToSet;
                let expression;
                const assignmentTokenMatch = line.match(ASSIGNMENT_TOKEN_REGEX);
                if (!assignmentTokenMatch){
                    instance.finishWithError('Invalid expression: no assignment token');
                    return {error: 'Invalid expression: no assignment token', value: null};
                }
                expression = line.slice(assignmentTokenMatch.index + assignmentTokenMatch[0].length);
        
                variableToSet = assignmentTokenMatch[2];
                const assignmentOperator = assignmentTokenMatch[3];
                const useTextLexer = assignmentOperator === ':=';
                const {derivationLines, stringValue, error} = instance.getEvaluation({expression, isText: useTextLexer});
                if (error){
                    return {error, value: null};
                }
                /*
                    I was going to cache the assignments until after all statements ahd been procesed so that it becomes an atomic set 
                    of statements, but then you wouldn't be able to set a variable and use the new value in a lower line, which I think
                    is more intuitive.
                */
                resultValue = stringValue;
                if (assignmentTokenMatch[1].toUpperCase() === 'G'){
                    if (retDict !== localVariables){
                        instance.finishWithError("Error: Inappropriate time to set global variable " + variableToSet);
                        return {error: "Error: Inappropriate time to set global variable " + variableToSet, value: null};
                    }
                    if (!Globals.globalExists(variableToSet)){
                        instance.finishWithError("Error: Global does not exist: " + variableToSet);
                        return {error: "Error: Global does not exist: " + variableToSet, value: null};
                    }
                    Globals.setGlobal(variableToSet, stringValue);
                } else {
                    retDict[variableToSet] = stringValue;
                }
                
                instance.addOutputLineSilently(`${outputPrefix}$${assignmentTokenMatch[1]}.${assignmentTokenMatch[2]} ${assignmentOperator} ${expression}`);
                const tabSpaces = ' '.repeat( variableToSet.length + 4);
                for (let i = 0; i < derivationLines.length; ++i){
                    instance.addOutputLineSilently(`${outputPrefix}${tabSpaces}${assignmentOperator} ${derivationLines[i]}`);
                }
                instance.emitOutputLines();
            }
            return {error: null, result: resultValue};
        },
        

        //call this to end the module's activated stage and move on
        finish: async function(resultKey, result){
            if (roundPromiseResolver){
                instance.activationCount += 1;
                await flushIPCMessages();
                if (roundPromiseResolver){
                    const resolver = roundPromiseResolver;
                    roundPromiseResolver = null;
                    resolver({moduleId, resultKey, result});
                }
            }
        },
        
        finishWithError: async function (error){
            if (roundPromiseResolver){
                instance.activationCount += 1;
                await flushIPCMessages();
                const resolver = roundPromiseResolver
                roundPromiseResolver = null;
                resolver({moduleId, error});
            }
        },


        //Outputs

        editOutputLine: function(lineIndex, message){
            instance.editOutputLineSilently(lineIndex, message);
            emitter.emitEvent(EVENTS.OUTPUT_LINES_UPDATED, {moduleId, outputArray});
        },

        editOutputLineSilently: function(lineIndex, message){
            if (lineIndex === undefined || lineIndex === null){
                lineIndex = outputArray.length - 1;
            }
            outputArray[lineIndex] = message;
        },

        addOutputLineSilently: function(message){
            outputArray.push(message);
            return outputArray.length-1;
        },

        addOutputLine: function(message) {
            instance.addOutputLineSilently(message);
            emitter.emitEvent(EVENTS.OUTPUT_LINES_UPDATED, {moduleId, outputArray});
            return outputArray.length-1;
        },

        emitOutputLines: function(){
            emitter.emitEvent(EVENTS.OUTPUT_LINES_UPDATED, {moduleId, outputArray});
        },

        getOutputLinesLength: function(){
            return outputArray.length;
        },

        
        //trigger lines

        addTriggerLine: function(options){
            const lineInfo = {
                color: options.color,
                line:  Chart.addPriceLine(options),
                index: triggerLineInfos.length
            }
            lineInfo.line.applyOptions({
                color: showingOverlay ? lineInfo.color : 'transparent',
                lineWidth: 2,
                axisLabelVisible: showingOverlay,
            });
            triggerLineInfos.push(lineInfo);
            return triggerLineInfos.length - 1;
        },
        updateTriggerLineOptions: function(index, options){
            const lineInfo = triggerLineInfos[index];
            if (options.color){
                lineInfo.color = options.color;
                options.color = showingOverlay ? lineInfo.color : 'transparent';
            }
            lineInfo.line.applyOptions(options);            
        },
        removeTriggerLine: function(index){
            if (index === undefined){
                Chart.removePriceLine(triggerLineInfos.pop().line);
            } else {
                const line = triggerLineInfos[index];
                Util.removeArrayItemOnce(triggerLineInfos, line);
                Chart.removePriceLine(line);
            }
            
        },


        //secondary series

        addSecondarySeries: function(type, options){
            if (type !== SeriesType.LINE){
                throw 'Invalid series type ' + type;
            }

            const seriesInfo = {
                type,
                options,
                series: null,
                isShowing: false,
                index: secondarySeriesInfos.length,
                durationKey: options.durationKey,
                data: []
            }
            if (checkSeriesValidToshow(seriesInfo)){
                seriesInfo.isShowing = true;
                seriesInfo.series.applyOptions({visible: true});
                seriesInfo.series.setData(seriesInfo.data);
            } 
            
            secondarySeriesInfos.push(seriesInfo);
            return secondarySeriesInfos.length - 1;
        },
        setSecondarySeriesData: function(index, data){
            const seriesInfo = secondarySeriesInfos[index];
            seriesInfo.data = data;
            if (seriesInfo.series && seriesInfo.isShowing){
                seriesInfo.series.setData(seriesInfo.data);  
            }
        },
        updateSecondarySeriesBar: function(index, bar){
            const seriesInfo = secondarySeriesInfos[index];
            if (!seriesInfo.data.length || seriesInfo.data[seriesInfo.data.length-1].utcTime < bar.utcTime){
                seriesInfo.data.push(bar);
            } else {
                seriesInfo.data[seriesInfo.data.length-1] = bar;
            }
            if (seriesInfo.series && seriesInfo.isShowing){
                seriesInfo.series.update(bar);  
            }
        },

        updateSecondarySeriesOptions: function(index, options){
            const seriesInfo = secondarySeriesInfos[index];
            for (const key of Object.keys(options)){
                seriesInfo.options[key] = options[key];
            }
            if (seriesInfo.series){
                seriesInfo.series.applyOptions(options);    
            }        
        },
        removeSecondarySeries: function(index){
            if (index === undefined){
                if (secondarySeriesInfos[secondarySeriesInfos.length-1].series){
                    Chart.removeSecondarySeries(secondarySeriesInfos.pop().series);
                }
            } else {
                const seriesInfo = secondarySeriesInfos[index];
                Util.removeArrayItemOnce(secondarySeriesInfos, seriesInfo);
                if (seriesInfo.series){
                    Chart.removeSecondarySeries(seriesInfo.series);
                }
                
            }
        },
    };

    Chart.emitter.addEventListener(Chart.EVENTS.BAR_DURATION_CHANGED, event => {
        if (showingOverlay){
            const durationKey = event.data.duration;
            for (const seriesInfo of secondarySeriesInfos){
                if (checkSeriesValidToshow(seriesInfo, durationKey)){
                    seriesInfo.isShowing = true;
                    seriesInfo.series.applyOptions({visible: true});
                    seriesInfo.series.setData(seriesInfo.data);
                } else if (seriesInfo.series && seriesInfo.isShowing){
                    seriesInfo.isShowing = false;
                    seriesInfo.series.applyOptions({visible: false});
                    seriesInfo.series.setData([]);
                }
            }
        }
    });

    async function flushIPCMessages(){
        for (const callbackTicket of Object.keys(callbackTicketToReceivedDataCapsuleIds)){
            const allDataCapsules = await window.bridge.getBackendIPCDataCapsules(callbackTicket, true);//disposes ticket
            for (const dataCapsule of allDataCapsules){
                if (!callbackTicketToReceivedDataCapsuleIds[callbackTicket].includes(dataCapsule.id)){
                    callbackTicketToReceivedDataCapsuleIds[callbackTicket].push(dataCapsule.id);
                    if (dataCapsule.data.message){
                        instance.addOutputLineSilently(dataCapsule.data.message);//updated in moduleDone of bots.js
                    }
                }
            }
        }
        callbackTicketToReceivedDataCapsuleIds = {};
    }


    function checkSeriesValidToshow(seriesInfo, chartBarDuration){
        if (!chartBarDuration){
            chartBarDuration = Chart.getBarDuration();
        }
        if (showingOverlay && (!seriesInfo.durationKey || seriesInfo.durationKey === chartBarDuration)){
            if (!seriesInfo.series){
                seriesInfo.series = Chart.addSecondaryLineSeries(seriesInfo.options);
            }
            return true;
        } else {
            return false;
        }
    }

    
    return instance;
}









export async function handleParameterMetaEthersNetwork(parameter, tracker){
    const backendIndex = getBackendIndex('ethers');
    let nameToIds;
    if (parameter.name === 'api'){
        nameToIds = await window.bridge.callBackendFunction(backendIndex, 'getEndpointNameToNodeIds');
        parameter.options = [...Object.keys(nameToIds)];
        parameter.optionsHaveChanged = true;
    } else if (parameter.name === 'exchange'){
        nameToIds = await window.bridge.callBackendFunction(backendIndex, 'getExchangeNameToNodeIds');
        parameter.options = [...Object.keys(nameToIds)];
        parameter.optionsHaveChanged = true;
    }
    
    if (parameter.options.includes(parameter.value)){
        parameter.valid = true;
    } else {
        if (tracker && tracker.backendIndex === backendIndex){
            for (const option of parameter.options){
                if (nameToIds[option].includes(tracker.id)){
                    parameter.value = option;
                    parameter.valid = true;
                    break;
                }
            }

        }
        if (parameter.value === null && parameter.options.length > 1){
            parameter.value = parameter.options[0];
            parameter.valid = true;
        } 
        if (parameter.value === null){
            parameter.valid = false;
            parameter.value = null;
        }
    }    

    return parameter;
}