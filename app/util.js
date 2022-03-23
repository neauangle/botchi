"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.prePadNumber = exports.waitMs = exports.removeArrayItemAll = exports.removeArrayItemOnce = exports.getFiles = exports.getDirectories = void 0;
const fs = require('fs');
function getDirectories(path) {
    return fs.readdirSync(path).filter((file) => {
        return fs.statSync(path + '/' + file).isDirectory();
    });
}
exports.getDirectories = getDirectories;
function getFiles(path) {
    return fs.readdirSync(path).filter((file) => {
        return fs.statSync(path + '/' + file).isFile();
    });
}
exports.getFiles = getFiles;
//https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array
function removeArrayItemOnce(arr, value) {
    var index = arr.indexOf(value);
    if (index > -1) {
        arr.splice(index, 1);
    }
    return arr;
}
exports.removeArrayItemOnce = removeArrayItemOnce;
//https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array
function removeArrayItemAll(arr, value) {
    var i = 0;
    while (i < arr.length) {
        if (arr[i] === value) {
            arr.splice(i, 1);
        }
        else {
            ++i;
        }
    }
    return arr;
}
exports.removeArrayItemAll = removeArrayItemAll;
async function waitMs(ms) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, ms);
    });
}
exports.waitMs = waitMs;
function prePadNumber(num, places) {
    return num.toString().padStart(places, '0');
}
exports.prePadNumber = prePadNumber;
