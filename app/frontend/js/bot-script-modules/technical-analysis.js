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

export const GROUP_NAME = "Triggers";
export const NAME = "TechnicalAnalysis";
export const VERSION = "0.0.0";

export const PARAM_INDEX_FOR_CHART_DURATION_KEY = 0;

export const DURATION_KEY_PARAM_INDEX = 0;
export const SNAPSHOT_MODE_PARAM_INDEX = 1;

export const CHECK_MFI_PARAM_INDEX = 2;
export const MFI_FRAME_LENGTH_PARAM_INDEX = 3;
export const MFI_CONDITION_PARAM_INDEX = 4;
export const MFI_TARGET_PARAM_INDEX = 5;

export const CHECK_RSI_PARAM_INDEX = 6;
export const RSI_FRAME_LENGTH_PARAM_INDEX = 7;
export const RSI_CONDITION_PARAM_INDEX = 8;
export const RSI_TARGET_PARAM_INDEX = 9;

export const CHECK_BOLLINGER_BAND_PARAM_INDEX = 10;
export const BOLLINGER_SMA_FRAME_LENGTH_PARAM_INDEX = 11;
export const BOLLINGER_STD_DEVS_PARAM_INDEX = 12;
export const BOLLINGER_TRIGGER_PARAM_INDEX = 13;

export const STATIC_OPTIONS_TIME_SCALE = ['1m', '15m', '1h', '4h', '1d'];
export const STATIC_OPTIONS_CONDITION = ['lessThan', 'lessThanOrEqualTo', 'greaterThan', 'greaterThanOrEqualTo'];

export const STATIC_BOLLINGER_TRIGGER = ['Close High', 'Pass High', 'Pass Low', 'Close Low'];


export function getDescription(){
    return "todo"
}


export function getTitle(customParameters){
   return "TA";
}


export function getResultKeys(){
    return ['done'];
}


export function getDefaultParameters(){
    return [
        {name: 'timeScale', value: '1m', type: 'select', visible: true, valid: true, options: 'STATIC_OPTIONS_TIME_SCALE'}, 
        {name: 'snapshotMode',value: false, type: 'boolean', visible: true, valid: true}, 
        
        {name: 'checkMFI', label: "MFI", value: false, type: 'boolean', visible: true, valid: true}, 
        {name: 'mfiFrameLength', label: "Frame Length", value: '14', type: 'text', visible: true, valid: true}, 
        {name: 'mfiCondition', label: "Condition", value: 'lessThan', type: 'select', visible: true, valid: true, options:'STATIC_OPTIONS_CONDITION'}, 
        {name: 'mfiTarget', label: "Target", value: '20', type: 'text', visible: true, valid: true}, 

        {name: 'checkRSI', label: "RSI", value: false, type: 'boolean', visible: true, valid: true}, 
        {name: 'rsiFrameLength', label: "Frame Length", value: '14', type: 'text', visible: true, valid: true}, 
        {name: 'rsiCondition', label: "Condition", value: 'lessThan', type: 'select', visible: true, valid: true, options:'STATIC_OPTIONS_CONDITION'}, 
        {name: 'rsiTarget', label: "Target", value: '30', type: 'text', visible: true, valid: true}, 

        {name: 'checkBollingerBand', label: "Bollinger", value: false, type: 'boolean', visible: true, valid: true}, 
        {name: 'bollingerFrameLength', label: "Frame Length", value: '10', type: 'text', visible: true, valid: true},
        {name: 'bollingerStdDeviatons', label: "Std Devs", value: '2', type: 'text', visible: true, valid: true},  
        {name: 'bollingerTrigger', label: "Trigger", value: STATIC_BOLLINGER_TRIGGER[0], type: 'select', visible: true, valid: true, options: 'STATIC_BOLLINGER_TRIGGER'}, 
    ];
}

export function handleTrackerChanged(parameters, extraInfo){
    
}

