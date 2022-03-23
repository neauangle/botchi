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

export const NAME = "Timer";
export const VERSION = "0.0.0";

export const TYPE_PARAM_INDEX = 0;
export const TIMER_PARAM_INDEX = 1;
export const DATE_PARAM_INDEX = 2;

export const STATIC_OPTIONS_TYPE = ['Date', 'Timer'];
 

export function getDescription(){ 
    return "Awaits for a certain amount of time. The format for durations are HH:MM:SS.MS filled from right to left (e.g. 13:01 is 13 mins and 1 sec " 
    + "and 0.500 is 500 milliseconds. The format for times are 24-hour with optional colon (e.g. 01:30) in local time, or ISO8601 with seconds optional (e.g. 2021-10-13T12:13)";
}

export function getTitle(customParameters){
    if (customParameters[TYPE_PARAM_INDEX].value === 'Timer'){
        if (customParameters[TIMER_PARAM_INDEX].valid){
            return '⧖ ' + customParameters[TIMER_PARAM_INDEX].value;
        } 
    } else {
        const parameter = customParameters[DATE_PARAM_INDEX];
        if (parameter.valid){
            if (ISO8601_REGEX.test(parameter.value)){
                return ScriptModuleCommon.XDate.XDate(parameter.value).toLocaleString();
            } else {
                return "NEXT " + parameter.value;
            }
        }
    }

    return "TIME WAIT";
}


export function getResultKeys(){
    return ['done'];
}

export function getDefaultParameters(){
    return [
        {name: 'type', value: 'Timer', type: 'select', visible: true, valid: true, options: 'STATIC_OPTIONS_TYPE'},
        {name: 'timer', value: '00:00', type: 'text', visible: true, valid: true, placeholder: ''},
        {name: 'date', value: '00:00', type: 'text', visible: true, valid: true, placeholder: '24-hour (.e.g 21:00)'}
    ]
}

export function handleTrackerChanged(parameters, extraInfo){
   
}


const TIME_REGEX = /^(\d\d):?(\d\d)$/g; //using g flag keeps track of last index, so only use with matchAll (which necessitates it)
const ISO8601_REGEX = /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(([+-]\d\d:\d\d)|Z)?$/i

export function updateParameterMetaSettings(parameters, changedParameterIndex){
    const parameter = parameters[changedParameterIndex];
    if (parameter.name === 'type'){
        parameters[TIMER_PARAM_INDEX].visible = parameter.value === 'Timer';
        parameters[DATE_PARAM_INDEX].visible = parameter.value === 'Date';
    
    } else if (parameter.name === 'Timer'){
        parameter.value = parameter.value.trim();
        const totalMilliseconds = ScriptModuleCommon.Util.formatColonsToSeconds(parameter.value) * 1000;
        parameter.valid = !isNaN(totalMilliseconds) && Number(totalMilliseconds) >= 0;

    } else if (parameter.name === 'Date'){
        if (ISO8601_REGEX.test(parameter.value)){
            parameter.valid = true;
        } else {
            const match = [...parameter.value.matchAll(TIME_REGEX)][0];
            const hours = match ? Number(match[1]) : null;
            const minutes = match ? Number(match[2]) : null;
            if (match && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59){
                parameter.valid = true;
            } else {
                parameter.valid = false;
            }
        }
    }

    
}




export function getInstance(customParameters){

    const instance = ScriptModuleCommon.getModuleInstance();

    const activate = async function(priceOnActivation, outerRowIndex, rowResults, localVariabless, tracker){
        const activationCount = instance.activationCount;

        let totalMilliseconds;
        const type = customParameters[TYPE_PARAM_INDEX].value;
        if (type === 'Date'){
            const parameter = customParameters[DATE_PARAM_INDEX];
            let targetDate;
            if (ISO8601_REGEX.test(parameter.value)){
                targetDate = ScriptModuleCommon.XDate.XDate(parameter.value);
            } else {
                const match = [...parameter.value.matchAll(TIME_REGEX)][0];
                const hours = Number(match[1]);
                const minutes = Number(match[2]);
                const now = ScriptModuleCommon.XDate.XDate();
                targetDate = ScriptModuleCommon.XDate.XDate().setHours(hours).setMinutes(minutes).setSeconds(0);
                if (now.diffSeconds(targetDate) <= 0){
                    targetDate.addDays(1);
                }
            }
            instance.addOutputLineSilently("Date: " + targetDate.toLocaleString());
            totalMilliseconds = ScriptModuleCommon.XDate.XDate().diffMilliseconds(targetDate);
        } else {
            totalMilliseconds = ScriptModuleCommon.Util.formatColonsToSeconds(customParameters[TIMER_PARAM_INDEX].value) * 1000;
        }

        instance.addOutputLineSilently("Seconds: " + ScriptModuleCommon.Util.roundAccurately(totalMilliseconds / 1000, 3));
        let lastOutputLine = ScriptModuleCommon.Util.formatSecondsToColons(totalMilliseconds / 1000, true)
        instance.addOutputLine(lastOutputLine);

        const start = Date.now();
        const intervalKey = setInterval(function() {
            if (!instance.isActive || activationCount !== instance.activationCount){
                clearInterval(intervalKey);
                return;
            }
            const elapsedMS = Date.now() - start;
            const MSToGo = totalMilliseconds - elapsedMS;
            let timestring; 
            if (MSToGo <= 0){
                timestring = ScriptModuleCommon.Util.formatSecondsToColons(0, true);
            } else {
                timestring = ScriptModuleCommon.Util.formatSecondsToColons(MSToGo / 1000, true);
            }
            
            if (lastOutputLine !== timestring){
                instance.editOutputLine(undefined, timestring);
                lastOutputLine = timestring;
                if (timestring === "00:00.000"){
                    clearInterval(intervalKey);
                    instance.finish('done', 0);
                }
            }
            
        }, 100);
    }

    instance.registerFunctions({activate});

    return instance;
}
