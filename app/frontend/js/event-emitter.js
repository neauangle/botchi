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


export function instance(){
    const ret = {};
    const eventTarget = (() => {
        let eventTarget = new EventTarget();
        let target = document.createTextNode(null);
        eventTarget.addEventListener = target.addEventListener.bind(target);
        eventTarget.removeEventListener = target.removeEventListener.bind(target);
        eventTarget.dispatchEvent = target.dispatchEvent.bind(target);
        return eventTarget;
    })();
    ret.addEventListener = eventTarget.addEventListener;
    ret.removeEventListener = eventTarget.removeEventListener;
    ret.emitEvent = function(name, data){
        const event = new CustomEvent(name);
        event.data = data
        eventTarget.dispatchEvent(event);
    }

    return ret;
}