export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'snapshotMode'){
        parameters[MFI_CONDITION_PARAM_INDEX].visible = !parameter.value && parameters[CHECK_MFI_PARAM_INDEX].value;
        parameters[MFI_TARGET_PARAM_INDEX].visible = !parameter.value && parameters[CHECK_MFI_PARAM_INDEX].value;
        parameters[RSI_CONDITION_PARAM_INDEX].visible = !parameter.value && parameters[CHECK_RSI_PARAM_INDEX].value;
        parameters[RSI_TARGET_PARAM_INDEX].visible = !parameter.value && parameters[CHECK_RSI_PARAM_INDEX].value;
        parameters[BOLLINGER_TRIGGER_PARAM_INDEX].visible = !parameter.value && parameters[CHECK_BOLLINGER_BAND_PARAM_INDEX].value;

    }
        
    //MFI
    if (parameter.name === 'checkMFI'){
        parameters[MFI_CONDITION_PARAM_INDEX].visible = parameter.value && !parameters[SNAPSHOT_MODE_PARAM_INDEX].value;
        parameters[MFI_TARGET_PARAM_INDEX].visible = parameter.value && !parameters[SNAPSHOT_MODE_PARAM_INDEX].value;
        parameters[MFI_FRAME_LENGTH_PARAM_INDEX].visible = parameter.value;
    
    } else if (parameter.name === 'mfiFrameLength'){
        parameter.value = parameter.value.trim();
        parameter.valid = !isNaN(parameter.value) && Number.isInteger(Number(parameter.value)) && Number(parameter.value) > 0;

    } else if (parameter.name === 'mfiTarget'){
        parameter.value = parameter.value.trim();
        parameter.valid = !isNaN(parameter.value) && Number(parameter.value) >= 0 && Number(parameter.value) <= 100;

    //RSI
    } else if (parameter.name === 'checkRSI'){
        parameters[RSI_CONDITION_PARAM_INDEX].visible = parameter.value && !parameters[SNAPSHOT_MODE_PARAM_INDEX].value;
        parameters[RSI_TARGET_PARAM_INDEX].visible = parameter.value && !parameters[SNAPSHOT_MODE_PARAM_INDEX].value;
        parameters[RSI_FRAME_LENGTH_PARAM_INDEX].visible = parameter.value;
    
    } else if (parameter.name === 'rsiFrameLength'){
        parameter.value = parameter.value.trim();
        parameter.valid = !isNaN(parameter.value) && Number.isInteger(Number(parameter.value)) && Number(parameter.value) > 0;

    } else if (parameter.name === 'rsiTarget'){
        parameter.value = parameter.value.trim();
        parameter.valid = !isNaN(parameter.value) && Number(parameter.value) >= 0 && Number(parameter.value) <= 100;


    //Bollinger
    } else if (parameter.name === 'checkBollingerBand'){
        parameters[BOLLINGER_SMA_FRAME_LENGTH_PARAM_INDEX].visible = parameter.value;
        parameters[BOLLINGER_STD_DEVS_PARAM_INDEX].visible = parameter.value;
        parameters[BOLLINGER_TRIGGER_PARAM_INDEX].visible = parameter.value && !parameters[SNAPSHOT_MODE_PARAM_INDEX].value;
        
    } else if (parameter.name === 'bollingerStdDeviatons'){
        parameter.value = parameter.value.trim();
        parameter.valid = !isNaN(parameter.value) && Number(parameter.value) > 0;

    } else if (parameter.name === 'bollingerFrameLength'){
        parameter.value = parameter.value.trim();
        parameter.valid = !isNaN(parameter.value) && Number.isInteger(Number(parameter.value)) && Number(parameter.value) > 0;

    } 

}



