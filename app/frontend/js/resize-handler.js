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

import * as Mouse from './mouse.js';
import * as Emitter from  './event-emitter.js'; const emitter = Emitter.instance(); export {emitter};
import * as Util from './util.js';

export const EVENT = {
    PROPORTION_UPDATED: 'PROPORTION_UPDATED', //happens as mouse is moving
    PROPORTION_SET: 'PROPORTION_SET' //emits once mouse is released
};

const resizeInfos = [{
        key: 'trackerTopFrameHeightProportion',
        axis: 'y',
        containingFrame: document.getElementById("tracker-top-and-swap-frame"),
        frame1: document.getElementById("tracker-top-frame"),
        frame2: document.getElementById("tracker-swap-frame"),
        separator: document.getElementById("tracker-top-swap-separator"),
        frame1P: 0,
        separatorNew: 0,
        resizing: false,
        forceClosed: false,
    }, {
        key: 'trackerChartWidthProportion',
        axis: 'x',
        containingFrame: document.getElementById("tracker-top-frame"),
        frame1: document.getElementById("tracker-chart-frame"),
        frame2: document.getElementById("tracker-bot-area-frame"),
        separator: document.getElementById("tracker-chart-bot-area-separator"),
        frame1P: 0,
        separatorNew: 0,
        resizing: false,
        forceClosed: false,
    }
];
const elementToPointerEvents = new Map();

export function toggleForceClosed(key){
    for (const resizeInfo of resizeInfos){
        if (resizeInfo.key === key){
            const dimProperty = resizeInfo.axis === 'y' ? 'height' : 'width';
            if (resizeInfo.frame2.style.display === 'none'){
                resizeInfo.frame2.style.display = 'flex';
                resizeInfo.frame1.style[dimProperty] =  resizeInfo.frame1P+'%';
                resizeInfo.frame2.style[dimProperty] =  (100-resizeInfo.frame1P)+'%';
            } else {
                resizeInfo.frame2.style.display = 'none';
                resizeInfo.frame1.style[dimProperty] = '100%';
                resizeInfo.frame2.style[dimProperty] =  '0%';
            }
            resizeInfo.forceClosed =  resizeInfo.frame2.style.display === 'none';
        }
        emitter.emitEvent(EVENT.PROPORTION_UPDATED);
        return resizeInfo.frame2.style.display === 'flex';
    }
}

export function init(userInfo){
    
    for (const resizeInfo of resizeInfos){
        if (userInfo.hasOwnProperty(resizeInfo.key)){
            const dimProperty = resizeInfo.axis === 'y' ? 'height' : 'width';
            const offsetProperty =  resizeInfo.axis === 'y' ? 'offsetTop' : 'offsetLeft';
            resizeInfo.frame1P = userInfo[resizeInfo.key]*100;
            resizeInfo.frame1.style[dimProperty] =  resizeInfo.frame1P+'%';
            resizeInfo.frame2.style[dimProperty] =  (100-resizeInfo.frame1P)+'%';
            const separator = resizeInfo.separator;
            separator.addEventListener('mousedown', e => {
                if (resizeInfo.forceClosed){
                    return;
                }
                for (const element of document.body.children){
                    elementToPointerEvents.set(element, element.style.pointerEvents);
                    element.style.pointerEvents = 'none';
                }
                resizeInfo.resizing = true;
                resizeInfo.separatorNew = (
                    separator[offsetProperty]
                    - resizeInfo.containingFrame[offsetProperty]
                    + 0.5 * separator.getBoundingClientRect()[dimProperty]
                );
                separator.classList.add('selected');
                document.body.style.cursor = resizeInfo.axis === 'y' ? "ns-resize" : "ew-resize";
            });
        }
    }
}


Mouse.emitter.addEventListener(Mouse.EVENT.MOUSE_MOVE, ev => {
    for (const resizeInfo of resizeInfos){
        if (resizeInfo.forceClosed){
            continue;
        }
        if (resizeInfo.resizing){
            const dimProperty = resizeInfo.axis === 'y' ? 'height' : 'width';
            resizeInfo.separatorNew += ev.data.delta[resizeInfo.axis];
            let p =  100*(resizeInfo.separatorNew / resizeInfo.containingFrame.getBoundingClientRect()[dimProperty]);
            resizeInfo.frame1.style[dimProperty] = p+'%';
            resizeInfo.frame2.style[dimProperty] = (100-p) + '%';
            emitter.emitEvent(EVENT.PROPORTION_UPDATED);
            break;
        }
    }
});


Mouse.emitter.addEventListener(Mouse.EVENT.MOUSE_UP, () => {
    for (const resizeInfo of resizeInfos){
        if (resizeInfo.forceClosed){
            continue;
        }
        if (resizeInfo.resizing){
            const dimProperty = resizeInfo.axis === 'y' ? 'height' : 'width';
            resizeInfo.resizing = false;
            resizeInfo.separator.classList.remove('selected');
            let p =  100*(resizeInfo.separatorNew / resizeInfo.containingFrame.getBoundingClientRect()[dimProperty]);
            for (const element of elementToPointerEvents.keys()){
                element.style.pointerEvents = elementToPointerEvents.get(element);
            }
            elementToPointerEvents.clear();
            resizeInfo.frame1P = p;
            emitter.emitEvent(EVENT.PROPORTION_SET, {key: resizeInfo.key, p: Util.clamp(p/100, 0, 1)});
            document.body.style.cursor = 'default';
            break;
        }
    }
});
