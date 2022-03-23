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

//https://gist.github.com/djD-REK/068cba3d430cf7abfddfd32a5d7903c3
//doe snot work if number is already in exponential notation.
export function roundAccurately(number, decimalPlaces, padAsString){
    const ret =  Number(Math.round(number + "e" + decimalPlaces) + "e-" + decimalPlaces);
    if (padAsString){
        return padAfterDecimalPlaces(ret, decimalPlaces);
    } else {
        return ret;
    }
}

export function padAfterDecimalPlaces(number, decimalPlaces){
    if (Number.isInteger(number)){
        return `${number}.${'0'.repeat(decimalPlaces)}`;
    } else {
        return number.toFixed(decimalPlaces);
    }
}

export function prePadNumber(num, places){
    return num.toString().padStart(places, '0');
}


export function locale(n){
    return n.toLocaleString(undefined, {maximumFractionDigits: 10});
}

/* export function getGlobalOffset(element) {
    const rect = element.getBoundingClientRect();
    return {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY
    };
} */

export function getGlobalBounds(element) {
const rect = element.getBoundingClientRect();
    return {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        right: rect.left + window.scrollX + rect.width,
        bottom: rect.top + window.scrollY + rect.height,
    };
}

export function getRelativeMouseFromElement(e, element){
    var rect = element.getBoundingClientRect();
    var relativeX = e.clientX - rect.left;
    var relativeY = e.clientY - rect.top;   
    const proportionX = relativeX / rect.width;
    const proportionY = relativeY / rect.height;
    return {relativeX, relativeY, proportionX, proportionY}
}

export function formatSecondsToColons(seconds, includeMS=false){
    let prepend = '';
    if (seconds < 0){
        seconds = -seconds
        prepend = '-';
    }
    let timeString = new Date(1000 * seconds).toISOString()
    if (includeMS){
        timeString = timeString.substr(11, 12);
    } else {
        timeString = timeString.substr(11, 8);
    }
    if (timeString.startsWith('00')){
        timeString = timeString.slice(3);
    }

    return prepend+timeString;
}

//doesn't handle days
export function formatColonsToSeconds(colonString){
    let sign = 1;
    if (colonString.startsWith('-')){
        sign = -1;
        colonString = colonString.slice(1);
    }
    const parts = colonString.split(':');
    parts.reverse();
    parts[0] = parts[0].replace(',', '.');
    let seconds = 0;
    for (let i = 0; i < parts.length; ++i){
        seconds += Number(parts[i]) * (60**i);
    }
    return sign*seconds;
}


const intervals = [
    { label: 'y', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'd', seconds: 86400 },
    { label: 'h', seconds: 3600 },
    { label: 'm', seconds: 60 },
    { label: 's', seconds: 1 }
];

export function abbreviatedTimeSinceSecondsAgo(seconds) {
    if (seconds < 60){
        return '<1m';
    }
    const interval = intervals.find(i => i.seconds < seconds);
    const count = Math.floor(seconds / interval.seconds);
    return `${count}${interval.label}`;
}


export async function wait(ms) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, ms)
    });
} 

export async function waitSeconds(s) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, s*1000)
    })
}





export function fadeObjectInFast(obj){
    obj.classList.remove('botchi-animate-opacity-out-fast');
    obj.classList.remove('botchi-animate-opacity-out-super-fast');
    obj.style.opacity = 1;
    obj.classList.add('botchi-animate-opacity-in-fast');
}

export function fadeObjectOutFast(obj){
    obj.classList.remove('botchi-animate-opacity-in-fast');
    obj.classList.remove('botchi-animate-opacity-in-super-fast');
    obj.style.opacity = 0;
    obj.classList.add('botchi-animate-opacity-out-fast');
}

export function fadeObjectInSuperFast(obj){
    obj.classList.remove('botchi-animate-opacity-out-fast');
    obj.classList.remove('botchi-animate-opacity-out-super-fast');
    obj.style.opacity = 1;
    obj.classList.add('botchi-animate-opacity-in-super-fast');
}

export function fadeObjectOutSuperFast(obj){
    obj.classList.remove('botchi-animate-opacity-in-fast');
    obj.classList.remove('botchi-animate-opacity-in-super-fast');
    obj.style.opacity = 0;
    obj.classList.add('botchi-animate-opacity-out-super-fast');
}


export function getCSSVariable(variable){
    return getComputedStyle(document.documentElement).getPropertyValue(variable);
}

export function clamp(value, minimum, maximum){
    return value < minimum ? minimum : value > maximum ? maximum : value;
}


export function sortArrayOfObjectsOnProperty({array, property, caseSensitive}){
    array.sort((a, b) => {
        const aProperty = caseSensitive ? a[property] : a[property].toLowerCase();
        const bProperty = caseSensitive ? b[property] : b[property].toLowerCase();
        if (aProperty === bProperty) {
            return 0;
        }
        return aProperty < bProperty ? -1 : 1;
    });
}

