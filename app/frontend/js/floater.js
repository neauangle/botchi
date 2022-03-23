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
import * as Mouse from './mouse.js';
import * as Util from './util.js';

const floaters = document.getElementById("floaters");


export async function createAtMouse(message){
    const floater = Templates.getFloater(message);
    floaters.appendChild(floater);
    floater.style.left = Mouse.position().x + 'px';
    floater.style.top = (Mouse.position().y - floater.getBoundingClientRect().height) + "px";
    await Util.wait(1000);
    floater.classList.add('botchi-animate-opacity-out');
    await Util.wait(2000);
    Util.removeElementSafe(floater);
} 