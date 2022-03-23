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
export const EVENT = {
    MOUSE_MOVE: "MOUSE_MOVE",
    MOUSE_UP: "MOUSE_UP",
    MOUSE_DOWN: "MOUSE_DOWN"
}

const tooltipShell = document.getElementById("tooltip-shell");
const tooltip = document.getElementById("tooltip");
let tooltipOn = false;
let mousePos = {x: 0, y: 0};



document.addEventListener('mousemove', (ev) => {   
    let delta = {y: ev.y - mousePos.y, x: ev.x - mousePos.x}
    mousePos = ev;
    if (tooltipShell.style.opacity && tooltipShell.style.opacity != '0'){
        tooltipShell.style.left = ev.x + "px";
        tooltipShell.style.top = (ev.y - tooltipShell.getBoundingClientRect().height) + "px";
    }

    emitter.emitEvent(EVENT.MOUSE_MOVE, {ev, delta});
});

document.addEventListener('mouseup', ev => {
    emitter.emitEvent(EVENT.MOUSE_UP, ev);
});
document.addEventListener('mousedown', ev => {
    emitter.emitEvent(EVENT.MOUSE_DOWN, ev);
});
/* 
//not super accurate for some reason...
export function mouseIn(element){
    var rect = element.getBoundingClientRect();
    if (mousePos.x > rect.left && mousePos.x < rect.left+rect.x
    && mousePos.y > rect.top && mousePos.y < rect.top+rect.y){
        return true;
    }
}
 */

export function position(relativeToElement){
    if (!relativeToElement){
        return mousePos;
    }
    const rect = relativeToElement.getBoundingClientRect();
    const x = mousePos.x - rect.left; //x position within the element.
    const y = mousePos.y - rect.top;  //y position within the element.
    return {x, y};
    
}

export function setElementTooltip(element, message, options){
    if (element.hasAttribute('botchi-tooltip')){
        element.setAttribute('botchi-tooltip', message);
        return
    }
    element.setAttribute('botchi-tooltip', message);
    element.addEventListener('mouseenter', (e) => {
        if (!element.classList.contains('disabled')){
            if (options && options.textAlign){
                tooltip.style.textAlign = options.textAlign;
            } else {
                tooltip.style.textAlign = 'center';
            }
            if (options && options.bottomPadding){
                tooltipShell.style.paddingBottom = options.bottomPadding;
            } else {
                tooltipShell.style.paddingBottom = '10px';
            }
            
            tooltip.innerHTML = element.getAttribute('botchi-tooltip');
            if (!tooltipOn){
                Util.fadeObjectInSuperFast(tooltipShell);
                tooltipOn = true;
            }  
        }
        
    });
    element.addEventListener('mouseleave', (e) => {
        if (tooltipOn){
            Util.fadeObjectOutSuperFast(tooltipShell);
            tooltipOn = false;
        }
    });
}

