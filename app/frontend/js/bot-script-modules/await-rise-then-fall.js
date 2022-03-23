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

import * as AwaitRiseThenFallOrFallThenRiseBase from './await-rise-then-fall-or-fall-then-rise-base.js';
export function init(scriptModuleCommon){
    AwaitRiseThenFallOrFallThenRiseBase.init(scriptModuleCommon);
}
export const GROUP_NAME = "Triggers";
export const NAME = "AwaitRiseThenFall";
export const VERSION = "0.0.0";
export const STATIC_OPTIONS_FALL_PERCENT_OF = AwaitRiseThenFallOrFallThenRiseBase.STATIC_OPTIONS_FALL_PERCENT_OF;

export function getDescription(){
    return AwaitRiseThenFallOrFallThenRiseBase.getDescription(AwaitRiseThenFallOrFallThenRiseBase.TYPE.AWAIT_RISE_THEN_FALL);
}

export function getTitle(customParameters){
    return AwaitRiseThenFallOrFallThenRiseBase.getTitle(AwaitRiseThenFallOrFallThenRiseBase.TYPE.AWAIT_RISE_THEN_FALL, customParameters);
}

export function getInstance(customParameters){
    return AwaitRiseThenFallOrFallThenRiseBase.getInstance(AwaitRiseThenFallOrFallThenRiseBase.TYPE.AWAIT_RISE_THEN_FALL, customParameters);
}

export function getResultKeys(){
    return AwaitRiseThenFallOrFallThenRiseBase.getResultKeys();
}

export function getDefaultParameters(){
    return AwaitRiseThenFallOrFallThenRiseBase.getDefaultParameters(AwaitRiseThenFallOrFallThenRiseBase.TYPE.AWAIT_RISE_THEN_FALL);
}

export function handleTrackerChanged(parameters, extraInfo){
    return AwaitRiseThenFallOrFallThenRiseBase.handleTrackerChanged(AwaitRiseThenFallOrFallThenRiseBase.TYPE.AWAIT_RISE_THEN_FALL, parameters, extraInfo);
}

export function updateParameterMetaSettings(parameters, changedParameterIndex, extraInfo){
    return AwaitRiseThenFallOrFallThenRiseBase.updateParameterMetaSettings(parameters, changedParameterIndex, extraInfo);
}
