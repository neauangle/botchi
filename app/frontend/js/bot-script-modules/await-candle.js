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
export const NAME = "AwaitNextCandle";
export const VERSION = "0.0.0";

export const STATIC_OPTIONS_TIME_SCALE = ['1m', '15m', '1h', '4h', '1d'];

export const TIME_SCALE_PARAM_INDEX = 0;

export function getDescription(){
    return "Awaits until a new candle.";
}

export function getTitle(customParameters){
    return 'AWAIT NEXT ' + customParameters[TIME_SCALE_PARAM_INDEX].value;
}


export function getResultKeys(){
    return ['done'];
}

export function getDefaultParameters(){
    return [
        {name: 'candle', value: '1m', type: 'select', visible: true, valid: true, options: 'STATIC_OPTIONS_TIME_SCALE'},
    ]
}

export function handleTrackerChanged(parameters, extraInfo){}

export function updateParameterMetaSettings(parameters, changedParameterIndex, extraInfo){} 

export function getInstance(customParameters){
    const instance = ScriptModuleCommon.getModuleInstance();
    instance.registerFunctions({
        activate: () => {
            instance.addOutputLine(`Waiting for a new ${customParameters[TIME_SCALE_PARAM_INDEX].value} candle...`);
        },
        candlesClosed: durations => {
            if (durations.includes(customParameters[TIME_SCALE_PARAM_INDEX].value)){
                instance.finish('done', 0);
            }
        },
    });
    return instance;
}