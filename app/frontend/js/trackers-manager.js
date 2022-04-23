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
import * as Chart from './chart.js';
import * as AddTracker from './add-tracker.js';
import * as TrackerButtons from './tracker-buttons.js';
import * as SwapDetails from './swap-details.js';
import * as Clock from './clock.js';
import * as Waiting from './waiting.js';
import * as Util from './util.js';
import * as Prompt from './prompt.js';
import * as ContextMenu from './context-menu.js';

const trackerDetailsPrice = document.getElementById('tracker-details-price');
const trackerDetailsFrontendSpace = document.getElementById('tracker-details-frontend-space');

const FIAT_DECIMALS = 8;


export const EVENTS = {
    TRACKER_REMOVED: "TRACKER_REMOVED",
    TRACKER_ADDED: "TRACKER_ADDED",
    PRICE_UPDATED: "PRICE_UPDATED",
    FIRST_PRICE: "FIRST_PRICE",
    TRACKER_SELECTED: "TRACKER_SELECTED",
    TRACKER_ORDER_UPDATED: "TRACKER_ORDER_UPDATED",
    TRACKER_HISTORY_UPDATED: "TRACKER_HISTORY_UPDATED",
    CANDLES_CLOSED: "CANDLES_CLOSED"
}
//set this using selectTracker
let currentSelectedTracker;
let backendInfos;
let initted = false;

export function init(pBackendinfos, trackerUriStringsInOrder){
    backendInfos = pBackendinfos;

    let firstTracker = null;
    const inittedTrackers = [];
    for (let i = 0; i < trackerUriStringsInOrder.length; ++i){
        let [backendIndex, trackerId] = trackerUriStringsInOrder[i].split('-');
        backendIndex = Number(backendIndex);
        const trackerBackend = backendInfos[backendIndex];
        const tracker = trackerBackend.trackers[trackerId];
        if (tracker){
            initTracker(backendIndex, tracker);
            if (!firstTracker){
                firstTracker = tracker;
            }
            inittedTrackers.push(tracker);
        }
    }
    for (let backendIndex = 0; backendIndex < backendInfos.length; ++backendIndex){
        const backendInfo = backendInfos[backendIndex];
        for (const tracker of Object.values(backendInfo.trackers)){
            if (!inittedTrackers.includes(tracker)){
                initTracker(backendIndex, tracker);
                if (!firstTracker){
                    firstTracker = tracker;
                }
                inittedTrackers.push(tracker);
            }
            
        }
    }
    selectTracker(firstTracker);//okay if null- we need to do this anyway to fix graph (even though we do call it with null before this)
    
    TrackerButtons.emitter.addEventListener(TrackerButtons.EVENTS.ORDER_UPDATED, event => {
        emitter.emitEvent(EVENTS.TRACKER_ORDER_UPDATED, event.data);
    });

    Clock.emitter.addEventListener(Clock.EVENT.GLOBAL_MINUTE_TICK, (event) => {
        const currentSecs =  Math.floor(event.data.currentMS/1000);
        if (currentSelectedTracker){
            for (const swap of currentSelectedTracker.swaps){
                if (swap.timeElement){
                    swap.timeElement.innerText = Util.abbreviatedTimeSinceSecondsAgo(currentSecs-swap.timestamp);
                }

            }
        }

        const utcTime = Math.floor(event.data.currentMS/1000);
        const time = utcTime +  Clock.localTimeOffsetSecs;
        for (const duration of event.data.durations){
            for (const backendInfo of backendInfos){
                for (const tracker of Object.values(backendInfo.trackers)){
                    const bars = tracker.durationToBars[duration];
                    const lastBar = bars[bars.length-1];
                    //we don't add bars on trackers that have not been activated at all this session
                    if (!lastBar || lastBar.utcTime === utcTime){
                        continue;
                    }

                    const lastPrice = lastBar.close;
                    const newBar = {
                        open: lastPrice,
                        high: lastPrice,
                        low: lastPrice,
                        close: lastPrice,
                        utcTime,
                        time,
                        volume: 0,
                    };
                    bars.push(newBar);
                    if (tracker === currentSelectedTracker){
                        if (duration === Chart.getBarDuration()){
                            const addedNewBar = true;
                            Chart.update(bars, addedNewBar);
                        }
                    }
                }
            }
        }
        emitter.emitEvent(EVENTS.CANDLES_CLOSED, event.data);
    });


    initted = true;
}

