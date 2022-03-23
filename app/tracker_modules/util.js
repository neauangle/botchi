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

const VALID_ERC20_REGEX = /^0x[a-fA-F0-9]{40}$/;


//https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array
function removeArrayItemOnce(arr, value) {
    var index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
  }
//https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array
function removeArrayItemAll(arr, value) {
    var i = 0;
    while (i < arr.length) {
        if (arr[i] === value) {
            arr.splice(i, 1);
        } else {
            ++i;
        }
    }
    return arr;
}


async function waitMs(ms) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, ms)
    })
}




const roundMSDownTo = (roundTo, x) => new Date(Math.floor(x / roundTo) * roundTo );
const roundMSUpTo = (roundTo, x) => Math.ceil(x / roundTo) * roundTo;
const durationKeyToduration = {
    '1m':  1000 * 60 * 1,
    '15m': 1000 * 60 * 15,
    '1h':  1000 * 60 * 60,
    '4h':  1000 * 60 * 60 * 4,
}
function roundMSDownToDuration(durationKey, x){
    return roundMSDownTo(durationKeyToduration[durationKey], x);
}
function roundMSUpToDuration(durationKey, x){
    return roundMSUpTo(durationKeyToduration[durationKey], x);
}


const localTimeOffsetSecs =  -(new Date(0)).getTimezoneOffset() * 60;

function getCurrentTimeString(local=true){
    return getTimeString(new Date(), local);
}

function getTimeString(dateObject, local=true){
    const date = local ? new Date(dateObject.getTime() + localTimeOffsetSecs * 1000) : dateObject;
    const str = date.toISOString().slice(0, 19).replace(/-/g, "/").replace("T", " ");
    return str;
}


//https://stackoverflow.com/a/55292366
function trim(str, ch) {
    var start = 0, 
        end = str.length;

    while(start < end && str[start] === ch)
        ++start;

    while(end > start && str[end - 1] === ch)
        --end;

    return (start > 0 || end < str.length) ? str.substring(start, end) : str;
}



function formatRational(rational, decimals){
    let rationalString = rational.toDecimal(decimals);
    if (rationalString.indexOf('.') >= 0){
        rationalString = trim(rationalString, '0');
        if (rationalString.startsWith('.') || !rationalString){
            rationalString = '0' + rationalString;
        }
    }
    return rationalString;
}

//https://gist.github.com/djD-REK/068cba3d430cf7abfddfd32a5d7903c3
//doe snot work if number is already in exponential notation.
function roundAccurately(number, decimalPlaces){
    return Number(Math.round(number + "e" + decimalPlaces) + "e-" + decimalPlaces);
}



module.exports = {
    removeArrayItemOnce, removeArrayItemAll, waitMs, roundMSDownToDuration, roundMSUpToDuration,
    getTimeString, getCurrentTimeString, trim, formatRational, roundAccurately, VALID_ERC20_REGEX
};