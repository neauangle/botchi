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

//A spinning circle with optional message(s) that blocks input to the rest of the page

const waitingFrame = document.getElementById("waiting-frame");
const waitingMessage = document.getElementById("waiting-message");


export function startWaiting(message){
    waitingFrame.style.display = 'flex'
    waitingMessage.innerHTML = message || "";
}

export function updateMessage(message){
    waitingMessage.innerHTML = message || "";
} 

export function stopWaiting(){
    waitingFrame.style.display = 'none'
}