export function getBackendInfo(backendIndex){
    return backendInfos[backendIndex];
}
export function getBackendNames(){
    return Object.values(backendInfos).map(info => info.name);
}

export async function generalCallbackHandler(event, args){
    if (event === 'toolbar-action'){
        if (args.action === 'add-tracker'){
            AddTracker.show();
        }

    } else  if (event === 'backend-event'){
        const {backendIndex, event,data} = args;
        if (event === 'addTrackerProgress'){
            Waiting.updateMessage(data.message);

        } else if(event === 'historyProgress'){
            const {backendIndex, data} = args;
            const {p, trackerId} = data;
            const tracker = backendInfos[backendIndex].trackers[trackerId];
            tracker.historyProgress = p;
            if (tracker === currentSelectedTracker){
                historyProgress.innerText = (tracker.historyProgress * 100).toFixed(0) + '%';
            }

        } else if (event === 'swap'){
            const swap = data;    
            const tracker = backendInfos[backendIndex].trackers[swap.trackerId];
            if (!tracker){
                return;
            }
            swap.tokenAmount = Number(swap.tokenAmount).toFixed(FIAT_DECIMALS);
            swap.fiatAmount = swap.fiatAmount ? Number(swap.fiatAmount).toFixed(FIAT_DECIMALS) : null;
            swap.comparatorAmount = Number(swap.comparatorAmount).toFixed(FIAT_DECIMALS);
            swap.comparatorPerToken = (swap.comparatorAmount / swap.tokenAmount).toFixed(FIAT_DECIMALS);
            swap.fiatPerToken = swap.fiatAmount ? (swap.fiatAmount / swap.tokenAmount).toFixed(FIAT_DECIMALS) : null;
            swap.htmlRow = null;
            swap.timeElement = null;
            let previousSwap = tracker.swaps[tracker.swaps.length-1];
            if (previousSwap){
                swap.previousComparatorPerToken = previousSwap.comparatorPerToken;
                swap.previousFiatPerToken = previousSwap.fiatPerToken;
            }
            
            tracker.swaps.push(swap);
            if (tracker.swaps.length > 100){
                const oldestSwap = tracker.swaps.shift();
                oldestSwap.timeElement = null;
                oldestSwap.htmlRow = null;
            }
            updateMostRecentPrice(tracker, {comparator: swap.comparatorPerToken, fiat: swap.fiatPerToken, volume: swap.tokenAmount});
        }
    }
}


export function getBackendIndex(backendName){
    for (const backendIndex of Object.keys(backendInfos)){
        if (backendInfos[backendIndex].name === backendName){
            return backendIndex;
        }
    }
}
export function getTracker(backendIndex, trackerId){
    if (backendInfos && backendInfos[backendIndex]){
        console.log(backendInfos[backendIndex].trackers)
        return backendInfos[backendIndex].trackers[trackerId];
    }
}

TrackerButtons.emitter.addEventListener(TrackerButtons.EVENTS.MANUAL_PRICE_INPUT, event => {
    const tracker = event.data.tracker;
    let tokenAmount = '1';
    let comparatorAmount;
    let fiatAmount;
    if (event.data.price.hasOwnProperty('comparator')){
        comparatorAmount = event.data.price.comparator.toString();
        fiatAmount = Number(comparatorAmount) * (tracker.mostRecentPrice ? tracker.mostRecentPrice.fiat : 1);
    }
    if (event.data.price.hasOwnProperty('fiat')){
        comparatorAmount = tracker.mostRecentPrice ? tracker.mostRecentPrice.comparator : 1;
        fiatAmount = Number(comparatorAmount) * event.data.price.fiat;
    } 

    generalCallbackHandler('backend-event', {
        backendIndex: tracker.backendIndex, 
        event: 'swap',
        data: {
            trackerId: tracker.id, 
            timestamp: Math.floor(Date.now() / 1000),
            action: 'TRADE', 
            tokenAmount, 
            comparatorAmount, 
            fiatAmount,
            transactionHash: 'N/A',
        } 
    });
});

