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

import * as Prompt from '../frontend/js/prompt.js';
import * as Waiting from '../frontend/js/waiting.js';
import * as Util from '../frontend/js/util.js';
import {getOption} from '../frontend/js/templates.js';
import * as Emitter from  '../frontend/js/event-emitter.js'; const emitter = Emitter.instance(); export {emitter};

const TRACKER_DETAILS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

const trackerDetailsCache = {};


export async function attachTrackerDetailsElement(parent, tracker){
    if (trackerDetailsCache[tracker.id]){
        parent.appendChild(trackerDetailsCache[tracker.id].element);
    } else {
        const htmlString = `
        <div class="default-frontend-tracker-details">
            <div>
                <label>API: </label><label class="ethers-frontend-tracker-details-api"></label>
                <label>${tracker.tokenSymbol}: </label><label class="ethers-frontend-tracker-details-token-address">${tracker.tokenAddress}</label>
                <label>${tracker.comparatorSymbol}: </label><label class="ethers-frontend-tracker-details-comparator-address">${tracker.comparatorAddress}</label>
            </div>
            <div>
                <label>Pair: </label><label class="ethers-frontend-tracker-details-pair-address">${tracker.pairAddress}</label>
                <label>Liquidity: </label><label class="ethers-frontend-tracker-details-liquidity">...</label>
                <label>Market cap: </label><label class="ethers-frontend-tracker-details-market-cap">...</label>
            </div>
        </div>
        `
        const dummyParent = document.createElement('div');
        dummyParent.innerHTML = htmlString;
        const detailsElement = dummyParent.firstElementChild;
        parent.appendChild(detailsElement);
        trackerDetailsCache[tracker.id] = {element: detailsElement};

        (async () => { //only needs to be done once- the user CAN edit the API name, but there have to be no trackers for it
            const apiName = await window.bridge.callBackendFunction(tracker.backendIndex, 'getAPIName', {id: tracker.id});
            const apiElement = detailsElement.getElementsByClassName('ethers-frontend-tracker-details-api')[0];
            apiElement.innerText = apiName;
        })();

        fillTrackerDetails(tracker, detailsElement);
    }
}

async function fillTrackerDetails(tracker, detailsElement){
    if (tracker.removed){
        delete trackerDetailsCache[tracker.id];
        return;
    }
    const liquidityElement =detailsElement.getElementsByClassName('ethers-frontend-tracker-details-liquidity')[0]
    const marketCapElement = detailsElement.getElementsByClassName('ethers-frontend-tracker-details-market-cap')[0]

    let liquidityTotalSupplyMarketCap;
    try {
        liquidityTotalSupplyMarketCap = await window.bridge.callBackendFunction(tracker.backendIndex, 'getLiquidityTotalSupplyMarketCap', {id: tracker.id})
    } catch (error){
        console.log(tracker.name, error);
        if (tracker.removed){
            delete trackerDetailsCache[tracker.id];
            return;
        }
        setTimeout(()=>{fillTrackerDetails(tracker, detailsElement)}, 30 * 1000);
        return;
    }

    const {liquidity, totalSupply, marketCap} = liquidityTotalSupplyMarketCap;
    for (const spec of [liquidity, marketCap]){
        for (const key of Object.keys(spec)){
            if (!isNaN(spec[key])){
                spec[key] = Util.roundAccurately(Number(spec[key]), 10);
            }
        }
    }
    let marketCapString;
    if (tracker.comparatorIsFiat){
        marketCapString = `$${Util.locale(marketCap.comparator)}`;
    } else if (marketCap.fiat){
        marketCapString = ` $${Util.locale(marketCap.fiat)}`;
    } else {
        marketCapString = `${Util.locale(marketCap.comparator)} ${tracker.comparatorSymbol}`;
    }
    marketCapElement.innerText = marketCapString;

    const liquidityStringComp = ` ${Util.locale(liquidity.comparator)} ${tracker.comparatorSymbol}`;
    let liquidityString =  `${Util.locale(liquidity.token)} ${tracker.tokenSymbol} + ${liquidityStringComp}`;
    liquidityElement.innerText = liquidityString;
    
    if (tracker.removed){
        delete trackerDetailsCache[tracker.id];
        return;
    }
    setTimeout(()=>{fillTrackerDetails(tracker, detailsElement)}, TRACKER_DETAILS_UPDATE_INTERVAL_MS);
}



