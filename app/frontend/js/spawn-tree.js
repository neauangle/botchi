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

import * as Templates from './templates.js';
import * as Util from './util.js';

const frame = document.getElementById("spawn-tree-frame");
const modal = document.getElementById('spawn-tree-modal');
const spawnTreeRoot = document.getElementById("spawn-tree-root");
const okButton = document.getElementById("spawn-tree-ok-button");
export const stopAllButton = document.getElementById("spawn-tree-top-all-button");


function init(){

}


export function isShown(){
    return frame.style.display === 'flex';   
}

export async function show(spawnTree){
    spawnTreeRoot.innerHTML = '';
    spawnTreeRoot.appendChild(spawnTree);
    frame.style.display = 'flex';   
    return makePromise();
}

export function hide(){
    okButton.click();
}

function makePromise(){
    return new Promise(function (resolve, reject) {
        const okay = function(ev){
            if (okButton.disabled){
                return;
            }
            if (!ev.key || ev.key === 'Escape'){
                frame.style.display = 'none';
                resolve();
                document.removeEventListener('keyup', okay);
            } 
        }
        document.addEventListener('keyup', okay);
        frame.addEventListener("mousedown", event => {
            if (!okButton.disabled && !event.target.closest('.shaded-panel')){
                okay({ev: {key:'Escape'}});
            }
        }); 

        okButton.addEventListener("click", okay, {once: true});
    });
}