TrackerButtons.emitter.addEventListener(TrackerButtons.EVENTS.TRACKER_SELECTED, event => {
    selectTracker(event.data.tracker);
})
TrackerButtons.emitter.addEventListener(TrackerButtons.EVENTS.USER_SELECTED_ACTIVATE_TRACKER, async event => {
    activateTracker(event.data.tracker);
    selectTracker(event.data.tracker);
});
TrackerButtons.emitter.addEventListener(TrackerButtons.EVENTS.USER_SELECTED_DEACTIVATE_TRACKER, async event => {
    const tracker = event.data.tracker;
    window.bridge.callBackendFunction(
        tracker.backendIndex, 'setTrackerOptions', {id: tracker.id,  options: {isActive: false}}
    );
    tracker.isActive = false;
    TrackerButtons.deactivate(tracker);
    if (currentSelectedTracker === tracker){
        selectTracker(tracker);//we dont want null here- it still exists
    }
});
TrackerButtons.emitter.addEventListener(TrackerButtons.EVENTS.USER_SELECTED_REMOVE_TRACKER, async event => {
    const tracker = event.data.tracker;
    const result = await Prompt.showPrompt({
        title: `Remove ${tracker.name}?`,
        message: "This will cancel any tasks.",
        okButtonText: "Remove",
        cancelButtonText: "Cancel",
        textAlign: 'center'
    })
    if (result.okay){
        window.bridge.callBackendFunction(tracker.backendIndex, 'removeTracker', {id: tracker.id});
        TrackerButtons.remove(tracker);
        const trackers = backendInfos[tracker.backendIndex].trackers;
        tracker.removed = true;
        delete trackers[tracker.id];
        emitter.emitEvent(EVENTS.TRACKER_REMOVED, {
            backendIndex: tracker.backendIndex, 
            trackerId: tracker.id,
            uriString: tracker.uriString,
        })
        if (currentSelectedTracker === tracker){
            selectTracker(null);
        }
       
    }
})


AddTracker.emitter.addEventListener(AddTracker.EVENTS.TRACKER_ADDED, e => {
    backendInfos[e.data.backendIndex].trackers[e.data.tracker.id] = e.data.tracker;
    initTracker(e.data.backendIndex, e.data.tracker);
    selectTracker(e.data.tracker);
    emitter.emitEvent(EVENTS.TRACKER_ADDED, {
        backendIndex: e.data.tracker.backendIndex, 
        trackerId: e.data.tracker.id,
        uriString: e.data.tracker.uriString,
    })
});





function initTracker(backendIndex, tracker){
    tracker.uriString = `${backendIndex}-${tracker.id}`;
    tracker.fullName = `${tracker.intraBackendSignature ? tracker.intraBackendSignature + '/' : ''}${tracker.name}`;
    tracker.backendName = backendInfos[backendIndex].name;
    tracker.uriSignature = `${tracker.uriString} ${tracker.fullName}`;
    
    tracker.swaps = [];
    tracker.isGettingHistory = false;
    tracker.historyProgress = 0; 
    tracker.durationToBars = {
        '1m': [],
        '15m': [],
        '1h': [],
        '4h': [],
        '1d': []
    };
    tracker.mostRecentVolume = 0;
    tracker.hasBeenActive = tracker.isActive;
    tracker.backendIndex = backendIndex;
    const button = TrackerButtons.addButton(backendInfos[tracker.backendIndex].name, tracker);
    if (initted){
        //emits ORDER_UPDATED which we catch and forward (app catches this and updates user data)
        TrackerButtons.moveButtonToBeLastActive(button);
    }
    
    updateMostRecentPrice(tracker);//is async but we don't need to wait for it here
}


async function activateTracker(tracker){
    tracker.isActive = true;
    tracker.hasBeenActive = true
    window.bridge.callBackendFunction(tracker.backendIndex, 'setTrackerOptions', {id: tracker.id,  options: {isActive: true}});
    await updateMostRecentPrice(tracker);
    TrackerButtons.activate(tracker);
}

