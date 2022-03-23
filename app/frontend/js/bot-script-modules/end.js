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

export const NAME = "End";
export const VERSION = "0.0.0";

export const TRACKER_NEUTRAL = true; 

export function getDescription(){
    return "Represents the end of a task chain. Bot is finished."
}

export function getTitle(customParameters){
    return "END";
}

export function getOutputs(){
    return ['done'];
}

export function getDefaultParameters(){
    return [];
}

export function handleTrackerChanged(parameters, extraInfo){}


export function updateParameterMetaSettings(parameters, changedParameterIndex){}


export function getInstance(customParameters){
    const instance = ScriptModuleCommon.getModuleInstance();
    instance.registerFunctions({
        activate: function(){
            instance.finish('done', 0);
        }
    });
    
    return instance;
}