export function getInstance(customParameters){
    const instance = ScriptModuleCommon.getModuleInstance();
    let indicatorSubmodules;
    let durationKey;
    let lastPriceProcessed;

    const init = function(tracker){
        durationKey = customParameters[DURATION_KEY_PARAM_INDEX].value;
    }


    const activate = async function(priceOnActivation, outerRowIndex, rowResults, localVariabless, tracker){
        indicatorSubmodules = [];
        if (customParameters[CHECK_MFI_PARAM_INDEX].value){
            indicatorSubmodules.push(getMoneyFlowIndexSubModule(instance, customParameters))
        }
        if (customParameters[CHECK_RSI_PARAM_INDEX].value){
            indicatorSubmodules.push(getRelativestrengthIndexSubModule(instance, customParameters))
        }
        if (customParameters[CHECK_BOLLINGER_BAND_PARAM_INDEX].value){
            indicatorSubmodules.push(getBollingerBandSubmodule(instance, customParameters))
        }
        
        const bars = instance.tracker.durationToBars[durationKey];
        for (const indicator of indicatorSubmodules){
            indicator.setHistory(bars);
        }
        lastPriceProcessed = null;
    }

    const historyUpdated = function(tracker){
        const bars = instance.tracker.durationToBars[durationKey]; 
        for (const indicator of indicatorSubmodules){
            indicator.setHistory(bars);
        }
    }

    const candlesClosed = function(durations){
        if (durations.includes(durationKey)){
            const bars = instance.tracker.durationToBars[durationKey];
            let finished = true;
            for (const indicator of indicatorSubmodules){
                indicator.processNewBar(bars);
                if (!indicator.isSatisfied()){
                    finished = false
                }
            }
            if (finished || customParameters[SNAPSHOT_MODE_PARAM_INDEX].value){
                const result = {};
                for (const indicator of indicatorSubmodules){
                    indicator.addResult(result);
                }

                instance.finish('done', result);
            }
        }
    }

    const updatePrice = function(price){
        if (lastPriceProcessed !== instance.tracker.mostRecentPrice){
            lastPriceProcessed = instance.tracker.mostRecentPrice;
            price = Number(instance.tracker.mostRecentPrice.comparator);
            let finished = true;
            const bars = instance.tracker.durationToBars[durationKey];
            for (const indicator of indicatorSubmodules){
                indicator.processNewPrice(price, bars);
                if (!indicator.isSatisfied()){
                    finished = false
                }
            }
            if (finished || customParameters[SNAPSHOT_MODE_PARAM_INDEX].value){
                const result = {};
                for (const indicator of indicatorSubmodules){
                    indicator.addResult(result);
                }

                instance.finish('done', result);
            }
        }
    }
       
    function deactivate(){
        for (const submodule of indicatorSubmodules){
            submodule.deactivate();
        }
        indicatorSubmodules = [];
    }

    instance.registerFunctions({init, activate, updatePrice, candlesClosed, historyUpdated, deactivate});

    return instance;
}




const conditionToOp = {
    lessThan: (a, b) => a < b,
    lessThanOrEqualTo: (a, b) => a <= b,
    greaterThan: (a, b) => a > b,
    greaterThanOrEqualTo: (a, b) => a >= b,
}

const conditionToText = {
    lessThan: '<',
    lessThanOrEqualTo: '<=',
    greaterThan: (a, b) => '>',
    greaterThanOrEqualTo: '>=',
}


function getMoneyFlowIndexSubModule(pInstance, customParameters){
    const instance = pInstance;
    const durationKey = customParameters[DURATION_KEY_PARAM_INDEX].value;
    const target = Number(customParameters[MFI_TARGET_PARAM_INDEX].value)
    const frameLength = Number(customParameters[MFI_FRAME_LENGTH_PARAM_INDEX].value);
    const condition = customParameters[MFI_CONDITION_PARAM_INDEX].value;
    const conditionText = conditionToText[condition];

    let satisfied = false;
    let outputLineIndex = null;
    let mfi = null;
    let moneyFlows = null;

    
    
    function updateStatus(){
        satisfied = conditionToOp[condition](mfi, target);
        instance.editOutputLine(outputLineIndex, `MFI: ${ScriptModuleCommon.Util.roundAccurately(mfi, 2, true)} ${conditionText} ${target}? ${satisfied ? '✓' : '🞪'}`);
    }

    function updateLastBar(bar){
        const moneyFlow = moneyFlows[moneyFlows.length-1];
        moneyFlow.typicalPrice = (bar.high + bar.low + bar.close) / 3;
        moneyFlow.value = moneyFlow.typicalPrice * bar.volume;
        moneyFlow.isPositive = moneyFlows.length < 2 || moneyFlow.typicalPrice >= moneyFlows[moneyFlows.length-2].typicalPrice;

        if (moneyFlows.length === frameLength){
            let sumPositive = 0;
            let sumNegative = 0;
            for (const moneyFlowItem of moneyFlows){
                if (moneyFlowItem.isPositive){
                    sumPositive += moneyFlowItem.value;
                } else {
                    sumNegative += moneyFlowItem.value;
                }
            }
            mfi = 100 - (100 / (1 + (sumPositive/sumNegative)));
        }
    }

    function addBar(bar){
        moneyFlows.push({utcTime: bar.utcTime});
        if (moneyFlows.length > frameLength){
            moneyFlows.shift();
        }
        updateLastBar(bar);
    }

    return {
        addResult: function(result){
            result.mfi = mfi;
        },
        setHistory: function(bars){
            moneyFlows = [];
            mfi = 50 // until enough data points
            for (const bar of bars){
                addBar(bar);
            }
            if (outputLineIndex === null){
                outputLineIndex = instance.addOutputLine('');
            }
            updateStatus();
        },
        processNewBar: function(bars){
            addBar(bars[bars.length-1]);
            updateStatus();
        },
        processNewPrice: function(price, bars){
            if (!bars.length){
                return;
            }
            if (!moneyFlows.length || bars[bars.length-1].utcTime > moneyFlows[moneyFlows.length - 1].utcTime){
                addBar(bars[bars.length-1]);
            }
            updateLastBar(bars[bars.length-1]);
            updateStatus();
        },
        isSatisfied: function(){
            return satisfied;
        },
        deactivate: function(){}

        
    };
}