export function getTrackers(nameFilter){
    const ret = [];
    for (const backendInfo of backendInfos){
        if (!nameFilter || nameFilter.includes(backendInfo.name)){
            for (const tracker of Object.values(backendInfo.trackers)){
                ret.push(tracker);
            }
        }
    }
    return ret;
}

export function getTrackerURIStringToTrackerURISignature(nameFilter){
    const ret = {};
    for (const backendInfo of backendInfos){
        if (!nameFilter || nameFilter.includes(backendInfo.name)){
            for (const tracker of Object.values(backendInfo.trackers)){
                ret[tracker.uriString] = tracker.uriSignature;
            }
        }
    }
    return ret;
}


export function getAllTrackerURIs(nameFilter){
    const ret = [];
    for (const backendInfo of backendInfos){
        if (!nameFilter || nameFilter.includes(backendInfo.name)){
            for (const tracker of Object.values(backendInfo.trackers)){
                ret.push(`${tracker.backendIndex}-${tracker.id}`);
            }
        }
    }
    ret.sort();
   return ret;
}

export function getCurrentTracker(){
    return currentSelectedTracker;
}


export function selectTracker(tracker){
    trackerDetailsFrontendSpace.innerHTML = '';
    getHistoryButton.disabled = true;
    historyProgress.style.display = 'none';
    if (currentSelectedTracker){
        const button = TrackerButtons.getTrackerButton(currentSelectedTracker);
        button.classList.remove('selected');
    }
    currentSelectedTracker = tracker;
    SwapDetails.setTracker(tracker);
    if (!tracker){
        Chart.initChart('------', null);
        emitter.emitEvent(EVENTS.TRACKER_SELECTED, {backendIndex: null, trackerId: null, uriString: null})
    } else {
        const button = TrackerButtons.getTrackerButton(tracker);
        button.classList.add('selected');
        if (tracker.durationToBars['1m'].length){
            Chart.initChart(tracker.fullName, tracker.durationToBars[Chart.getBarDuration()]);
        } else {
            Chart.initChart(tracker.fullName, null);
        }
        emitter.emitEvent(EVENTS.TRACKER_SELECTED, {
            backendIndex: tracker.backendIndex, 
            trackerId: tracker.id,
            uriString: tracker.uriString,
        });
        if (tracker.isGettingHistory){
            historyProgress.style.display = 'flex';
            historyProgress.innerText = (tracker.historyProgress * 100).toFixed(0) + '%';
        } else {
            (async () => {
                const allowed = await window.bridge.callBackendFunction(tracker.backendIndex, 'getHistoryAllowed', {id: tracker.id});
                if (currentSelectedTracker === tracker){
                    getHistoryButton.disabled = ! allowed;
                }
            })();
        }
        trackerDetailsFrontendSpace.innerHTML = '';
        backendInfos[tracker.backendIndex].frontend.attachTrackerDetailsElement(trackerDetailsFrontendSpace, tracker);
        if (tracker.mostRecentPriceString){
            trackerDetailsPrice.innerText = 'Current Price: ' + tracker.mostRecentPriceString;
        } else {
            trackerDetailsPrice.innerText = '...';
        }
        
    }
}






async function updateMostRecentPrice(tracker, mostRecentPrice){
    if (!mostRecentPrice){
        while (!mostRecentPrice){
            let timesFailed = 0;
            try {
                mostRecentPrice = await window.bridge.callBackendFunction(tracker.backendIndex, 'getMostRecentPrice', {id: tracker.id});
                if (tracker.mostRecentPrice){
                    mostRecentPrice = tracker.mostRecentPrice;
                    break;
                }
            } catch (error) {
                console.log(error)
                timesFailed += 1
                await Util.waitSeconds(5 + Math.min(timesFailed, 10));
            }
        }
    }
    tracker.mostRecentPrice = mostRecentPrice;
    if (!tracker.comparatorIsFiat){
        tracker.mostRecentPriceString = `${Util.locale(Util.roundAccurately(mostRecentPrice.comparator, 10))} ${tracker.comparatorSymbol}`;
        if (mostRecentPrice.fiat){
            tracker.mostRecentPriceString += ` ($${Util.locale(Util.roundAccurately(mostRecentPrice.fiat, 10))})`;
        }
    } else {
        tracker.mostRecentPriceString = `$${Util.locale(Util.roundAccurately(mostRecentPrice.comparator, 10))}`;
    }
    if (tracker === currentSelectedTracker){
        trackerDetailsPrice.innerText = 'Current Price: ' + tracker.mostRecentPriceString;
    }
    
    if (tracker.hasBeenActive){
        updateCurrentBar(tracker);
    }

    TrackerButtons.update(tracker);

    emitter.emitEvent(EVENTS.PRICE_UPDATED, {
        backendIndex: tracker.backendIndex, 
        trackerId: tracker.id, 
        uriString: tracker.uriString,
        price: mostRecentPrice
    })
    return mostRecentPrice;
}