export async function createAddTrackerSubmodule(backendId, formParent){
    const htmlString = `
    <div>
        <label id="add-tracker-defi-endpoint-label">RPC API Endpoint: </label>
        <select name="add-tracker-defi-endpoint-input" id="add-tracker-defi-endpoint-input"></select> 
        <button id="add-tracker-defi-new-endpoint-button">Manage</button>
    
        <label id="add-tracker-defi-add-comporator-exchange-label">Exchange of Pair: </label>
        <select name="add-tracker-defi-add-comporator-exchange-input" id="add-tracker-defi-add-comporator-exchange-input"></select> 
        <button id="add-tracker-defi-add-comporator-new-exchange-button">Manage</button>
    
        <label id="add-tracker-defi-token-address-label">Token Address: </label>
        <input id="add-tracker-defi-token-address-input" type="text" placeholder="Token address"/>
        <select style="min-width: 80px;" name="add-tracker-defi-token-address-symbols" id="add-tracker-defi-token-address-symbols"></select> 
        
        <label id="add-tracker-defi-comparator-address-label">Comparator Address: </label>
        <input id="add-tracker-defi-comparator-address-input" type="text" placeholder="Comparator token address"/>
        <select name="add-tracker-defi-comparator-address-symbols" id="add-tracker-defi-comparator-address-symbols"></select>
    
        <label id="add-tracker-defi-comparator-is-fiat-label">Comparator is Fiat: </label>
        <input id="add-tracker-defi-comparator-is-fiat-input" type="checkbox"/>
        <div></div>

        <label>Update Method: </label>
        <select id="add-tracker-defi-update-method-input">
            <option value="SWAPS">Swaps</option>
            <option value="POLL">Poll</option>
        </select> 
        <div></div>

        <label class="add-tracker-defi-poll-related">Polling interval (seconds): </label>
        <input class="add-tracker-defi-poll-related" disabled id="add-tracker-defi-poll-interval-input" type="text" value="5"/>
        <div></div>

        <label class="add-tracker-defi-poll-related">Quote token amount: </label>
        <input class="add-tracker-defi-poll-related" disabled id="add-tracker-defi-quote-token-amount-input" type="text" value="100"/>
        <div></div>


    </div>
    `
    const dummyParent = document.createElement('div');
    dummyParent.innerHTML = htmlString;
    const dom = dummyParent.firstElementChild;
    formParent.appendChild(dom);
    
    const endpointInput = document.getElementById("add-tracker-defi-endpoint-input");
    const manageEndpointsButton = document.getElementById("add-tracker-defi-new-endpoint-button");
    
    const exchangeInput = document.getElementById("add-tracker-defi-add-comporator-exchange-input");
    const manageExchangesButton = document.getElementById("add-tracker-defi-add-comporator-new-exchange-button");
    
    const tokenAddressInput = document.getElementById("add-tracker-defi-token-address-input");
    const tokenAddressSymbols = document.getElementById("add-tracker-defi-token-address-symbols");
    const comparatorAddressInput = document.getElementById("add-tracker-defi-comparator-address-input");
    const comparatorAddressSymbols = document.getElementById("add-tracker-defi-comparator-address-symbols");

    const comparatorIsFiatInput = document.getElementById("add-tracker-defi-comparator-is-fiat-input");

    const updateMethodInput = document.getElementById("add-tracker-defi-update-method-input");
    const pollIntervalSecondsInput = document.getElementById("add-tracker-defi-poll-interval-input");
    const pollQuoteTokenAmountInput = document.getElementById("add-tracker-defi-quote-token-amount-input");

    const addTrackerForm = {
        dom
    };

    let endpoints, exchanges;

    endpointInput.addEventListener('change', handleEndpointChanged);
    
    function handleEndpointChanged(){
        if (endpointInput.value === ""){
            return;
        }
        const endpointId = endpoints[endpointInput.value].id;
        for (const input of [exchangeInput, tokenAddressSymbols, comparatorAddressSymbols]){
            let firstOption;
            let requireReselect = false;
            for (const option of input.children){
                if (input === tokenAddressSymbols || input === comparatorAddressSymbols){
                    if (!option.value){
                        continue;
                    }
                }
                
                if (option.getAttribute('endpointId') === endpointId){
                    if (!firstOption){
                        firstOption = option;
                    }
                    option.style.display = 'block';
                } else {
                    if (input.value === option.value){
                        requireReselect = true;
                    }
                    option.style.display = 'none';
                }
            }
            if (input === exchangeInput && (!input.value || requireReselect)){
                if (firstOption){
                    input.value = firstOption.value;
                } else {
                    input.value = null;
                }
            }
        }
    }


    async function resetEndpointsAndExchanges({lastSelectedEndpointId, lastSelectedExchangeId}){
        endpointInput.innerHTML = '';
        exchangeInput.innerHTML = '';
        tokenAddressSymbols.innerHTML = '<option value="">&#10697;</option>';
        comparatorAddressSymbols.innerHTML = '<option value="">&#10697;</option>';
        
        let endpointsAndExchanges = await window.bridge.callBackendFunction(backendId, 'getEndpointsAndExchanges');
        endpoints = endpointsAndExchanges.endpoints;
        exchanges = endpointsAndExchanges.exchanges;
        Util.sortArrayOfObjectsOnProperty({array: endpoints, property: "name", caseSensitive: false});
        for (let i = 0; i < endpoints.length; ++i){
            const option = getOption(i, `${endpoints[i].name}`);
            endpointInput.appendChild(option);
            if (lastSelectedEndpointId !== undefined && endpoints[i].id === lastSelectedEndpointId){
                endpointInput.value = i;
            }
        }
        Util.sortArrayOfObjectsOnProperty({array: exchanges, property: "name", caseSensitive: false});
        for (let i = 0; i < exchanges.length; ++i){
            exchangeInput.appendChild(getOption(i, `${exchanges[i].name}`));
            exchangeInput.lastElementChild.setAttribute('endpointId', exchanges[i].endpointId);
            if (lastSelectedExchangeId !== undefined && exchanges[i].id === lastSelectedExchangeId){
                exchangeInput.value = i;
            }
        }

        let nodeSymbolsAndAddresses = await window.bridge.callBackendFunction(backendId, 'getSymbolsAndAddresses');
        Util.sortArrayOfObjectsOnProperty({array: nodeSymbolsAndAddresses, property: "symbol", caseSensitive: false});
        for (const node of nodeSymbolsAndAddresses){
            tokenAddressSymbols.appendChild(getOption(node.address, `${node.symbol}`));
            tokenAddressSymbols.lastElementChild.setAttribute('endpointId', node.endpointId);
            comparatorAddressSymbols.appendChild(getOption(node.address, `${node.symbol}`));
            comparatorAddressSymbols.lastElementChild.setAttribute('endpointId', node.endpointId);
        }

        handleEndpointChanged();
        updateDisableds();
    }
    

    addTrackerForm.refresh = async function(){
        await resetEndpointsAndExchanges({
            lastSelectedEndpointId: endpoints && endpoints[endpointInput.value] ? endpoints[endpointInput.value].id : undefined,
            lastSelectedExchangeId: exchanges && exchanges[exchangeInput.value] ? exchanges[exchangeInput.value].id : undefined
        });
    }

    
    addTrackerForm.getArgs = function(){
        const exchangeId = exchanges[exchangeInput.value].id;
        const tokenAddress = tokenAddressInput.value;
        const comparatorAddress = comparatorAddressInput.value;
        const comparatorIsFiat = comparatorIsFiatInput.checked;
        const updateMethod = updateMethodInput.value;
        const pollIntervalSeconds = updateMethod === "SWAPS" ? null : Number(pollIntervalSecondsInput.value);
        const pollQuoteTokenAmount = updateMethod === "SWAPS" ? null : Number(pollQuoteTokenAmountInput.value);
        return {
            type: "PAIR", 
            exchangeId, tokenAddress, comparatorAddress, 
            comparatorIsFiat, updateMethod, pollIntervalSeconds, pollQuoteTokenAmount
        };
    }
    
    function checkNonEmptyTrimmed(value){
        const trimmed = value.trim();
        return {valid: !!trimmed, cleaned: trimmed};
    }

    //inputInfos = [{label, placeholder, key, test},...]
    //test is a function (string) => {valid: boolean, cleaned: string}
    const keyToSelectInfo = {
        ENDPOINT: {
            title: 'Manage Ethers Endpoints',
            inputInfos: [
                {label: 'RPC endpoint', key: "address", placeholder: "", type: 'password', test: checkNonEmptyTrimmed},
                {label: 'Native token', key: "ethTokenAddress", placeholder: "contract address", test: (value) => {
                    const trimmed = value.trim();
                    return {valid: Util.isValidERC20(trimmed), cleaned: trimmed};
                }},
                {label: 'API call limit', key: "rateLimit", placeholder: "calls per second",  test: (value) => {
                    const trimmed = value.trim();
                    return {valid: Number(trimmed) && Number(trimmed) > 0, cleaned: Number(trimmed)};
                }},
                {label: 'Block explorer URL', key: "blockExplorerURL", placeholder: "(optional)",  test: (value) => {
                    const trimmed = value.trim();
                    return {valid: true, cleaned: trimmed};
                }},
            ]
        },
        EXCHANGE: { 
            title: 'Manage Ethers Exchanges',
            inputInfos: [
                {label: 'Factory', key: "factoryAddress", placeholder: "contract address", test: (value) => {
                    const trimmed = value.trim();
                    return {valid: Util.isValidERC20(trimmed), cleaned: trimmed};
                }},
                {label: 'Router', key: "routerAddress", placeholder: "contract address", test: (value) => {
                    const trimmed = value.trim();
                    return {valid: Util.isValidERC20(trimmed), cleaned: trimmed};
                }},
            ]
        }
    }
    
    
    async function manageSelects(type){
        const nodes = type === "ENDPOINT" ? endpoints : exchanges;
        const input = type === "ENDPOINT" ? endpointInput : exchangeInput;
        const getActiveFunc = type === 'ENDPOINT' ? 'getEndpointsWithExchanges' : 'getExchangesWithTrackers';
        const selectedItemBefore = nodes[input.value] ? nodes[input.value].name : null;

        const nonEditableItems = [];
        const nonEditableNodes = await window.bridge.callBackendFunction(backendId, getActiveFunc);
        for (const node of nonEditableNodes){
            nonEditableItems.push(node.name);
        }

        const database = {};
        for (const node of nodes){
            if (type === 'ENDPOINT' || node.endpointId === endpoints[endpointInput.value].id){
                database[node.name] = node
            }
        }
        const databaseStringBefore = JSON.stringify(database);

        const title = keyToSelectInfo[type].title;
        const inputInfos = keyToSelectInfo[type].inputInfos;
        const {lastSelectedItem, cancelled} = await Prompt.showSelectManager({
            title, inputInfos, database, 
            selectedItem: selectedItemBefore,
            nonEditableItems
        });
        if (cancelled){
            return;
        }

        const databaseBefore = JSON.parse(databaseStringBefore);
        const lastSelectedEndpointInfo = type === 'ENDPOINT' ? database[lastSelectedItem] : endpoints[endpointInput.value];
        const lastSelectedExchangeInfo = type === 'EXCHANGE' ? database[lastSelectedItem] : null;

        const removedNodes = [];
        const editedNodes = [];
        for (const itemNameBefore of Object.keys(databaseBefore)){
            if (!database[itemNameBefore]){
                removedNodes.push(databaseBefore[itemNameBefore]);
            } else {
                const oldNode = databaseBefore[itemNameBefore];
                const newNode = database[itemNameBefore];
                for (const oldNodevalueKey of Object.keys(oldNode)){
                    if (!newNode[oldNodevalueKey]){
                        newNode[oldNodevalueKey] = oldNode[oldNodevalueKey];
                    } else if (newNode[oldNodevalueKey] !== oldNode[oldNodevalueKey]){
                        if (!editedNodes.includes(newNode)){
                            editedNodes.push(newNode);
                        }
                    }
                }
            }
        }
        const addedNodes = [];
        for (const itemNameAfter of Object.keys(database)){
            if (!databaseBefore[itemNameAfter]){
                database[itemNameAfter].name = itemNameAfter;
                database[itemNameAfter].type = type; 
                if (type === 'EXCHANGE'){
                    database[itemNameAfter].endpointId = endpoints[endpointInput.value].id;
                }
                addedNodes.push(database[itemNameAfter]);
            }
        }

        if (addedNodes.length || editedNodes.length || removedNodes.length){
            Waiting.startWaiting(`Updating database...`);
            try {
                const {success, error, addedNodeInfos} = await window.bridge.callBackendFunction(backendId, 'updateDatabase', {addedNodes, editedNodes, removedNodes});
                if (!success){
                    console.log('Error updating database: ' + error);
                    throw 'Error updating database';
                }
                for (const node of addedNodeInfos){
                    if (type === "ENDPOINT"){
                        if (lastSelectedEndpointInfo && node.name === lastSelectedEndpointInfo.name){
                            lastSelectedEndpointInfo.id = node.id;
                        }
                    } else {
                        if (lastSelectedExchangeInfo && node.name === lastSelectedExchangeInfo.name){
                            lastSelectedExchangeInfo.id = node.id;
                        }
                    }
                }
                await resetEndpointsAndExchanges({
                    lastSelectedEndpointId: lastSelectedEndpointInfo ? lastSelectedEndpointInfo.id : undefined, 
                    lastSelectedExchangeId: lastSelectedExchangeInfo ? lastSelectedExchangeInfo.id : undefined, 
                });
                Waiting.stopWaiting();
                Prompt.showMessage({title: "Success!", message: `Updated ${type.toLowerCase()} database`});
            } catch (error){
                console.log(error);
                Waiting.stopWaiting();
                Prompt.showMessage({title: "Error", message: `Error occured updating ${type.toLowerCase()} database`});
            }
        } else {
            if (type === 'ENDPOINT'){
                if (lastSelectedEndpointInfo){
                    for (let i = 0; i < endpoints.length; ++i){
                        if (endpoints[i].id === lastSelectedEndpointInfo.id){
                            endpointInput.value = i;
                            handleEndpointChanged();
                            break;
                        }
                    }
                }
            } else if (lastSelectedExchangeInfo){
                for (let i = 0; i < exchanges.length; ++i){
                    if (exchanges[i].id === lastSelectedExchangeInfo.id){
                        exchangeInput.value = i;
                        break;
                    }
                }

            }
        }
    }

    manageEndpointsButton.addEventListener("click", () => {manageSelects("ENDPOINT")});
    manageExchangesButton.addEventListener("click", () => {manageSelects("EXCHANGE")});
    tokenAddressInput.addEventListener('input', updateDisableds);
    comparatorAddressInput.addEventListener('input', updateDisableds);
    comparatorIsFiatInput.addEventListener('change', () => {
        updateDisableds();
    });
    tokenAddressSymbols.addEventListener('change', () => {
        if (tokenAddressSymbols.value){
            tokenAddressInput.value = tokenAddressSymbols.value;
        }
        tokenAddressSymbols.value = "";
        updateDisableds();
        
    });
    comparatorAddressSymbols.addEventListener('change', () => {
        if (comparatorAddressSymbols.value){
            comparatorAddressInput.value = comparatorAddressSymbols.value;
        }
        comparatorAddressSymbols.value = "";
        updateDisableds();
    });


    function updateMethodHandler(){
        for (const element of dom.getElementsByClassName('add-tracker-defi-poll-related')){
            element.disabled = updateMethodInput.value === "SWAPS";
        }
        updateDisableds();
    }
    updateMethodInput.addEventListener('change', updateMethodHandler);
    pollIntervalSecondsInput.addEventListener('change', updateDisableds);
    pollQuoteTokenAmountInput.addEventListener('change', updateDisableds);
    
    function updateDisableds(){
        const focussedElement = document.activeElement;
        let okayToTryAdd = true;
        
        if (!endpointInput.children.length){
            okayToTryAdd = false;
        }
        if (!exchangeInput.children.length){
            okayToTryAdd = false;
        }

        if (!tokenAddressInput.value.length){
            okayToTryAdd = false;
        } else if (!Util.isValidERC20(tokenAddressInput.value)){
            tokenAddressInput.classList.add('input-invalid');
            okayToTryAdd = false;
        } else {
            tokenAddressInput.classList.remove('input-invalid');
        }

        if (updateMethodInput.value === "POLL"){
            if (!pollIntervalSecondsInput.value || isNaN(pollIntervalSecondsInput.value)){
                pollIntervalSecondsInput.classList.add('input-invalid');
                okayToTryAdd = false;
            } else {
                pollIntervalSecondsInput.classList.remove('input-invalid');
            }
            if (!pollQuoteTokenAmountInput.value || isNaN(pollQuoteTokenAmountInput.value)){
                pollQuoteTokenAmountInput.classList.add('input-invalid');
                okayToTryAdd = false;
            } else {
                pollQuoteTokenAmountInput.classList.remove('input-invalid');
            }
        }


        if (!comparatorAddressInput.value.length){
            okayToTryAdd = false;
        } else if (!Util.isValidERC20(comparatorAddressInput.value) 
        || comparatorAddressInput.value === tokenAddressInput.value){
            comparatorAddressInput.classList.add('input-invalid');
            okayToTryAdd = false;
        } else {
            comparatorAddressInput.classList.remove('input-invalid');
        }

        if (focussedElement && !focussedElement.disabled){
            focussedElement.focus();
        }

        emitter.emitEvent('updatedDisableds', {addTrackerButtonShouldBeDisabled: !okayToTryAdd})
    }


    return {emitter, addTrackerForm};

        
}

    





