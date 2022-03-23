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



const swapHeaderToken = document.getElementById("tracker-swap-header-token");
const swapHeaderComparator = document.getElementById("tracker-swap-header-comparator");
const swapHeaderComparatorPerToken = document.getElementById("tracker-swap-header-comparator-per-token");
const swapHeaderFiatPerToken = document.getElementById("tracker-swap-header-fiat-per-token");
const swapRows = document.getElementById('swap-rows');



export function setTracker(tracker){
    swapRows.innerHTML = '';
    if (!tracker){
        swapHeaderToken.innerText = "---";
        swapHeaderComparator.innerText = "---";
        swapHeaderComparatorPerToken.innerText = "---/---";
        swapHeaderFiatPerToken.innerText= "USD/---";
    } else {
        swapHeaderToken.innerText = tracker.tokenSymbol;
        swapHeaderComparator.innerText = tracker.comparatorSymbol;
        swapHeaderComparatorPerToken.innerText = `${tracker.comparatorSymbol}/${tracker.tokenSymbol}`;
        swapHeaderFiatPerToken.innerText = `USD/${tracker.tokenSymbol}`;

        const currentSecs = Date.now() / 1000;
        for (const swap of tracker.swaps){
            if (!swap.htmlRow){
                const {htmlRow, timeElement} = Templates.getSwapRow(swap);
                swap.htmlRow = htmlRow;
                swap.timeElement = timeElement;
            } 
            
            swapRows.insertBefore(swap.htmlRow, swapRows.firstChild);
            swap.timeElement.innerText = Util.abbreviatedTimeSinceSecondsAgo(currentSecs-swap.timestamp);
        }
    }
}


export function add(swap){
    const {htmlRow, timeElement} = Templates.getSwapRow(swap);
    swap.htmlRow = htmlRow;
    swap.timeElement = timeElement;
    swapRows.insertBefore(htmlRow, swapRows.firstChild);
    if (swapRows.children.length > 100){
        Util.removeElementSafe(swapRows.lastChild);
    }
}