function updateCurrentBar(tracker){
    const price = Number(tracker.mostRecentPrice.comparator);
    let addedNewBar = false;
    if (!tracker.durationToBars['1m'].length){
        emitter.emitEvent(EVENTS.FIRST_PRICE, {
            backendIndex: tracker.backendIndex, 
            trackerId: tracker.id, 
            uriString: tracker.uriString,
            price
        })
        for (const duration of Object.keys(tracker.durationToBars)){
            const bars = tracker.durationToBars[duration];
            const utcTime = Math.floor(Clock.roundMSDownToDuration(duration, Date.now()) / 1000);
            bars.push({
                open: price,
                high: price,
                low: price,
                close: price,
                utcTime,
                time: utcTime + Clock.localTimeOffsetSecs,
                volume: tracker.mostRecentPrice.volume ? Number(tracker.mostRecentPrice.volume) : 0, 
            });
            addedNewBar = true;
        }
        if (currentSelectedTracker === tracker){
            Chart.initChart(tracker.name, tracker.durationToBars[Chart.getBarDuration()]);
        }
    } else {
        for (const bars of Object.values(tracker.durationToBars)){
            const currentBar = bars[bars.length-1];
            currentBar.close = price;
            currentBar.high = Math.max(currentBar.high, price);
            currentBar.low = Math.min(currentBar.low, price);
            currentBar.volume += tracker.mostRecentPrice.volume ? Number(tracker.mostRecentPrice.volume) : 0;
        }
        if (currentSelectedTracker === tracker){
            if (tracker.swaps.length){
                const swap = tracker.swaps[tracker.swaps.length-1];
                if (!swap.htmlRow){
                    SwapDetails.add(swap);
                }
            }
            Chart.update(tracker.durationToBars[Chart.getBarDuration()], addedNewBar);
        }
    } 
}










Chart.emitter.addEventListener(Chart.EVENTS.BAR_DURATION_CHANGED, event => {
    if (currentSelectedTracker && currentSelectedTracker.durationToBars[event.data.duration].length){
        Chart.initChart(currentSelectedTracker.name, currentSelectedTracker.durationToBars[event.data.duration]);
    }
});




















