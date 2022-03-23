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

const fs = require('fs');

function getDirectories(path: string) {
    return fs.readdirSync(path).filter( (file: File) => {
        return fs.statSync(path+'/'+file).isDirectory();
    });
}

function getFiles(path: string) {
    return fs.readdirSync(path).filter( (file: File) => {
        return fs.statSync(path+'/'+file).isFile();
    });
}


//https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array
function removeArrayItemOnce(arr: Array<any>, value:any) {
    var index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
  }
//https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array
function removeArrayItemAll(arr: Array<any>, value:any) {
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


async function waitMs(ms: number) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, ms)
    })
}


function prePadNumber(num: number, places: number){
    return num.toString().padStart(places, '0');
}


export {getDirectories, getFiles, removeArrayItemOnce, removeArrayItemAll, waitMs, prePadNumber};