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

import * as Util from '../frontend/js/util.js';
import * as BaseFrontend from './cex-frontend-module.js';
const emitter = BaseFrontend.emitter; export {emitter};

const TRACKER_DETAILS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

const trackerDetailsCache = {};

let coingeckoCoins;


export async function attachTrackerDetailsElement(parent, tracker){
    if (trackerDetailsCache[tracker.id]){
        parent.appendChild(trackerDetailsCache[tracker.id].element);
    } else {
        const htmlString = `
        <div class="default-frontend-tracker-details">
            <div>
                <label class="binance-frontend-tracker-details-coingecko-id-label">Coingecko ID: </label><input class="binance-frontend-tracker-details-coingecko-id">
                <label>Market cap: </label><label class="binance-frontend-tracker-details-market-cap">...</label>
                <label>24hr volume: </label><label class="binance-frontend-tracker-details-24hr-volume">...</label>
            </div>
            <div>
                <label class="binance-frontend-tracker-details-coingecko-id-hint-label">Possible ID matches: </label><label class="binance-frontend-tracker-details-coingecko-id-hint"></label>
            </div>
        </div>
        `
        const dummyParent = document.createElement('div');
        dummyParent.innerHTML = htmlString;
        const detailsElement = dummyParent.firstElementChild;
        parent.appendChild(detailsElement);
        trackerDetailsCache[tracker.id] = {element: detailsElement, coingeckoId: tracker.coingeckoId, iter: 0};
        const geckoIdLabel = detailsElement.getElementsByClassName('binance-frontend-tracker-details-coingecko-id-label')[0];
        const geckoIdInput = detailsElement.getElementsByClassName('binance-frontend-tracker-details-coingecko-id')[0];
        const geckoIdHintLabel = detailsElement.getElementsByClassName('binance-frontend-tracker-details-coingecko-id-hint-label')[0];
        const geckoIdHint = detailsElement.getElementsByClassName('binance-frontend-tracker-details-coingecko-id-hint')[0];
        geckoIdLabel.style.visibility = 'hidden';
        geckoIdInput.style.visibility = 'hidden';
        geckoIdHintLabel.style.visibility = 'hidden';
        geckoIdHint.style.visibility = 'hidden';

        if (!coingeckoCoins){
            try {
                coingeckoCoins = await window.bridge.callBackendFunction(tracker.backendIndex, 'getCoingeckoCoins');
            } catch (error){
                console.log('error getCoingeckoCoins: ', error);
                delete trackerDetailsCache[tracker.id];
                return;
            }
        }

        const matchingIds = [];
        const tokenSymbol = tracker.tokenSymbol.toLowerCase();
        for (const coingeckoCoin of coingeckoCoins){
            if (coingeckoCoin.symbol === tokenSymbol){
                matchingIds.push(coingeckoCoin.id);
            }
        }

        if (matchingIds.length === 1){
            tracker.coingeckoId = matchingIds[0];
            fillTrackerDetails(tracker, detailsElement, trackerDetailsCache[tracker.id].iter);
            return;
        } 

        geckoIdLabel.style.visibility = 'visible';
        geckoIdInput.style.visibility = 'visible';
        geckoIdHintLabel.style.visibility = 'visible';
        geckoIdHint.style.visibility = 'visible';
        if (matchingIds.length){
            for (const id of matchingIds){
                geckoIdHint.innerText += (geckoIdHint.innerText ? ', ' : '') + id;
            }
        } else {
            geckoIdHint.innerText = 'No matches...'
        }

        if (tracker.coingeckoId){
            geckoIdInput.value = tracker.coingeckoId;
            fillTrackerDetails(tracker, detailsElement, trackerDetailsCache[tracker.id].iter);
        }
        geckoIdInput.addEventListener('change', () => {
            if (geckoIdInput.value){
                tracker.coingeckoId = geckoIdInput.value;
                window.bridge.callBackendFunction(tracker.backendIndex, 'updateCoingeckoId', {id: tracker.id, coingeckoId: tracker.coingeckoId});
                trackerDetailsCache[tracker.id].iter += 1;
                fillTrackerDetails(tracker, detailsElement, trackerDetailsCache[tracker.id].iter);
            }
        });
    }
}

async function fillTrackerDetails(tracker, detailsElement, iter){
    if (tracker.removed){
        delete trackerDetailsCache[tracker.id];
        return;
    }
    if (iter !== trackerDetailsCache[tracker.id].iter){
        return;
    }
    const marketCapElement = detailsElement.getElementsByClassName('binance-frontend-tracker-details-market-cap')[0];
    const volumeElement = detailsElement.getElementsByClassName('binance-frontend-tracker-details-24hr-volume')[0];
    let result;
    try {
        const urlBase =  `https://api.coingecko.com/api/v3/simple/price?`;
        const query = `ids=${tracker.coingeckoId}&vs_currencies=usd&include_market_cap=true&include_last_updated_at=true&include_24hr_vol=true`;
        result = await (await fetch(urlBase + query)).json();
        if (result.error){
            throw result.error ? result.error : '';
        } 
        result = result[tracker.coingeckoId];
        if (!result){
            marketCapElement.innerText = `Unknown`;
            volumeElement.innerText = `Unknown`;
            return;
        }
    } catch (error){
        console.log(tracker.name, error);
        if (tracker.removed){
            delete trackerDetailsCache[tracker.id];
        }
        if (tracker.removed || iter !== trackerDetailsCache[tracker.id].iter){
            return;
        }
        setTimeout(()=>{fillTrackerDetails(tracker, detailsElement, iter)}, 5 * 60 * 1000);
        return;
    }

    if (tracker.removed){
        delete trackerDetailsCache[tracker.id];
    }
    if (tracker.removed || iter !== trackerDetailsCache[tracker.id].iter){
        return;
    }

    marketCapElement.innerText = '$' + Util.locale(result.usd_market_cap);
    volumeElement.innerText = '$' + Util.locale(result.usd_24h_vol);
    setTimeout(()=>{fillTrackerDetails(tracker, detailsElement, iter)}, TRACKER_DETAILS_UPDATE_INTERVAL_MS);
   
    
}











export async function createAddTrackerSubmodule(backendId, formParent){
    return BaseFrontend.createAddTrackerSubmodule('binance', backendId, formParent);
}