/*
// https://nullbeans.com/how-to-calculate-the-relative-strength-index-rsi/
// https://www.binance.com/en/trade/FTM_USDT?layout=basic
// 

const args = [];
args[DURATION_KEY_PARAM_INDEX] = {value: '1m'};
args[RSI_TARGET_PARAM_INDEX] = {value: 0};
args[RSI_CONDITION_PARAM_INDEX] = {value: 'lessThan'};
args[RSI_FRAME_LENGTH_PARAM_INDEX] = {value: 14};

const data = [
    {open: 13, close: 12}, //1
    {open: 12, close: 15},
    {open: 15, close: 17},
    {open: 17, close: 16},
    {open: 16, close: 14},
    {open: 14, close: 12},
    {open: 12, close: 13},
    {open: 13, close: 11},
    {open: 11, close: 13},
    {open: 13, close: 15},
    {open: 15, close: 19},
    {open: 19, close: 21},
    {open: 21, close: 22},
    {open: 22, close: 23}, //14
    {open: 23, close: 24}, 
    {open: 24, close: 21},
    {open: 21, close: 22},
    {open: 22, close: 21},
    {open: 21, close: 23},
    {open: 23, close: 27},
    {open: 27, close: 29},
    {open: 29, close: 31},
    {open: 31, close: 32},
    {open: 32, close: 30},
    {open: 30, close: 33},
    {open: 33, close: 31},
    {open: 31, close: 29},
    {open: 29, close: 33}, //
   

]

const testRSI = getRelativestrengthIndexSubModule(null, args);
const testBars = [];
testRSI.setHistory(testBars);
for (const datum of data){
    testBars.push(datum);
    testRSI.processNewBar(testBars);
}

*/