//https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array
export function removeArrayItemOnce(arr, value) {
    var index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
  }
//https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array
export function removeArrayItemAll(arr, value) {
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


export function average(array){
    if (!array.length){
        return 0;
    }
    let sum = 0;
    for (const item of array){
        sum += item;
    }
    return sum / array.length;
}


export function angleBetweenVectors(v1, v2){
    return  Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.sqrt(v1[0]**2 + v1[1]**2) * Math.sqrt(v2[0]**2 + v2[1]**2)))
}


export function addOptionToSelect(selectNode, optionNode, func){
    let childToInsertBefore = null;
    for (const child of selectNode.children){
        if (func(child, optionNode)){
            childToInsertBefore = child;
            break;
        }
    }
    if (childToInsertBefore){
        selectNode.insertBefore(optionNode, childToInsertBefore);
    } else {
        selectNode.appendChild(optionNode);
    }
    selectNode.value = optionNode.value;
}


const VALID_ERC20_REGEX = /^0x[a-fA-F0-9]{40}$/;
export function isValidERC20(string){
    return VALID_ERC20_REGEX.test(string);
} 

const VALID_ERC20_PRIVATE_KEY_REGEX = /^[a-fA-F0-9]{64}$/;
export function isValidERC20PrivateKey(string){
    console.log(string, string.length, VALID_ERC20_PRIVATE_KEY_REGEX.test(string));
    return VALID_ERC20_PRIVATE_KEY_REGEX.test(string);
} 




const validEmailRegex = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
export function isProbablyValidEmail(string){
    return validEmailRegex.test(string);
} 



export function toCapitalCase(string){
    let ret = '';
    for (const word of string.split(' ')){
        ret += word.length >= 2 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toUpperCase();
        ret += ' ';
    }
    return ret.trim();
}




export async function getFilePath(){
    let lock = false;
    return new Promise((resolve, reject) => {
        const input = document.createElement('input')
        input.id = +new Date()
        input.style.display = 'none'
        input.setAttribute('type', 'file')
        document.body.appendChild(input)

        input.addEventListener('change', () => {
            lock = true
            const file = input.files[0].path;
            resolve(file)
            document.body.removeChild(document.getElementById(input.id))
        }, { once: true })

        window.addEventListener('focus', () => {
            setTimeout(() => {
                if (!lock && document.getElementById(input.id)) {
                    resolve(null);
                    document.body.removeChild(document.getElementById(input.id))
                }
            }, 300)
        }, { once: true })

        input.click()
    })
}



export function htmlEncode(str, keepSpaces=false) {
    str = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    if (keepSpaces){
        str = str.replace(/ /g, '&nbsp;');
    }
    return str;
}


export function spacedAtCapitals(string, capitaliseFirstLetter){
    let spacedString = '';
    for (let i = 0; i < string.length; ++i){
        const c = (i === 0 && capitaliseFirstLetter) ? string[i].toUpperCase() : string[i];
        if (i !== 0 && c.toUpperCase() === c){
            spacedString += ' ';
        }
        spacedString += c;
    }
    return spacedString;
}


//https://stackoverflow.com/a/42210346
//not necessarily on linux but we can just cater for the most strict
export function replaceIllegalCharsInFilename(filename, character){
    if (character === undefined){
        character = '';
    }
    return filename.replace(/[/\\?%*:|"<>]/g, character);
}




/*
https://toranbillups.com/blog/archive/2009/04/21/Cleanup-for-dynamically-generated-DOM-elements-in-IE/
Apparently, this old article from 2009 on IE contained the fix to an egregious memory leak I had in
this chromium-based electron app! This is specifically when stress-testing the trace system. I narrowed it down so that
without adding the trace, everything was fine, but when I added trace pages memory steadily climbed, and not slowly- even though
I was 100% calling .remove on old pages and removing references. It turns out perhaps the browser keeps its own reference
until the page is refreshed or something (which never happens in my app). Whether that is indeed the root of the leak is
who-knows-who-cares because whatever is going on, calling this instead of .remove seems to fix it.

*/
const bin = document.getElementById('element-garbage-bin-browser-leak-workaround');
export function removeElementSafe(el) {
    while (el.childNodes.length > 0) {
        removeElementSafe(el.childNodes[el.childNodes.length - 1]);
    }
    if (el.parentNode){
        el.parentNode.removeChild(el);
    }
    bin.appendChild(el);
    bin.innerHTML = '';
}


export function wireEyeIconToDiv(eyeDiv, input){
    eyeDiv.addEventListener('click', e => {
        if (input.type === 'password'){
            input.type = 'text';
            eyeDiv.getElementsByClassName('eye-icon closed')[0].style.display = 'block';
            eyeDiv.getElementsByClassName('eye-icon open')[0].style.display = 'none';
        } else {
            input.type = 'password';
            eyeDiv.getElementsByClassName('eye-icon closed')[0].style.display = 'none';
            eyeDiv.getElementsByClassName('eye-icon open')[0].style.display = 'block';
        }
        input.focus();
    })
}