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
import * as Templates from './templates.js';
import * as Mouse from './mouse.js';
import * as Util from './util.js';

const shell = document.getElementById('context-menu-shell');
let currentPromiseResolve;
shell.style.display = 'none';
let tag = null;

let mouseOver = false;
shell.addEventListener('mouseenter', event => {
    mouseOver = true;
})
shell.addEventListener('mouseleave', event => {
    mouseOver = false;
})

export function forceResolve(){
    if (currentPromiseResolve){
        const temp = currentPromiseResolve;
        currentPromiseResolve = null;
        shell.innerHTML = '';
        shell.style.display = 'none';
        tag = null;
        return temp(null);
    }
}
export function getTag(){
    return tag;
}

export function isShown(){
    return shell.style.display === 'flex';
}

export async function show(items, options){
    if (!items.length){
        return;
    }
    if (currentPromiseResolve){
        shell.innerHTML = '';
        shell.style.display = 'none';
        tag = null;
        currentPromiseResolve(null);
        currentPromiseResolve = null;
    }
    options = options ? options : {};
    tag = options.tag;
    shell.style.left = (options.left !== undefined ? options.left : Mouse.position().x) + 'px';
    shell.style.top = (options.top !== undefined ? options.top : Mouse.position().y) + 'px';
    shell.style.display = 'flex';

    //mouse events dont seem to update as element's display changes
    const bounds = Util.getGlobalBounds(shell)
    if (bounds.left < Mouse.position().x && Mouse.position().x < bounds.right
    && bounds.top < Mouse.position().y && Mouse.position().y < bounds.bottom){
        mouseOver = true;
    } else {
        mouseOver = false;
    }

    (async () => {
        const rect = shell.getBoundingClientRect();
        if (options.forceLeft || rect.x + rect.width + 20 > window.innerWidth){
            shell.style.left = (rect.x - rect.width) + 'px';
        }
        if (rect.y + rect.height + 20 > window.innerHeight){
            shell.style.top = (rect.y - rect.height) + 'px';
        }
    })();
    
    return new Promise((resolve) => {
        currentPromiseResolve = resolve;
        for (const item of items){
            const button = Templates.getContextMenuButton(item);
            shell.appendChild(button);
           
            button.addEventListener('click', event => {
                shell.innerHTML = '';
                shell.style.display = 'none';
                currentPromiseResolve = null;
                tag = null;
                return resolve(item);
            })
        }
        Mouse.emitter.addEventListener("MOUSE_DOWN", event => {
            if (!mouseOver && isShown()){
                shell.innerHTML = '';
                shell.style.display = 'none';
                currentPromiseResolve = null;
                tag = null;
                return resolve(null);
            }
        });
    });
}