function getRelativestrengthIndexSubModule(pInstance, customParameters){
    const instance = pInstance;
    const durationKey = customParameters[DURATION_KEY_PARAM_INDEX].value;
    const target = Number(customParameters[RSI_TARGET_PARAM_INDEX].value);
    const condition = customParameters[RSI_CONDITION_PARAM_INDEX].value;
    const conditionText = conditionToText[condition];
    const frameLength = Number(customParameters[RSI_FRAME_LENGTH_PARAM_INDEX].value);
    

    let satisfied = false;
    let outputLineIndex = null;
    let differenceItems = null;
    let data = null;
    let rsi;

    function updateStatus(){
        satisfied = conditionToOp[condition](rsi, target);
        if (!instance){
            console.log(`RSI: ${rsi} ${condition} ${target}? ${satisfied ? '✓' : '🞪'}`);
            return;
        }
        instance.editOutputLine(outputLineIndex, `RSI: ${ScriptModuleCommon.Util.roundAccurately(rsi, 2, true)} ${conditionText} ${target}? ${satisfied ? '✓' : '🞪'}`);
    }

  
    let currentBarSmmaUp;
    let currentBarSmmaDown;
    let previousBarSmmaUp;
    let previousBarSmmaDown;

    function updateLastBar(newLastBar){     
        //because the bar is straight from tracker and we don't clone it or anything, it should have updated close for us
        const difference = newLastBar.close - newLastBar.open;
        const differenceItem =  differenceItems[differenceItems.length-1];
        differenceItem.magnitude = Math.abs(difference);
        differenceItem.isGain = difference > 0;
        const currentGain = differenceItem.isGain ? differenceItem.magnitude : 0;
        const currentLoss = differenceItem.isGain ? 0 : differenceItem.magnitude;

        if (differenceItems.length == frameLength){
            if (previousBarSmmaUp === undefined){
                let sumUp = 0;
                let sumDown = 0;
                for (const differenceItem of differenceItems){
                    let sumUpString = 0;
                    let sumdownString = 0;
                    if (differenceItem.isGain){
                        sumUp += differenceItem.magnitude;
                        sumUpString = differenceItem.magnitude 
                    } else {
                        sumDown += differenceItem.magnitude;
                        sumdownString = differenceItem.magnitude;
                    }
                    //console.log(differenceItems.indexOf(differenceItem)+1, ': ', sumUpString, sumdownString);
                }
                currentBarSmmaUp = sumUp / frameLength;
                currentBarSmmaDown = sumDown / frameLength;
                //console.log('sma', currentBarSmmaUp, currentBarSmmaDown);
                
            } else {
                //console.log(data.length, ': ', currentGain, currentLoss);
                currentBarSmmaUp = (currentGain + previousBarSmmaUp * (frameLength - 1)) / frameLength;
                currentBarSmmaDown = (currentLoss + previousBarSmmaDown * (frameLength - 1)) / frameLength;
                //console.log('smma', currentBarSmmaUp, currentBarSmmaDown);
            }

            const rs = currentBarSmmaUp / currentBarSmmaDown;
            rsi = 100 - (100/(1+rs));
        }

    }

    function addBar(bar){
        data.push(bar);
        if (currentBarSmmaUp !== undefined){
            previousBarSmmaUp = currentBarSmmaUp;
            previousBarSmmaDown = currentBarSmmaDown;
            
        }
        differenceItems.push({});
        if (differenceItems.length > frameLength){
            differenceItems.shift();
        }
        updateLastBar(bar);
    }

    const conditionToOp = {
        lessThan: (a, b) => a < b,
        lessThanOrEqualTo: (a, b) => a <= b,
        greaterThan: (a, b) => a > b,
        greaterThanOrEqualTo: (a, b) => a >= b,
    }
    

    return {
        addResult: function(result){
            result.rsi = rsi;
        },
        setHistory: function(bars){
            differenceItems = [];
            data = [];
            previousBarSmmaUp = undefined;
            previousBarSmmaDown = undefined;
            currentBarSmmaUp = undefined;
            currentBarSmmaDown = undefined;
            rsi = 50;
            for (const bar of bars){
                addBar(bar);
            }
            if (outputLineIndex === null){
                if (!instance){
                    return;
                }
                outputLineIndex = instance.addOutputLine('');
            }
            updateStatus();
        },
        processNewBar: function(bars){
            addBar(bars[bars.length-1]);
            updateStatus();
        },
        processNewPrice: function(price, bars){
            if (!bars.length){
                return;
            }
            if (!data.length || bars[bars.length-1].utcTime > data[data.length - 1].utcTime){
                addBar(bars[bars.length-1]);
            }
            updateLastBar(bars[bars.length-1]);
            updateStatus();
        },
        isSatisfied: function(){
            return satisfied;
        },
        deactivate: function(){}
        
    };
}




