const historyProgress = document.getElementById('history-progress');
const getHistoryButton = document.getElementById('get-history-button');
getHistoryButton.disabled = true;
getHistoryButton.addEventListener('click', async () => {
    getHistoryButton.disabled = true;
    const tracker = currentSelectedTracker;
    tracker.historyProgress = 0;
    tracker.isGettingHistory = true;
    historyProgress.style.display = 'flex';
    historyProgress.innerText = '';
    try {
        const historyMinuteKlines = await window.bridge.callBackendFunction(tracker.backendIndex, 'getHistoryMinuteKlines', {id: tracker.id});
        if (historyMinuteKlines.length){
            const durationToNextCutoff = {};
            const durationToBars = {};
            const firstMinuteBar = historyMinuteKlines.shift();
            //console.log('before', [...tracker.durationToBars['1m']]);
            //console.log('received', [...historyMinuteKlines]);
            for (const durationKey of Object.keys(tracker.durationToBars)){
                const bar = {...firstMinuteBar};
                durationToBars[durationKey] = [bar];
                bar.utcTime = Math.floor(Clock.roundMSDownToDuration(durationKey, bar.utcTime*1000) / 1000);
                bar.time = bar.utcTime +  Clock.localTimeOffsetSecs;
                durationToNextCutoff[durationKey] = Math.floor(Clock.roundMSUpToDuration(durationKey, bar.utcTime * 1000 + 1) / 1000);
            }
            for (const minuteBar of historyMinuteKlines){
                const utcTime = minuteBar.utcTime;
                minuteBar.time = utcTime +  Clock.localTimeOffsetSecs;
                for (const durationKey of Object.keys(durationToBars)){
                    const bars = durationToBars[durationKey];
                    if (utcTime >= durationToNextCutoff[durationKey]){
                        durationToNextCutoff[durationKey] = Math.floor(Clock.roundMSUpToDuration(durationKey, utcTime * 1000 + 1) / 1000);
                        bars.push({...minuteBar});
                    } else {
                        if (durationKey === '1m'){
                            bars.push(minuteBar);
                        } else {
                            const currentBar = bars[bars.length-1];
                            currentBar.close = minuteBar.close;
                            currentBar.high = Math.max(currentBar.high, minuteBar.high);
                            currentBar.low = Math.min(currentBar.low, minuteBar.low);
                            currentBar.volume += minuteBar.volume;
                        }
                    }
                }
            }

            for (const durationKey of Object.keys(tracker.durationToBars)){
                const currentBars = tracker.durationToBars[durationKey];
                const historyBars = durationToBars[durationKey];
                const oldestCurrentBarUtcTime = currentBars.length ? currentBars[0].utcTime : 0;
                
                let index = 0;
                while (index < historyBars.length){
                    const historyBar = historyBars[index];
                    index += 1;
                    if (historyBar.utcTime === oldestCurrentBarUtcTime){
                        if (currentBars.length){
                            historyBar.high = Math.max(historyBar.high, currentBars[0].high);
                            historyBar.low = Math.min(historyBar.low, currentBars[0].low);
                            historyBar.close = currentBars[0].close;
                            historyBar.volume = Math.max(historyBar.volume, currentBars[0].volume);
                            currentBars.shift();
                        }
                        break;
                    }
                }
                historyBars.splice(index, historyBars.length - index, ...currentBars);
                tracker.durationToBars[durationKey] = historyBars;
            }

            if (tracker === currentSelectedTracker){
                Chart.initChart(tracker.name, tracker.durationToBars[Chart.getBarDuration()]);
            }
        }

        //console.log('after', [...tracker.durationToBars['1m']]);

        tracker.isGettingHistory = false;
        emitter.emitEvent(EVENTS.TRACKER_HISTORY_UPDATED, {
            backendIndex: tracker.backendIndex, 
            trackerId: tracker.id,
            uriString: tracker.uriString,
        })
        historyProgress.style.display = 'none';
        const allowed = await window.bridge.callBackendFunction(tracker.backendIndex, 'getHistoryAllowed', {id: tracker.id});
        if (currentSelectedTracker === tracker){
            getHistoryButton.disabled = ! allowed;
        } 
    } catch (error) {
        console.log(error);
        Prompt.showMessage(`Error retrieving history for ${tracker.name}: ${error}`);
        const allowed = await window.bridge.callBackendFunction(tracker.backendIndex, 'getHistoryAllowed', {id: tracker.id});
        console.log('allowed', allowed);
        if (currentSelectedTracker === tracker){
            getHistoryButton.disabled = ! allowed;
        } 
    }
})




trackerDetailsPrice.addEventListener('contextmenu', async () => {
    if (currentSelectedTracker && (currentSelectedTracker.mostRecentPrice.comparator)){
        const options = [`Copy price in ${currentSelectedTracker.comparatorSymbol}`];
        if (!currentSelectedTracker.comparatorIsFiat && currentSelectedTracker.mostRecentPrice.fiat){
            options.push(`Copy price in USD`);
        }
        const result = await ContextMenu.show(options);
        if (result === options[0]){
            navigator.clipboard.writeText(Util.roundAccurately(currentSelectedTracker.mostRecentPrice.comparator, 10));
        } else {
            navigator.clipboard.writeText(Util.roundAccurately(currentSelectedTracker.mostRecentPrice.fiat, 10));
        }
    }
})




