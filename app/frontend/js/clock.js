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

import * as Emitter from  './event-emitter.js'; const emitter = Emitter.instance(); export {emitter};
/*
    This clock isn't super dooper accurate, but what it doesn't do is gradually phase out of synch.
*/

export const EVENT = {
   GLOBAL_MINUTE_TICK: "GLOBAL_MINUTE_TICK",
}

export const localTimeOffsetSecs =  -(new Date(0)).getTimezoneOffset() * 60;

export const roundMSDownTo = (roundTo, x) => new Date(Math.floor(x / roundTo) * roundTo );
export const roundMSUpTo = (roundTo, x) => Math.ceil(x / roundTo) * roundTo;
const durationKeyToDuration = {
    '1m':  1000 * 60 * 1,
    '15m': 1000 * 60 * 15,
    '1h':  1000 * 60 * 60,
    '4h':  1000 * 60 * 60 * 4,
    '1d':  1000 * 60 * 60 * 24,
}
export function roundMSDownToDuration(durationKey, x){
    return roundMSDownTo(durationKeyToDuration[durationKey], x);
}
export function roundMSUpToDuration(durationKey, x){
    return roundMSUpTo(durationKeyToDuration[durationKey], x);
}

const INTERVAL_MS = 100;

const startMS = new Date().getTime();
let msAtNextMinute = roundMSUpToDuration('1m', startMS);
let elapsedMS = 0;


export function getLastMSAtLastMinute(){
    return msAtNextMinute - 60*1000;
}

function callback(){
    elapsedMS += INTERVAL_MS;
    const currentMS =  Date.now();
    if (currentMS > msAtNextMinute){
        const durations = [];
        for (const duration of Object.keys(durationKeyToDuration)){
            if (msAtNextMinute % durationKeyToDuration[duration] === 0){
                durations.push(duration);
            }
        }
        emitter.emitEvent(EVENT.GLOBAL_MINUTE_TICK, {currentMS: msAtNextMinute, durations});
        msAtNextMinute = roundMSUpToDuration('1m', msAtNextMinute+1);
    }

    const diff = (currentMS - startMS) - elapsedMS;
    window.setTimeout(callback, (100 - diff));
}
window.setTimeout(callback, 100);


export function getCurrentTimeString(local=true){
    return getTimeString(new Date(), local);
}

export function getTimeString(dateObject, local=true){
    const date = local ? new Date(dateObject.getTime() + localTimeOffsetSecs * 1000) : dateObject;
    const str = date.toISOString().slice(0, 19).replace(/-/g, "/").replace("T", " ");
    return str;
}