function getBollingerBandSubmodule(pInstance, customParameters){
    const instance = pInstance;
    const durationKey = customParameters[DURATION_KEY_PARAM_INDEX].value;
    const trigger = customParameters[BOLLINGER_TRIGGER_PARAM_INDEX].value;
    const isTriggerOnClose = trigger.startsWith('Close');
    const isTriggerHigh = trigger.endsWith('High');

    const simpleMovingAverage = {
        data: null,
        seriesIndex: null,
        sumAmounts: null,
        stdDeviation: null,
        currentValue: null,
        frameLength: Number(customParameters[BOLLINGER_SMA_FRAME_LENGTH_PARAM_INDEX].value),
        updateLastBar: function(newLastBar){
            this.sumAmounts[this.sumAmounts.length - 1] = newLastBar.close;
            
            let sum = 0; 
            for (const amount of this.sumAmounts){
                sum += amount;
            }
            const middleLine = sum / this.sumAmounts.length;
            this.currentValue = middleLine;
            this.data[this.data.length - 1].value = middleLine;

            let stdDevNumerator = 0;
            let n = 0;
            for (let i = this.data.length-this.sumAmounts.length; i < this.data.length; ++i){
                stdDevNumerator  += (this.data[i].close - middleLine) ** 2;
                n += 1;
            }
            this.stdDeviation = Math.sqrt(stdDevNumerator / n);

        },
        addBar: function(bar){
            this.sumAmounts.push(bar.close);
            if (this.sumAmounts.length > this.frameLength){
                this.sumAmounts.shift();
            }
            this.data.push({
                utcTime: bar.utcTime, 
                time: bar.time,
                value: null,
                close: bar.close
            });
            this.updateLastBar(this.data[ this.data.length-1]);
        }
    }


    const high = {data: [], seriesIndex: null, title: 'Bol+'};
    const low = {data: [], seriesIndex: null,  title: 'Bol-'};
    const stdDeviations = Number(customParameters[BOLLINGER_STD_DEVS_PARAM_INDEX].value);
    let outputStatusLineIndex = null;
    let satisfied = false;
    const boundDelimiters = {'+': null,'m': null, '-': null};

    function updateOutput(){
        //console.log('boundDelimiters', JSON.stringify(boundDelimiters));
        let statement = '';
        if (boundDelimiters['+'] !== null){
            let p = ScriptModuleCommon.p(isTriggerHigh ? boundDelimiters['+'] : boundDelimiters['-'])
            statement = `${isTriggerOnClose ? 'close' : 'pass'} ${isTriggerHigh ? '>= '+p : '<= '+p}`;
        }
        instance.editOutputLine(outputStatusLineIndex, `Bollinger: ${statement}? ${satisfied ? '✓' : '🞪'}`);
    }

    function updateStatus(price, isNewBar){
        if (!high.data.length){//even for pass steps, there are no bands to pass!
            return;
        }

        boundDelimiters['+'] = high.data[high.data.length-1].value;
        boundDelimiters['m'] = simpleMovingAverage.data[simpleMovingAverage.data.length-1].value;
        boundDelimiters['-'] = low.data[low.data.length-1].value;

        let currentSign;
        if (price >= boundDelimiters['+']){
            currentSign = '+'
        } else if (price > boundDelimiters['m']){
            currentSign = 'm+'
        } else if (price <= boundDelimiters['-']){
            currentSign = '-'
        }  else if (price <= boundDelimiters['m']){
            currentSign = 'm-'
        }
        
        if (isNewBar || !isTriggerOnClose){
            if (!satisfied){
                if (isTriggerHigh && currentSign === '+' || !isTriggerHigh && currentSign === '-'){
                    satisfied = true;
                } 
            } else {
                if (isTriggerHigh && currentSign !== '+' || !isTriggerHigh && currentSign !== '-'){
                    satisfied = false;
                } 
            }
        }

        updateOutput();
    }

    function addBar(bar){
        if (high.data.length && bar.time <= high.data[high.data.length-1].time){
            throw "Bars in wrong order...";
        }
        simpleMovingAverage.addBar(bar);
        //http://www.ta-guru.com/Book/TechnicalAnalysis/TechnicalIndicators/BollingerBands.php5
        //http://www.great-trades.com/Help/bollinger%20bands%20calculation.htm
        //https://trendspider.com/blog/trading-the-bollinger-bands-how-to-use-multiple-time-frames/
        high.data.push({
            utcTime: bar.utcTime,
            time: bar.time,
            value: simpleMovingAverage.currentValue + stdDeviations * simpleMovingAverage.stdDeviation
        });
        low.data.push({
            utcTime: bar.utcTime,
            time: bar.time,
            value: simpleMovingAverage.currentValue - stdDeviations * simpleMovingAverage.stdDeviation
        });
    }


    const ret = {
        addResult: function(result){
            result.bollingerLow = low.data[low.data.length-1].value;
            result.bollingerMidline = simpleMovingAverage.data[simpleMovingAverage.data.length-1].value;
            result.bollingerHigh = high.data[high.data.length-1].value;
        },
        setHistory: function(bars){
            high.data = [];
            low.data = [];
            simpleMovingAverage.data = [];
            simpleMovingAverage.sumAmounts = [];
            
            if (outputStatusLineIndex === null){
                outputStatusLineIndex = instance.addOutputLine('');
                updateOutput();
            }
            
            for (const bar of bars){
                addBar(bar)
            }
            if (simpleMovingAverage.seriesIndex === null){
                simpleMovingAverage.seriesIndex = instance.addSecondarySeries(ScriptModuleCommon.SeriesType.LINE, {
                    color: ScriptModuleCommon.getNeutralLinecolour(),
                    priceLineVisible: false,
                    lastValueVisible: false,
                    lineWidth: 1,
                    durationKey
                });
            }
            //console.log('=============================');
            //console.log('simpleMovingAverage.data', JSON.stringify(simpleMovingAverage.data));
            instance.setSecondarySeriesData(simpleMovingAverage.seriesIndex, simpleMovingAverage.data);
            
            for (const bounds of [high, low]){
                if (bounds.seriesIndex === null){
                    bounds.seriesIndex = instance.addSecondarySeries(ScriptModuleCommon.SeriesType.LINE, {
                        color: ScriptModuleCommon.getNeutralLinecolour(),
                        title: bounds.title,
                        priceLineVisible: false,
                        lastValueVisible: false,
                        durationKey,
                        lineWidth: 2
                    });
                }
                //console.log('bounds.data', JSON.stringify(bounds.data));
                instance.setSecondarySeriesData(bounds.seriesIndex, bounds.data);
            }

            

            if (bars.length){
                updateStatus(Number(bars[bars.length-1].close), false);
            }
        },

        processNewBar: function(bars){
            const currentBar = bars.length >= 1 ? bars[bars.length-2] : null;
            
            if (!high.data.length || currentBar.utcTime > high.data[high.data.length-1].utcTime){
                addBar(currentBar);
                instance.updateSecondarySeriesBar(simpleMovingAverage.seriesIndex, simpleMovingAverage.data[simpleMovingAverage.data.length-1]);
                instance.updateSecondarySeriesBar(high.seriesIndex, high.data[high.data.length-1]);
                instance.updateSecondarySeriesBar(low.seriesIndex, low.data[low.data.length-1]);
            }
            updateStatus(Number(currentBar.close), true);
        },
        updateLastBar: function(bar){
            simpleMovingAverage.updateLastBar(bar);
            high.data[high.data.length - 1].value = simpleMovingAverage.currentValue + stdDeviations * simpleMovingAverage.stdDeviation;
            low.data[low.data.length - 1].value = simpleMovingAverage.currentValue - stdDeviations * simpleMovingAverage.stdDeviation;
            instance.updateSecondarySeriesBar(simpleMovingAverage.seriesIndex, simpleMovingAverage.data[simpleMovingAverage.data.length-1]);
            instance.updateSecondarySeriesBar(high.seriesIndex, high.data[high.data.length-1]);
            instance.updateSecondarySeriesBar(low.seriesIndex, low.data[low.data.length-1]);
            //console.log(low.data[low.data.length - 1].value, simpleMovingAverage.currentValue, high.data[high.data.length - 1].value);
        },
        processNewPrice: function(price, bars){
            if (!bars.length){
                return;
            }
            if (!high.data.length || bars[bars.length-1].utcTime > high.data[high.data.length - 1].utcTime){
                addBar(bars[bars.length-1]);
            }

            this.updateLastBar(bars[bars.length - 1]);
            updateStatus(price, false);
        },

        isSatisfied: function(){
            return satisfied;
        },

        deactivate: function(){}
    }

    return ret;

}

