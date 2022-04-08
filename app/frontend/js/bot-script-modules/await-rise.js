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

import * as AwaitRiseOrFallBase from './await-rise-or-fall-base.js';
export function init(scriptModuleCommon){
    AwaitRiseOrFallBase.init(scriptModuleCommon);
}
export const GROUP_NAME = "Triggers";
export const NAME = "AwaitRise";
export const VERSION = "0.0.0";

export const STATIC_OPTIONS_TIME_SCALE = AwaitRiseOrFallBase.STATIC_OPTIONS_TIME_SCALE;


export function getTitle(customParameters){
    return AwaitRiseOrFallBase.getTitle(AwaitRiseOrFallBase.TYPE.AWAIT_RISE, customParameters);
}

export function getInstance(customParameters){
    return AwaitRiseOrFallBase.getInstance(AwaitRiseOrFallBase.TYPE.AWAIT_RISE, customParameters);
}

export function getResultKeys(){
    return AwaitRiseOrFallBase.getResultKeys();
}

export function getDefaultParameters(){
    return AwaitRiseOrFallBase.getDefaultParameters(AwaitRiseOrFallBase.TYPE.AWAIT_RISE);
}

export function handleTrackerChanged(parameters, extraInfo){
    return AwaitRiseOrFallBase.handleTrackerChanged(AwaitRiseOrFallBase.TYPE.AWAIT_RISE, parameters, extraInfo);
}

export function updateParameterMetaSettings(parameters, changedParameterIndex, extraInfo){
    return AwaitRiseOrFallBase.updateParameterMetaSettings(parameters, changedParameterIndex, extraInfo);
}
