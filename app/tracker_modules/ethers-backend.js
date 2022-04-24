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

const {app} = require('electron');
const ethers = require('ethers');
const { NonceManager } = require("@ethersproject/experimental");
const bigNumber = ethers.BigNumber;
const ABI = require('../ABI');
const bigRational = require("big-rational");
const { RateLimiter } = require("limiter");
const EventEmitter = require('events');
const fs = require('fs');
const util = require('./util.js');
const path = require('path');
const cryptoHelper = require("../cryptohelper");

const FIAT_DECIMALS = 8;

const emitter = new EventEmitter();

const TOKEN_DATABASE_FILENAME = path.join(app.getPath("userData"),"/default_user/ethers-token-database.json");

//database stuff
const UPDATE_METHOD = {POLL: "POLL", SWAPS: "SWAPS"};
const NODE_TYPE = {ENDPOINT: "ENDPOINT", EXCHANGE: "EXCHANGE", PAIR: "PAIR"};
const NODE_TYPE_TO_DATABASE_NAME = {ENDPOINT: "endpoints", EXCHANGE: "exchanges", PAIR: "pairNodes"}
let database = {pairNodes: {}, exchanges: {}, endpoints: {}};
let idTracker = 0;
const idToJS = {};
const nonceManagers = {};

let win;


/*
NOTES
------
* ethers prices may differ between charting apps because a) the way the price is calculated and b) whether taxes are taken into
consideration before calulating cost.    
Regarding (a), you could use the last price it was sold at, or you could base your price off 
the ratio in the LP pool right now after the last trade- and if you do that, 
the calculation would be different depending on how/if you compensate for price impact, etc..

* I use eth in variable names (e.g. ethToken) to mean the "native" token of the blockchain. You will see this same
convention in smart contract functions ont he blockchain (e.g. swapEthForExactToken). Except for some (looking at you, Elk Finance).
In the future we might have to specify what functions to call when the user creates an exchange node...

*/


function create(){
    return {
        emitter,
        init,
        changePassword,
        call
    }
}




function call(functionName, args){
    //Base API
    if (functionName === 'getName'){
        return 'ethers';
    } else if (functionName === 'getTrackersMap'){
        return database.pairNodes;
    } else if (functionName === 'addTracker'){
        return addPairNode(args);
    } else if (functionName === 'removeTracker'){
        return removePairNode(args.id);
    } else if (functionName === 'setTrackerOptions'){
        return setTrackerOptions(args.id, args.options);
    } else if (functionName === 'getMostRecentPrice'){
        if (idToJS[args.id].mostRecentPrice.comparator){
            return idToJS[args.id].mostRecentPrice;
        } else {
            return updatePrice(database.pairNodes[args.id]);
        }
    } else if (functionName === 'getHistoryAllowed'){
        return getHistoryAllowed(args.id);
    } else if (functionName === 'getHistoryMinuteKlines'){
        return getHistoryMinuteKlines(args.id);
    }

    //extra functions for frontend
    if (functionName === 'getEndpointsAndExchanges'){
        return {endpoints: Object.values(database.endpoints), exchanges: Object.values(database.exchanges)};
    } else if (functionName === 'getSymbolsAndAddresses'){
        const ret = [];
        const addedSymbols = {};
        for (const node of Object.values(database.pairNodes)){
            const endpointNode = database.endpoints[database.exchanges[node.exchangeId].endpointId];
            if (!addedSymbols[node.tokenSymbol]){
                addedSymbols[node.tokenSymbol] = true;
                ret.push({symbol: node.tokenSymbol, address: node.tokenAddress, endpointId: endpointNode.id});
            }
            if (!addedSymbols[node.comparatorSymbol]){
                addedSymbols[node.comparatorSymbol] = true;
                ret.push({symbol: node.comparatorSymbol, address: node.comparatorAddress, endpointId: endpointNode.id});
            }
        }
        for (const node of Object.values(database.endpoints)){
            if (!addedSymbols[node.ethTokenSymbol]){
                addedSymbols[node.ethTokenSymbol] = true;
                //endpointId is filtered by in the frontend- obviously this eth token should be shown for this endpint
                ret.push({symbol: node.ethTokenSymbol, address: node.ethTokenAddress, endpointId: node.id});
            }
        }
        return ret;
    } else if (functionName === 'getEndpointsWithExchanges' || functionName === 'getExchangesWithTrackers'){ 
        let collection;
        let collectionToIterate
        let checkFunc;
        if (functionName === 'getEndpointsWithExchanges'){
            collection = Object.values(database.endpoints);
            collectionToIterate = Object.values(database.exchanges);
            checkFunc = (node, exchange) => exchange.endpointId === node.id;
        } else {
            collection = Object.values(database.exchanges);
            collectionToIterate = Object.values(database.pairNodes);
            checkFunc = (node, pairNode) => pairNode.exchangeId === node.id;
        }
        const ret = [];
        for (const node of collection){
            if (!ret.includes(node) && collectionToIterate.some(pairNode => checkFunc(node, pairNode))){
                ret.push(node);
            }
        }
        return ret;
    } else if (functionName === 'addEndpoint'){
        return addEndpointNode(args);
    } else if (functionName === 'addExchange'){
        return addExchangeNode(args);
    } else if (functionName === 'updateDatabase'){//assumes nodes will all be of the same type
        return updateDatabase(args);
    } else if (functionName == 'getAPIName'){
        const node =  database.pairNodes[args.id];
        const exchangeNode = database.exchanges[node.exchangeId];
        const endpointNode = database.endpoints[exchangeNode.endpointId];
        return endpointNode.name;
    } else if (functionName === 'getExchangeId'){
        const endpointName = args.endpointName;
        const endpointNode = Object.values(database.endpoints).filter(possibleEndpointNode => possibleEndpointNode.name === endpointName)[0];
        console.log('endpointNode', endpointNode);
        if (endpointNode){
            for (const exchange of Object.values(database.exchanges)){
                if (exchange.endpointId === endpointNode.id && exchange.name === args.exchangeName){
                    return exchange.id;
                }
            }
        }
    }  else if (functionName == 'getLiquidityTotalSupplyMarketCap'){
       return getLiquidityTotalSupplyMarketCap(args.id);
    }

    //ethers modules
    if (functionName === 'getBalance'){
        return getBalance(args);
    } else if (functionName === 'getEndpointNameToNodeIds'){
        const ret = {};
        for (const endpoint of Object.values(database.endpoints)){
            ret[endpoint.name] = idToJS[endpoint.id].pairIds;
        }
        return ret;
    } else if (functionName === 'getExchangeNameToNodeIds'){
        const ret = {};
        for (const exchange of Object.values(database.exchanges)){
            ret[exchange.name] = idToJS[exchange.endpointId].pairIds.filter(pairId => database.pairNodes[pairId].exchangeId === exchange.id);
        }
        return ret;
        
    } else if (functionName === 'getPairBalances'){
        return getPairBalances(args);
    } else if (functionName === 'addOrRemoveliquidity'){
        return addOrRemoveliquidity(args);
    } else if (functionName === 'swap'){
        return swap(args);
    } else if (functionName === 'transfer'){
        return transfer(args);
    } else if (functionName === 'generalContractCall'){
        return generalContractCall(args);
    } else if (functionName === 'getAbiAsJson'){
        return getAbiAsJson(args);
    } else if (functionName === 'generalContractWait'){
        return generalContractWait(args);
    }

}


let masterKey;


async function init(pWin, pmasterKey){
    masterKey = pmasterKey;
    win = pWin;
    await readTokenDatabase(false);
    for (const node of Object.values(database.pairNodes)){
        if (node.isActive){
            startListening(node);
        }
    }
}

async function changePassword(newMasterKey){
    masterKey = newMasterKey;
    writeTokenDatabase(database);
}


function writeTokenDatabase(){
    if (!fs.existsSync(TOKEN_DATABASE_FILENAME)){
        fs.mkdirSync(path.dirname(TOKEN_DATABASE_FILENAME), {recursive: true});
    }
    let filestring = JSON.stringify(database, null," ");
    if (masterKey){
        filestring = cryptoHelper.encryptStringAES(filestring, masterKey).cipher;
    }
    fs.writeFileSync(TOKEN_DATABASE_FILENAME, filestring);
}



async function readTokenDatabase(justReturn=true){
    let databaseReadIn;
    if (fs.existsSync(TOKEN_DATABASE_FILENAME)){
        let fileString = fs.readFileSync(TOKEN_DATABASE_FILENAME).toString('utf-8');
        try {
            if (masterKey){
                fileString = cryptoHelper.decryptStringAES(fileString, masterKey);
            }
            databaseReadIn = JSON.parse(fileString);
        } catch (error){
            console.log(error);
            if (!masterKey){
                fs.writeFileSync(TOKEN_DATABASE_FILENAME + Date(),  fileString); //backup the faulty file and move on
            }
        }
    }
    
    if (!databaseReadIn){
        databaseReadIn = {pairNodes: {}, endpoints: {}, exchanges: {}};
    }

    if (justReturn){
        return databaseReadIn;
    }
    database = databaseReadIn;
    for (const node of Object.values(database.endpoints)){
        idTracker = Math.max(idTracker, Number(node.id))+1;
        addJSComponent(node);
    }
    for (const node of Object.values(database.exchanges)){
        idTracker = Math.max(idTracker, Number(node.id))+1;
        addJSComponent(node);
        idToJS[node.endpointId].exchangeIds.push(node.id);
    }

    for (const node of Object.values(database.pairNodes)){
        idTracker = Math.max(idTracker, Number(node.id))+1;
        const endpointNode = database.endpoints[database.exchanges[node.exchangeId].endpointId];
        const exchangeNode = getExchangeNode(node.exchangeId);
        node.intraBackendSignature = exchangeNode.name;
        idToJS[endpointNode.id].pairIds.push(node.id);
        if (!idToJS[endpointNode.id].tokenAddressToPairIds[node.tokenAddress]){
            idToJS[endpointNode.id].tokenAddressToPairIds[node.tokenAddress] = [];
        }
        addJSComponent(node); 
        const js = idToJS[node.id];

        idToJS[endpointNode.id].tokenAddressToPairIds[node.tokenAddress].push(node.id);
        
        idToJS[exchangeNode.id].pairIds.push(node.id);
        
    }
}

/* 
function throwError(error, func){
    console.log(error);
    throw `${func ? 'Calling '+func+'(): ' : ''}${JSON.stringify(error && error.response && error.response.data ? error.response.data : (error && error.message ? error.message : error))}`;
}
 */

function _getLinkToFiat(pairNode, link){
    if (pairNode.comparatorIsFiat){
        link.push(pairNode.id);
        return link;
    }
    const endpointNode = database.endpoints[database.exchanges[pairNode.exchangeId].endpointId];
    let uplinkTokenIds = idToJS[endpointNode.id].tokenAddressToPairIds[pairNode.comparatorAddress];
        if (uplinkTokenIds){
        for (tokenId of uplinkTokenIds){
            let successfulLink = _getLinkToFiat(database.pairNodes[tokenId], link);
            if (successfulLink){
                successfulLink.push(pairNode.id);
                return successfulLink;
            }
        }
    }
    return null;
}
function getLinkToFiat(node){
    const link = _getLinkToFiat(node, []);
    if (link){
        link.reverse();
    }
    return link;
}


async function getQuote(node, amountToken){
    const token0Decimals = node.comparatorIsToken1 ? node.tokenDecimals : node.comparatorDecimals;
    const token1Decimals = node.comparatorIsToken1 ? node.comparatorDecimals : node.tokenDecimals;
    try {
        const endpointNode = database.endpoints[database.exchanges[node.exchangeId].endpointId];
        const reserves = await idToJS[endpointNode.id].sendOne(idToJS[node.id].pairContract, 'getReserves');
        const reserve0AsRational = bigRational(reserves.reserve0.toString()).divide(bigRational('10').pow(token0Decimals));
        const reserve1AsRational = bigRational(reserves.reserve1.toString()).divide(bigRational('10').pow(token1Decimals));
        const reserveTokenRational = node.comparatorIsToken1 ? reserve0AsRational : reserve1AsRational;
        const reserveComparatorRational = node.comparatorIsToken1 ? reserve1AsRational : reserve0AsRational;
        //Math is the same as what the "quote" function in routers do
        const a = (reserveComparatorRational.multiply(amountToken)).divide(reserveTokenRational.add(amountToken));
        return a;
    } catch (error){
        console.log(error);
        return;
    }
}

async function getReserveRatio(node){
    const token0Decimals = node.comparatorIsToken1 ? node.tokenDecimals : node.comparatorDecimals;
    const token1Decimals = node.comparatorIsToken1 ? node.comparatorDecimals : node.tokenDecimals;
    const endpointNode = database.endpoints[database.exchanges[node.exchangeId].endpointId];
    const reserves = await idToJS[endpointNode.id].sendOne(idToJS[node.id].pairContract, 'getReserves');
    const reserve0AsRational = bigRational(reserves.reserve0.toString()).divide(bigRational('10').pow(token0Decimals));
    const reserve1AsRational = bigRational(reserves.reserve1.toString()).divide(bigRational('10').pow(token1Decimals));
    const reserveTokenRational = node.comparatorIsToken1 ? reserve0AsRational : reserve1AsRational;
    const reserveComparatorRational = node.comparatorIsToken1 ? reserve1AsRational : reserve0AsRational;
    return {
        tokenPerComparator: reserveTokenRational.divide(reserveComparatorRational),
        comparatorPerToken: reserveComparatorRational.divide(reserveTokenRational)

    }
}


//if no parsedLog is given, will call getQuote to figure out current price
async function updatePrice(node, parsedLog){
    const js = idToJS[node.id];

    let priceInComparatorRational;
    if (parsedLog){
        priceInComparatorRational = parsedLog.comparatorAmountRational.divide(parsedLog.tokenAmountRational);
    } else {
        if (js.priceIsUpdating){
            const price = await new Promise((resolve, reject) => {
                emitter.once('priceUpdated', function(e) {
                    return resolve(js.mostRecentPrice);
                })
            });
            if (price){
                return js.mostRecentPrice;
            }
        }
        const q =  node.tokenQuantity ? node.tokenQuantity : 1;
        priceInComparatorRational = await getQuote(node, q);
        
        if (!priceInComparatorRational){
            if (js.mostRecentPrice.comparator){
                return js.mostRecentPrice;
            } else {
                return null;
            }
        } else {
            priceInComparatorRational = priceInComparatorRational.divide(q);
        }
    }
    js.priceIsUpdating = true;

    let priceInFiatRational;
    const linkToFiat  = getLinkToFiat(node);
    const currentMs = Date.now();
    if (linkToFiat){
        priceInFiatRational = priceInComparatorRational;
        for (let i = 1; i < linkToFiat.length; ++i){
            const uplinkNode = database.pairNodes[linkToFiat[i]];
            if (idToJS[uplinkNode.id].mostRecentPrice.comparatorRational === null
            || currentMs - uplinkNode.msAtLastPriceUpdate > 30000){
                if (!database.pairNodes[uplinkNode.id]){
                    linkToFiat = false;
                    priceInFiatRational = null;
                    break;
                }
                await updatePrice(uplinkNode);
            }           
            priceInFiatRational = priceInFiatRational.multiply(idToJS[uplinkNode.id].mostRecentPrice.comparatorRational);
        }
    }

    //At this point, we know we're either the newest log or updating from reserves directly
    js.mostRecentPrice.comparatorRational = priceInComparatorRational;
    js.mostRecentPrice.fiatRational = priceInFiatRational;
    js.mostRecentPrice.comparator = priceInComparatorRational.toDecimal(node.comparatorDecimals),
    js.mostRecentPrice.fiat =  priceInFiatRational ? priceInFiatRational.toDecimal(FIAT_DECIMALS) : null,
    node.msAtLastPriceUpdate = Date.now();

    js.priceIsUpdating = false;
    emitter.emit('priceUpdated');
    return js.mostRecentPrice;
}


//returns null if the transaction should be ignored (very low volume trade or invalid log)
function getParsedLog(node, log){
    //we shouldn't need this because the filter should... work... but I was getting a javascript runtime error because 
    // megaweapon "sync" events were geting passed here and interface.parseLog failed
    if (!log || !log.topics || !log.topics.includes(idToJS[node.id].eventFilter.topics[0])){
        return null;
    }
    const parsedLog = idToJS[node.id].pairContract.interface.parseLog(log);
    if (!parsedLog){
        return null;
    }

    let wasBuy;
    let tokenAmountBigNumber;
    let comparatorAmountBigNumber;
    if (node.comparatorIsToken1){
        wasBuy = !parsedLog.args.amount1In.isZero();
        tokenAmountBigNumber = wasBuy ? parsedLog.args.amount0Out : parsedLog.args.amount0In;
        comparatorAmountBigNumber = wasBuy ? parsedLog.args.amount1In : parsedLog.args.amount1Out;
    } else {
        wasBuy = !parsedLog.args.amount0In.isZero();
        tokenAmountBigNumber = wasBuy ? parsedLog.args.amount1Out : parsedLog.args.amount1In;
        comparatorAmountBigNumber = wasBuy ? parsedLog.args.amount0In : parsedLog.args.amount0Out;
    } 

    const tokenAmountRational = bigRational(tokenAmountBigNumber.toString()).divide(bigRational('10').pow(node.tokenDecimals));
    const comparatorAmountRational = bigRational(comparatorAmountBigNumber.toString()).divide(bigRational('10').pow(node.comparatorDecimals));
    //comparator's price has hopefully been updated recently
    let fiatAmountRational = null;
    if (node.comparatorIsFiat){
        fiatAmountRational = comparatorAmountRational; 
    } else {
        if (idToJS[node.id].mostRecentPrice.fiatRational){
            fiatAmountRational = tokenAmountRational.multiply(idToJS[node.id].mostRecentPrice.fiatRational);
        } 
    }
        
    let action = wasBuy ? "BUY" : "SELL";
    const tokenAmountString = tokenAmountRational.toDecimal(node.tokenDecimals);
    const comparatorAmountString = comparatorAmountRational.toDecimal(node.comparatorDecimals);
    const fiatAmountString = fiatAmountRational ? fiatAmountRational.toDecimal(FIAT_DECIMALS) : null;
    //we ignore transactions less than 1 cent because low-volume transactions yield outlier results in defi
    //1 cent seems fine, but if you notice it still, up it to like 10 cents or whatever.
    if (fiatAmountString && Number(fiatAmountString) < 0.01){ 
        return null;
    }
   
    return {
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
        action, 
        tokenAmountRational,
        comparatorAmountRational, 
        fiatAmountRational, 
        tokenAmount: tokenAmountString,
        comparatorAmount: comparatorAmountString, 
        fiatAmount: fiatAmountString,
    };
}


function logHandlerBase(log){
    let parsedLog = getParsedLog(this, log);
    if (!parsedLog || !database.pairNodes[this.id]){
        return;
    }
    updatePrice(this, parsedLog);
    if (idToJS[this.id].oldestSwapBlockNumber === null){
        idToJS[this.id].oldestSwapBlockNumber === log.blockNumber;
    }

    const endpointNode = database.endpoints[database.exchanges[this.exchangeId].endpointId];
    let transactionURL = 'N/A';
    if (endpointNode.blockExplorerURL){
        transactionURL = endpointNode.blockExplorerURL;
        if (!transactionURL.endsWith('/')){
            transactionURL += '/';
        }
        transactionURL += `tx/${endpointNode.blockExplorerURL}${parsedLog.transactionHash}`;
    }
    
    emitter.emit('swap', {
        action: parsedLog.action,
        trackerId: this.id,
        timestamp: Date.now()/1000,//not real timestamp, which would involve getting the block data
        transactionHash: parsedLog.transactionHash,
        tokenAmount: parsedLog.tokenAmount,
        comparatorAmount: parsedLog.comparatorAmount,
        fiatAmount: parsedLog.fiatAmount,
        transactionURL
    });
};



async function pollFunctionBase(){
    const mostRecentPrice = await updatePrice(this);
    const js = idToJS[this.id];
    js.pollTimer = setTimeout(js.pollFunction, this.pollIntervalSeconds * 1000);
    if (!mostRecentPrice || !mostRecentPrice.comparatorRational){
        return;
    }

    emitter.emit('swap', {
        action: "POLL",
        trackerId: this.id,
        timestamp: Date.now()/1000, 
        transactionHash: 'N/A',
        transactionURL: null,
        tokenAmount: this.pollQuoteTokenAmount,
        comparatorAmount: mostRecentPrice.comparatorRational.multiply(this.pollQuoteTokenAmount).toDecimal(this.comparatorDecimals),
        fiatAmount:  mostRecentPrice.fiatRational ? mostRecentPrice.fiatRational.multiply(this.pollQuoteTokenAmount).toDecimal(FIAT_DECIMALS) : null,
    });
}



function startListening(node){
    node.isActive = true;
    const js = idToJS[node.id];
    const endpointNode = database.endpoints[database.exchanges[node.exchangeId].endpointId];
    if (js.listener){
        idToJS[endpointNode.id].provider.off(js.eventFilter, js.listener);
    }
    js.listener = null;
    if (js.pollTimer){
        clearTimeout(js.pollTimer);
    }
    js.pollTimer = null;
    if (node.updateMethod === UPDATE_METHOD.POLL){
        js.pollFunction =  pollFunctionBase.bind(node);
        js.pollTimer = setTimeout(js.pollFunction, node.pollIntervalSeconds * 1000);
    } else {
        js.listener = logHandlerBase.bind(node);
        idToJS[endpointNode.id].provider.on(js.eventFilter, js.listener);
    }
};


function stopListening(node){
    node.isActive = false;
    const js = idToJS[node.id];
    const endpointNode = database.endpoints[database.exchanges[node.exchangeId].endpointId];
    if (js.listener){
        idToJS[endpointNode.id].provider.off(js.eventFilter, js.listener);
    }
    js.listener = null;
    if (js.pollTimer){
        clearTimeout(js.pollTimer);
    }
    js.pollTimer = null;
    
};



//uplink nodes must exist! (i.e. do endpoints before exchanges, and exchanges before pairs)
//these objects contains all the things related to a node that we don't need to save out
function addJSComponent(node){
    if (node.type === NODE_TYPE.ENDPOINT){
        const limiter =  new RateLimiter({ tokensPerInterval: node.rateLimit, interval: "second" });
        idToJS[node.id] = {
            provider:  new ethers.providers.JsonRpcProvider(node.address),
            sendOne:  async function(obj, functionName, ...args){
                const remainingRequests = await limiter.removeTokens(1);
                return obj[functionName](...args);
            },
            exchangeIds: [],
            pairIds: [],
            tokenAddressToPairIds: {},   
        }
    } else if (node.type === NODE_TYPE.EXCHANGE){
        idToJS[node.id] = {
            pairIds: []
        }
    } else if (node.type === NODE_TYPE.PAIR){
        const endpointNode = database.endpoints[database.exchanges[node.exchangeId].endpointId];
        const tokenContract = ABI.createTokenContract(idToJS[endpointNode.id].provider, node.tokenAddress);
        const comparatorContract = ABI.createTokenContract(idToJS[endpointNode.id].provider, node.comparatorAddress);
        const pairContract = ABI.createPairContract(idToJS[endpointNode.id].provider, node.pairAddress);
        
        idToJS[node.id] = {
            tokenContract,
            comparatorContract,
            pairContract,
            priceIsUpdating: false,
            isGettingHistory: false,
            oldestSwapBlockNumber: null,
            mostRecentPrice: {
                fiatRational: null,
                comparatorRational: null,
                fiat: null,
                comparator: null
            },
            eventFilter: {
                address: [node.pairAddress],
                topics: [ethers.utils.id("Swap(address,uint256,uint256,uint256,uint256,address)")]
            },
            listener: null
        }
    }
}

function getEndpointNode(nodeId){
    if (database.endpoints[nodeId]){
        return database.endpoints[nodeId];
    }
}

async function addEndpointNode({address, name, ethTokenAddress, rateLimit, blockExplorerURL}, writeOutDatabase=true){
    console.log("Adding new endpoint", {address, name});

    const node = {
        type: NODE_TYPE.ENDPOINT, 
        id: (idTracker++).toString(),
        ethTokenAddress,
        address,
        name,
        rateLimit,
        ethTokenSymbol: null,
        ethTokenDecimals: null,
        blockExplorerURL
    };
    addJSComponent(node); //this means our js components may contain some garbage if an error occurs below before node is added

    emitter.emit('addTrackerProgress', {message: 'Retreiving native token info...'});
    const tokenContract = ABI.createTokenContract(idToJS[node.id].provider, ethTokenAddress);
    console.log('tokenContract', tokenContract.address);
    const [symbol, decimals] = await Promise.all([
        idToJS[node.id].sendOne(tokenContract, 'symbol'),
        idToJS[node.id].sendOne(tokenContract, 'decimals')
    ])
    node.ethTokenSymbol = symbol;
    node.ethTokenDecimals = decimals;
    
    database.endpoints[node.id] = node;
    if (writeOutDatabase){
        writeTokenDatabase();
    }
    return node;
}


function getExchangeNode(nodeId){
    if (database.exchanges[nodeId]){
        return database.exchanges[nodeId];
    }
}

//matches existing by either factoryAddress (if provided) or routerAddress (if provided)
async function addExchangeNode({endpointId, factoryAddress, routerAddress, name}, writeOutDatabase=true){
    let endpointNode = getEndpointNode(endpointId);

    console.log("Adding new exchange", {endpointId, factoryAddress, routerAddress, name});
    const node = {
        type: NODE_TYPE.EXCHANGE, 
        id: (idTracker++).toString(),
        endpointId: endpointNode.id,
        factoryAddress,
        routerAddress,
        name,
    };
    addJSComponent(node);

    idToJS[endpointNode.id].exchangeIds.push(node.id);
    database.exchanges[node.id] = node;
    if (writeOutDatabase){
        writeTokenDatabase();
    }
    
    return node;
}


function getPairNode(nodeId){
    if (database.pairNodes[nodeId]){
        return database.pairNodes[nodeId];
    }
}



//the factoryAddress/routerAddress should be for the exchange that holds the address-comparatorAddress pair
async function addPairNode({exchangeId, tokenAddress, comparatorAddress, 
comparatorIsFiat, updateMethod, pollIntervalSeconds, pollQuoteTokenAmount, isActive}, emitUpdates=true){
    const exchangeNode = getExchangeNode(exchangeId);
    const endpointNode = getEndpointNode(exchangeNode.endpointId);

    let tokenSymbol, tokenDecimals, comparatorSymbol, comparatorDecimals, pairDecimals;
    for (const node of Object.values(database.pairNodes)){
        if (tokenAddress === node.tokenAddress){
            tokenSymbol = node.tokenSymbol;
            tokenDecimals = node.tokenDecimals
        } else if (comparatorAddress === node.tokenAddress){
            comparatorSymbol = node.tokenSymbol;
            comparatorDecimals = node.tokenDecimals
        } 
        if (tokenAddress === node.comparatorAddress){
            tokenSymbol = node.comparatorSymbol;
            tokenDecimals = node.comparatorDecimals
        } else if (comparatorAddress === node.comparatorAddress){
            comparatorSymbol = node.comparatorSymbol;
            comparatorDecimals = node.comparatorDecimals
        } 
    }
    if (tokenAddress === endpointNode.ethTokenAddress){
        tokenSymbol = endpointNode.ethTokenSymbol;
        tokenDecimals = endpointNode.ethTokenDecimals;
    } else if (comparatorAddress === endpointNode.ethTokenAddress){
        comparatorSymbol = endpointNode.ethTokenSymbol;
        comparatorDecimals = endpointNode.ethTokenDecimals;
    }

    if (emitUpdates){
        emitter.emit('addTrackerProgress', {message: 'Fetching token info...'});
    }
    

    console.log("Adding new pair");
    console.log({exchangeId, tokenAddress, comparatorAddress, comparatorIsFiat});

    const tokenContract = ABI.createTokenContract(idToJS[endpointNode.id].provider, tokenAddress);
    const comparatorContract = ABI.createTokenContract(idToJS[endpointNode.id].provider, comparatorAddress);
    

    const sendOne = idToJS[endpointNode.id].sendOne;    

    let pairAddress, pairContract, comparatorIsToken1;
    [tokenSymbol, tokenDecimals, comparatorSymbol, comparatorDecimals] = await Promise.all([
        tokenSymbol || sendOne(tokenContract, 'symbol'),
        tokenDecimals || sendOne(tokenContract, 'decimals'),
        comparatorSymbol || sendOne(comparatorContract, 'symbol'),
        comparatorDecimals || sendOne(comparatorContract, 'decimals'),
        (async () => {
            const factoryContract = ABI.createFactoryContract(idToJS[endpointNode.id].provider, exchangeNode.factoryAddress);
            pairAddress = await sendOne(factoryContract, 'getPair', tokenAddress, comparatorAddress);
            pairContract = ABI.createPairContract(idToJS[endpointNode.id].provider, pairAddress);
            const [token0, pairD] =  await Promise.all([sendOne(pairContract, 'token0'), sendOne(pairContract, 'decimals')]);
            comparatorIsToken1 = token0.toLowerCase() === tokenAddress.toLowerCase();
            pairDecimals = pairD;
        })()
    ]);
    const node = {
        type: NODE_TYPE.PAIR, 
        id: (idTracker++).toString(),
        exchangeId: exchangeNode.id,
        isActive:  isActive === undefined ? true :isActive,
        tokenAddress,
        tokenDecimals,
        tokenSymbol,
        intraBackendSignature: exchangeNode.name,
        comparatorAddress,
        comparatorDecimals,
        comparatorSymbol,
        name: tokenSymbol + '-' +  comparatorSymbol,
        pairAddress,
        pairDecimals,
        comparatorIsToken1,
        msAtLastPriceUpdate: 0,
        comparatorIsFiat: !!comparatorIsFiat, //turn undefined into false
        updateMethod, pollIntervalSeconds, pollQuoteTokenAmount
    };

    database.pairNodes[node.id] = node;
    if (!idToJS[endpointNode.id].tokenAddressToPairIds[node.tokenAddress]){
        idToJS[endpointNode.id].tokenAddressToPairIds[node.tokenAddress] = [];
    }
    idToJS[endpointNode.id].pairIds.push(node.id);
    idToJS[endpointNode.id].tokenAddressToPairIds[node.tokenAddress].push(node.id);
    idToJS[exchangeNode.id].pairIds.push(node.id);
    writeTokenDatabase();

    addJSComponent(node);
    if (node.isActive){
        startListening(node);
    }

    return node;
}






function removePairNode(nodeId){
    const node =  database.pairNodes[nodeId];
    const exchangeNode = database.exchanges[node.exchangeId];
    const endpointNode = database.endpoints[exchangeNode.endpointId];
    stopListening(node);
    delete database.pairNodes[nodeId];

    util.removeArrayItemAll(idToJS[exchangeNode.id].pairIds, nodeId);
    util.removeArrayItemAll(idToJS[endpointNode.id].pairIds, nodeId);

    const tokenAddressesToIds = idToJS[endpointNode.id].tokenAddressToPairIds;
    util.removeArrayItemAll(tokenAddressesToIds[node.tokenAddress], nodeId);
    if (!tokenAddressesToIds[node.tokenAddress].length){
        delete tokenAddressesToIds[node.tokenAddress];
    } 

    writeTokenDatabase();
    return 0;
}


function setTrackerOptions(nodeId, options){
    const node =  database.pairNodes[nodeId];
    if (Object.keys(options).includes('isActive')){
        if (node.isActive && !options.isActive){
            node.isActive = false;
            writeTokenDatabase();
            stopListening(node);
        } else if (!node.isActive && options.isActive){
            node.isActive = true;
            writeTokenDatabase();
            startListening(node);
        }
    }
}

function getHistoryAllowed(nodeId){
    return false; // ! idToJS[nodeId].isGettingHistory;
}

//todo this function is a fever dream lol clean this shit up - I think it might be buggy as well
async function getHistoryMinuteKlines(nodeId){
    idToJS[nodeId].isGettingHistory = true;
    const node =  database.pairNodes[nodeId];
    const exchangeNode = database.exchanges[node.exchangeId];
    const endpointNode = database.endpoints[exchangeNode.endpointId];
    const endpointJS = idToJS[endpointNode.id];
    
    try {
        const filter = {...idToJS[nodeId].eventFilter};
        filter.address = filter.address[0]; //don't ask me- will probably be made consistent in future ethers update
        let lastBlock;
        if (idToJS[nodeId].oldestSwapBlockNumber !== null){
            lastBlock = idToJS[nodeId].oldestSwapBlockNumber;
        } else {
            lastBlock = 'latest';
        }

        emitter.emit('historyProgress', {p:0.05, trackerId: nodeId});

        const lastBlockData = await endpointJS.sendOne(endpointJS.provider, 'getBlock', lastBlock);
        lastBlock = lastBlockData.number; //now we can be sure it's not 'latest'
        console.log('to', lastBlockData.timestamp);
        emitter.emit('historyProgress', {p:0.1, trackerId: nodeId});
        const secondLastBlockData = await endpointJS.sendOne(endpointJS.provider, 'getBlock', lastBlock-1);
        let blockTimeSecsEstimate = lastBlockData.timestamp - secondLastBlockData.timestamp;
        if (blockTimeSecsEstimate <= 1){
            blockTimeSecsEstimate = 1;
        }
        
        let overallP = 0.15;
        emitter.emit('historyProgress', {p:overallP, trackerId: nodeId});
        
        const secondsInHour = 60 * 60
        const secondsPerBatch = 0.25 * secondsInHour;
        const batchSize = Math.floor(secondsPerBatch / blockTimeSecsEstimate);
        const numBatches = Math.ceil((4 * secondsInHour) / secondsPerBatch); //4 hours worth of data
        lastBlock += (90 / blockTimeSecsEstimate); //overlap buffer
        const firstBlock = (lastBlock - numBatches * batchSize) + 1;

        let oldestTimestamp = null;
        let oldestBlockNumber = null;
        let oldestPriceInfo = null;
        let timestampOfOldestPriceInfo = null;
        const promises = [];
        const priceInfos = [];
        for (let i = 0; i < numBatches; ++i){
            promises.push(
                (async () => {
                    const fromBlock = firstBlock + i * batchSize;
                    const toBlock = fromBlock + batchSize - 1;
                    const [fromBlockData, toBlockData] = await Promise.all([
                        endpointJS.sendOne(endpointJS.provider, 'getBlock', fromBlock),
                        i === numBatches - 1 ? lastBlockData : endpointJS.sendOne(endpointJS.provider, 'getBlock', toBlock)
                    ]);
                    oldestTimestamp = oldestTimestamp === null ? fromBlockData.timestamp : Math.min(fromBlockData.timestamp, oldestTimestamp);
                    oldestBlockNumber = oldestBlockNumber === null ? fromBlockData.number : Math.min(fromBlockData.number, oldestBlockNumber);
                    const avgBlockTime = (toBlockData.timestamp - fromBlockData.timestamp) / (toBlock - fromBlock);
                    const logs = await idToJS[nodeId].pairContract.queryFilter(filter, fromBlock, toBlock);
                    if (!database.pairNodes[nodeId]){
                        return;
                    }
                    for (const log of logs){
                        const timestamp = Math.round(fromBlockData.timestamp + avgBlockTime * (log.blockNumber - fromBlockData.number));
                        let parsedLog = getParsedLog(node, log);
                        if (!parsedLog){
                            continue;
                        }
                        const price = Number(parsedLog.comparatorAmount) / Number(parsedLog.tokenAmount);
                        const volume = Number(parsedLog.tokenAmount);
                        priceInfos.push({price,timestamp, volume, transactionHash: parsedLog.transactionHash});
                        if (timestampOfOldestPriceInfo === null || timestamp < timestampOfOldestPriceInfo){
                            timestampOfOldestPriceInfo = timestamp;
                            oldestPriceInfo = {price,timestamp, volume};
                        }
                    }
                    overallP += 0.85 * 1 / numBatches;
                    emitter.emit('historyProgress', {p:overallP, trackerId: nodeId});
                })()
            );
        }
        await Promise.all(promises);

        priceInfos.sort((a, b) => a.timestamp - b.timestamp);
        
        let utcTime =  (util.roundMSDownToDuration('1m', oldestTimestamp * 1000) / 1000);
        let nextUtcTime = utcTime + 60;
        const klines = [{
            open: oldestPriceInfo ? oldestPriceInfo.price : 0,
            high: oldestPriceInfo ? oldestPriceInfo.price : 0,
            low: oldestPriceInfo ? oldestPriceInfo.price : 0,
            close: oldestPriceInfo ? oldestPriceInfo.price : 0,
            volume: oldestPriceInfo ? oldestPriceInfo.volume : 0,
            utcTime: utcTime
        }];
        let index = 0;
        while (utcTime <= lastBlockData.timestamp){
            const currentKline = klines[klines.length-1];
            while (index < priceInfos.length && priceInfos[index].timestamp < nextUtcTime){
                const oldHigh = currentKline.high;
                const priceInfo = priceInfos[index];
                currentKline.close = priceInfo.price;
                currentKline.high = Math.max(currentKline.high, priceInfo.price);
                currentKline.low = Math.min(currentKline.low, priceInfo.price);
                currentKline.volume += priceInfo.volume;
                index += 1;
            }
            
            utcTime += 60;
            nextUtcTime += 60;

            klines.push({
                open: currentKline.close,
                high: currentKline.close,
                low: currentKline.close,
                close: currentKline.close,
                utcTime: utcTime
            });
        }

        idToJS[nodeId].oldestSwapBlockNumber = oldestBlockNumber;
        idToJS[nodeId].isGettingHistory = false;
        return klines;
    } catch (error){
        idToJS[nodeId].isGettingHistory = false;
        throw error;
    }
}




async function sendtransaction(endpointJS, contract, ...args){
    if (args[args.length - 1].gasPrice){
        if (args[0] === 'sendTransaction'){
            //provider.estimateGas( transaction ) ⇒ Promise< BigNumber >
            const gasEstimate = await endpointJS.sendOne(contract, 'estimateGas', args[1]);
            args[args.length - 1].gasLimit = gasEstimate;
        } else {
            //contract.estimateGas.METHOD_NAME( ...args [ , overrides ] ) ⇒ Promise< BigNumber >
            const gasEstimate = await endpointJS.sendOne(contract.estimateGas, ...args);
            args[args.length - 1].gasLimit = gasEstimate;
        }
    }
    return endpointJS.sendOne(contract, ...args);
}

async function getBalanceRational(pairNodeId, ofAddress, symbol, forceBalanceOf=false){
    const pairNode = database.pairNodes[pairNodeId];
    const pairNodeJS = idToJS[pairNodeId];
    const exchange = database.exchanges[pairNode.exchangeId];
    const endpointNode = database.endpoints[exchange.endpointId];
    const endpointJS = idToJS[exchange.endpointId];
    let address;
    let contract;
    let decimals;
    if (symbol === pairNode.tokenSymbol){
        address = pairNode.tokenAddress;
        decimals = pairNode.tokenDecimals;
        contract = pairNodeJS.tokenContract;
    } else if (symbol === pairNode.comparatorSymbol){
        address = pairNode.comparatorAddress;
        decimals = pairNode.comparatorDecimals;
        contract = pairNodeJS.comparatorContract;
    } else {
        address = pairNode.pairAddress;
        decimals = pairNode.pairDecimals;
        contract = pairNodeJS.pairContract;
    }

    let balanceBigNumber;
    if (!forceBalanceOf && address === endpointNode.ethTokenAddress){
        balanceBigNumber = await endpointJS.sendOne(endpointJS.provider, 'getBalance', ofAddress);
    } else {
        balanceBigNumber = await endpointJS.sendOne(contract, 'balanceOf', ofAddress);
    }
    
    const ret = bigRational(balanceBigNumber).divide(bigRational('10').pow(decimals));
    return ret;
}


async function getTokenSymbol(endpointId, tokenAddress){
    if (tokenAddress === database.endpoints[endpointId].ethTokenAddress){
        return database.endpoints[endpointId].ethTokenSymbol;
    }
    for (const node of Object.values(database.pairNodes)){
        if (endpointId === database.exchanges[node.exchangeId].endpointId){
            if (node.tokenAddress === tokenAddress){
               return node.tokenSymbol;
            }
            if (node.comparatorAddress === tokenAddress){
                return node.comparatorSymbol;
            }
        }
    }
    const endpointJS = idToJS[endpointId];
    const tokenContract = ABI.createTokenContract(endpointJS.provider, tokenAddress);
    return endpointJS.sendOne(tokenContract, 'symbol');
}
async function getTokenDecimals(endpointId, tokenAddress){
    if (tokenAddress === database.endpoints[endpointId].ethTokenAddress){
        return database.endpoints[endpointId].ethTokenDecimals;
    }
    for (const node of Object.values(database.pairNodes)){
        if (endpointId === database.exchanges[node.exchangeId].endpointId){
            if (node.tokenAddress === tokenAddress){
               return node.tokenDecimals;
            }
            if (node.comparatorAddress === tokenAddress){
                return node.comparatorDecimals;
            }
        }
    }
    const endpointJS = idToJS[endpointId];
    const tokenContract = ABI.createTokenContract(endpointJS.provider, tokenAddress);
    return endpointJS.sendOne(tokenContract, 'decimals');
}

function resolveAddressLocal(endpointNode, addressOrName, callbackTicket){
    let resolvedToAddress = null;
    const addressOrNameUpperCase = addressOrName.toUpperCase();
    if (addressOrNameUpperCase === endpointNode.ethTokenSymbol){
        resolvedToAddress = endpointNode.ethTokenAddress;
    } else {
        for (const pairId of idToJS[endpointNode.id].pairIds){
            const pairNode = database.pairNodes[pairId];
            if (pairNode.tokenSymbol.toUpperCase() === addressOrNameUpperCase){
                resolvedToAddress = pairNode.tokenAddress;
                break;
            } 
            if (pairNode.comparatorSymbol.toUpperCase() === addressOrNameUpperCase){
                resolvedToAddress = pairNode.comparatorAddress;
                break;
            } 
        }
    }
    if (resolvedToAddress && callbackTicket){
        win.send({message: `Resolved ${addressOrName} -> ${resolvedToAddress}`}, callbackTicket);
        return resolvedToAddress;
    }
    return addressOrName;
}

//if no callbackTicket is given, assume you want rational, not string.
async function getBalance({tokenAddress, walletAddress, callbackTicket, endpointName, decimals, symbol}){
    const endpointNode = Object.values(database.endpoints).filter(possibleEndpointNode => possibleEndpointNode.name === endpointName)[0];
    if (!endpointNode){
        throw `No endpoint found matching name "${endpointName}"`;
    }
    tokenAddress = resolveAddressLocal(endpointNode, tokenAddress, callbackTicket);
    if (callbackTicket){
        win.send({message: `Retreiving balance for ${walletAddress}...`}, callbackTicket);
    }
    const endpointJS = idToJS[endpointNode.id];
    const tokenContract = ABI.createTokenContract(endpointJS.provider, tokenAddress);
    const isEthToken = tokenAddress.toLowerCase() == endpointNode.ethTokenAddress.toLowerCase();
    const getBalanceFunc = async () => {
        if (isEthToken){
            const amount = await endpointJS.sendOne(endpointJS.provider, 'getBalance', walletAddress);
            console.log('amount', amount)
            //0 might be because this is a contract (e.g. LP) and for some reason you need to use balanceOf for those
            if (!amount.isZero()){
                return amount;
            }
            return endpointJS.sendOne(tokenContract, 'balanceOf', walletAddress);
        } else {
            return endpointJS.sendOne(tokenContract, 'balanceOf', walletAddress);
        }
    };
    const [balanceBigNumber, tokenSymbol, tokenDecimals] = await Promise.all([
        getBalanceFunc(),
        symbol || getTokenSymbol(endpointNode.id, tokenAddress),
        decimals || getTokenDecimals(endpointNode.id, tokenAddress),
    ]);
    if (callbackTicket){
        const balance = util.formatRational(bigRational(balanceBigNumber).divide(bigRational('10').pow(tokenDecimals)), tokenDecimals);
        win.send({message: `${tokenSymbol}: ${balance}`}, callbackTicket);
        return balance;
    } else {
        const balanceRational = bigRational(balanceBigNumber).divide(bigRational('10').pow(tokenDecimals));
        return balanceRational;
    }
}

async function getPairBalances(args){
    const callbackTicket = args.callbackTicket;
    const walletAddress = args.walletAddress;
    const node =  database.pairNodes[args.id];
    const addressToSymbol = {[node.tokenAddress]: node.tokenSymbol, [node.comparatorAddress]: node.comparatorSymbol};
    const addresses = [node.tokenAddress, node.comparatorAddress];
    win.send({message: `Retreiving balance of ${walletAddress}...`}, callbackTicket);
    const balancesRational = await Promise.all(addresses.map(address => getBalanceRational(node.id, walletAddress, addressToSymbol[address])));
    const ret = {
        [node.tokenAddress]: util.formatRational(balancesRational[0], node.tokenDecimals),
        [node.comparatorAddress]: util.formatRational(balancesRational[1], node.comparatorDecimals),
    }
    addresses.map(address => win.send({message: `${addressToSymbol[address]}: ${ret[address]}`}, callbackTicket));
    return ret;
}


function getNonceManagerProvider(ethTokenAddress, wallet){
    if (!nonceManagers[ethTokenAddress]){
        nonceManagers[ethTokenAddress] = {};
    }
    //So.. reusing the same nonce manager appears to lead to some cascading errors.
    //If I transferred using gas price = 1 on fantom, tx would fail (of course), but then subsequent txs would 
    //also fail- in fact they would get dropped from the mempool
    //if (!nonceManagers[ethTokenAddress][wallet.address]){
        nonceManagers[ethTokenAddress][wallet.address] = new NonceManager(wallet);
    //}
    return  nonceManagers[ethTokenAddress][wallet.address];
}



/*
buy + swapExactTokensForTokens: we're buying as much token as we can with an exact quantity of comparator.
buy + swapTokensForExactTokens: we're buying an exact amount of token with as few comparator as possible.
sell + swapExactTokensForTokens: we're selling an exact amount of token for as much comparator as we can.
sell + swapTokensForExactTokens: we're selling as little token as possible for an exact amount of comparator.
function swapExactTokensForTokens(  uint amountIn,  uint amountOutMin,  address[] calldata path,  address to,  uint deadline)
function swapTokensForExactTokens(  uint amountOut,  uint amountInMax,  address[] calldata path,  address to,  uint deadline)
*/  
async function swap(args){
    const nodeId = args.id;
    const callbackTicket = args.callbackTicket;
    const privateKey = args.privateKey;
    const type = args.type;
    const method = args.method;
    const quantityIsPercentage = args.quantityIsPercentage;
    const quantityString = args.quantity;
    const givenPriceInComparatorString = args.priceInComparator;
    const sippagePercentString = args.slippagePercent;
    const quantityDerivationLines = args.quantityDerivationLines;
    const timeoutSecs = Number(args.timeoutSecs);
    const {customGasPriceStringGwei, maxGasPriceStringGwei} = args;
    const isBuy = type === 'Buy';

    const node =  database.pairNodes[nodeId];
    const exchangeNode = database.exchanges[node.exchangeId];
    const endpointNode = database.endpoints[exchangeNode.endpointId];
    const addressToDecimals = {[node.tokenAddress]: node.tokenDecimals, [node.comparatorAddress]: node.comparatorDecimals};
    const addressToSymbol = {[node.tokenAddress]: node.tokenSymbol, [node.comparatorAddress]: node.comparatorSymbol};

    const nodeJS = idToJS[node.id];
    const endpointJS = idToJS[endpointNode.id];

    const formatRational = util.formatRational;

    const provider = new ethers.providers.JsonRpcProvider(endpointNode.address);
    const wallet = new ethers.Wallet(privateKey, provider);
    const nonceManagerProvider = getNonceManagerProvider(endpointNode.ethTokenAddress, wallet);

    const routerContract = ABI.createRouterContract(nonceManagerProvider, exchangeNode.routerAddress);

    win.send({message: 'Wallet: ' + wallet.address}, callbackTicket);
    win.send({message: 'Method: ' + method}, callbackTicket);
    win.send({message: 'Timeout: ' + timeoutSecs + ' seconds'}, callbackTicket);
    win.send({message: 'Slippage: ' + sippagePercentString + ' %'}, callbackTicket);

    const route = isBuy ? [node.comparatorAddress, node.tokenAddress] : [node.tokenAddress, node.comparatorAddress];
    
    const routeIndexOfExact = method === 'swapExactTokensForTokens' ? 0 : route.length-1;
    const routeIndexOfInexact = method === 'swapExactTokensForTokens' ? route.length-1 : 0;
    const addressOfExact = route[routeIndexOfExact];
    const addressOfInexact = route[routeIndexOfInexact];

    const needToleaveMin = false;// doesn't work - we'd need units of gas used in swap...  addressOfExact === route[0] && addressOfExact === endpointNode.ethTokenAddress;
    const overrides = await checkGasPriceConstraint(endpointNode, provider, customGasPriceStringGwei, maxGasPriceStringGwei, callbackTicket, needToleaveMin);
    let exactQuantityRational = bigRational(quantityString);
    const balances = {};
    const balancesForOutput = {};
    const routeBalancesRational = await Promise.all(route.map(address => getBalanceRational(node.id, wallet.address, addressToSymbol[address])));
    for (let i = 0; i < route.length; ++i){
        const address = route[i];
        balances[address] = routeBalancesRational[i];
        balancesForOutput[addressToSymbol[address]] = formatRational(routeBalancesRational[i], addressToDecimals[address]);
    }
    win.send({message: 'Balances before: ' + JSON.stringify(balancesForOutput)}, callbackTicket);
    
    if (quantityIsPercentage){
        exactQuantityRational = bigRational(quantityString).divide(100).multiply(routeBalancesRational[routeIndexOfExact]);
    } 
    
    for (const quantityLine of quantityDerivationLines){
        win.send({message: quantityLine}, callbackTicket);
    }
    if (quantityIsPercentage){ //otherwise we'd have already outputted final form
        win.send({message: `Exact quantity = ${formatRational(exactQuantityRational, addressToDecimals[addressOfExact])} ${addressToSymbol[addressOfExact]}`}, callbackTicket);
    }

    if (needToleaveMin){
        const gasPriceRational = bigRational(overrides.gasPrice.toString()).divide(bigRational('10').pow(endpointNode.ethTokenDecimals));
        const leftoverAfterGasMin = routeBalancesRational[0].minus(exactQuantityRational).minus(gasPriceRational);
        if (leftoverAfterGasMin.lesserOrEquals(0)){
            win.send({message: `Reducing quantity to leave minimum gas...`}, callbackTicket);
            exactQuantityRational = exactQuantityRational.minus(leftoverAfterGasMin.abs());
            win.send({message: `Exact quantity = ${formatRational(exactQuantityRational, addressToDecimals[addressOfExact])} ${addressToSymbol[addressOfExact]}`}, callbackTicket);
            
        }
    }

    const exactQuantityBigNumber = bigNumber.from(exactQuantityRational.multiply(bigRational('10').pow(addressToDecimals[addressOfExact])).toDecimal(0));
    const exactString = formatRational(exactQuantityRational, addressToDecimals[addressOfExact]);

    if (method === 'swapExactTokensForTokens'){
        if (exactQuantityRational.greater(balances[addressOfExact])){
            throw `Insufficient ${addressToSymbol[addressOfExact]} balance`;
        }
    }

    let currentInexactAmountRational;
    if (givenPriceInComparatorString){
        if (route[routeIndexOfExact] === node.tokenAddress){
            currentInexactAmountRational = exactQuantityRational.multiply(bigRational(givenPriceInComparatorString));
        } else {
            const priceInTokenRational = bigRational(1).divide(bigRational(givenPriceInComparatorString))
            currentInexactAmountRational =  exactQuantityRational.multiply(priceInTokenRational);
        }
    } else {
        let currentInexactAmountBigNumber
        if (method === 'swapExactTokensForTokens'){
            const amountsOut = await endpointJS.sendOne(routerContract, 'getAmountsOut', exactQuantityBigNumber, route);
            currentInexactAmountBigNumber = amountsOut[amountsOut.length - 1];
        } else {
            const amountsIn = await endpointJS.sendOne(routerContract, 'getAmountsIn', exactQuantityBigNumber, route);
            currentInexactAmountBigNumber = amountsIn[0];
        }
        currentInexactAmountRational = bigRational(currentInexactAmountBigNumber).divide(bigRational('10').pow(addressToDecimals[addressOfInexact]));
    }

    let inexactBoundsRational;
    const slippageDeltaRational = bigRational(sippagePercentString).divide(100).multiply(currentInexactAmountRational);
    if (method === 'swapExactTokensForTokens'){
        inexactBoundsRational = currentInexactAmountRational.minus(slippageDeltaRational);
    } else {
        inexactBoundsRational = currentInexactAmountRational.plus(slippageDeltaRational);
    }
    const inexactBoundsBigNumber = bigNumber.from(inexactBoundsRational.multiply(bigRational('10').pow(addressToDecimals[route[routeIndexOfInexact]])).toDecimal(0));

    const addressToSpend = isBuy ? node.comparatorAddress : node.tokenAddress;
    const amountToSpendBigNumber = method === 'swapExactTokensForTokens' ? exactQuantityBigNumber : inexactBoundsBigNumber;
    await checkAllowance({
        endpointId: endpointNode.id, 
        walletAddress: wallet.address, 
        addressToAllow: exchangeNode.routerAddress, nameToAllow: exchangeNode.name, 
        tokenAddress: addressToSpend, tokenSymbol: addressToSymbol[addressToSpend], 
        tokenContract: ABI.createTokenContract(nonceManagerProvider, addressToSpend), 
        requiredAmount: amountToSpendBigNumber, callbackTicket
    });

    let intentionStatement;
    const inexactString = formatRational(inexactBoundsRational, addressToDecimals[addressOfInexact]);
    if (method === 'swapExactTokensForTokens'){
        intentionStatement = `Swapping exactly ${exactString} ${addressToSymbol[addressOfExact]} for at least ${inexactString} ${addressToSymbol[addressOfInexact]}...`;
    } else {
        intentionStatement = `Swapping at most ${inexactString} ${addressToSymbol[addressOfInexact]} for exactly ${exactString} ${addressToSymbol[addressOfExact]}...`;
    }

    win.send({message: intentionStatement}, callbackTicket);
    
    const deadline = Math.floor(Date.now() / 1000) + timeoutSecs; //deadline is unix timestamp (seconds, not ms)

    let transactionResponse;
    let methodUsed;

    
   
    if (method === 'swapExactTokensForTokens' && route[routeIndexOfExact] === endpointNode.ethTokenAddress){
        methodUsed = 'swapExactETHForTokens';
        overrides.value = exactQuantityBigNumber;
        transactionResponse = sendtransaction(endpointJS,
            routerContract, methodUsed, inexactBoundsBigNumber, route, wallet.address, deadline, 
            overrides
        );
    } else if (method === 'swapExactTokensForTokens' && route[routeIndexOfInexact] === endpointNode.ethTokenAddress){
        methodUsed = 'swapExactTokensForETH';
        transactionResponse = sendtransaction(endpointJS,
            routerContract, methodUsed, exactQuantityBigNumber, inexactBoundsBigNumber, route, wallet.address, deadline, overrides   
        );

    
    } else if (method === 'swapTokensForExactTokens' && route[routeIndexOfExact] === endpointNode.ethTokenAddress){
        methodUsed = 'swapTokensForExactETH';
        transactionResponse = sendtransaction(endpointJS,
            routerContract, methodUsed, exactQuantityBigNumber, inexactBoundsBigNumber, route, wallet.address, deadline, overrides
        );
    } else if (method === 'swapTokensForExactTokens' && route[routeIndexOfInexact] === endpointNode.ethTokenAddress){
        methodUsed = 'swapETHForExactTokens';
        overrides.value = inexactBoundsBigNumber;
        transactionResponse = sendtransaction(endpointJS,
            routerContract, methodUsed, exactQuantityBigNumber, route, wallet.address, deadline, overrides
        );
    
    } else {
        methodUsed = method;
        transactionResponse = sendtransaction(endpointJS,
            routerContract, methodUsed, exactQuantityBigNumber, inexactBoundsBigNumberroute, deadline, overrides
        );
    }

    let transactionReceipt;
    try {
        transactionResponse = await transactionResponse;
        win.send({message: `Transaction ${transactionResponse.hash} sent - awaiting confirmation...`}, callbackTicket);
        transactionReceipt = await waitForTransaction(endpointJS, transactionResponse);
    } catch (error){
        console.log(error);
        throw error;
    }

    
    
    let swapLog;
    for (const log of transactionReceipt.logs){
        if (log.topics[0] === nodeJS.eventFilter.topics[0] && log.address === nodeJS.eventFilter.address[0]){
            swapLog = log;
            break;
        }
    }

    if (!swapLog){
        throw JSON.stringify({error: "Transaction reverted...", transactionReceipt});
    }

    win.send({message: 'OK! TX: ' + transactionReceipt.transactionHash}, callbackTicket);

    const parsedLog = getParsedLog(node, swapLog);
    const swapLine = `${parsedLog.action} ${parsedLog.tokenAmount} ${node.tokenSymbol} FOR ${parsedLog.comparatorAmount} ${node.comparatorSymbol} ($${parsedLog.fiatAmount})`;
    win.send({message: swapLine}, callbackTicket);

    const routeBalancesAfterRational = await Promise.all(route.map(address => getBalanceRational(node.id, wallet.address, addressToSymbol[address])));
    const balancesAfterForOutput = {};
    for (let i = 0; i < route.length; ++i){
        const address = route[i];
        balancesAfterForOutput[addressToSymbol[address]] = formatRational(routeBalancesAfterRational[i], addressToDecimals[address]);
    }
    win.send({message: 'Balances after: ' + JSON.stringify(balancesAfterForOutput)}, callbackTicket);



    
    let averagePrice = '0';
    if (parsedLog.tokenAmountRational.greater('0')){
        averagePrice = formatRational(parsedLog.comparatorAmountRational.divide(parsedLog.tokenAmountRational), node.comparatorAddress);
    }
    return {
        transactionHash: transactionReceipt.transactionHash,
        tokenBalanceBefore: (balancesForOutput[node.tokenSymbol]),
        tokenBalanceAfter: (balancesAfterForOutput[node.tokenSymbol]),
        comparatorBalanceBefore: (balancesForOutput[node.comparatorSymbol]),
        comparatorBalanceAfter: (balancesAfterForOutput[node.comparatorSymbol]),
        tokenAmountIn: parsedLog.action === 'BUY' ? '0' : parsedLog.tokenAmount,
        tokenAmountOut: parsedLog.action === 'SELL' ? '0' : parsedLog.tokenAmount,
        comparatorAmountIn: parsedLog.action === 'SELL' ? '0' : parsedLog.comparatorAmount,
        comparatorAmountOut: parsedLog.action === 'BUY' ? '0' : parsedLog.comparatorAmount,
        averagePrice


    }
}


function lowestRational(ratA, ratB){
    return ratA.lesser(ratB) ? ratA : ratB;
}


//throws if maxGasPriceStringGwei and gas price exceeds it
async function checkGasPriceConstraint(endpointNode, provider, customGasPriceStringGwei, maxGasPriceStringGwei, callbackTicket, force=false){
    const endpointJS = idToJS[endpointNode.id];
    const overrides = {};
    if (maxGasPriceStringGwei !== '' || customGasPriceStringGwei !== '' || force){
        win.send({message: 'Retrieving gas estimate...'}, callbackTicket);
        const recommendedGasPerUnitBigNumber = await endpointJS.sendOne(provider, 'getGasPrice');
        const recommendedGasPerUnitStringGwei = ethers.utils.formatUnits(recommendedGasPerUnitBigNumber, "gwei");
        win.send({message: `Recommended gas price: ${recommendedGasPerUnitStringGwei}`}, callbackTicket);
        const recommendedGasPerUnitRationalGwei = bigRational(recommendedGasPerUnitStringGwei);

        const maxGasFeeRationalGwei = maxGasPriceStringGwei !== '' ? bigRational(maxGasPriceStringGwei) : null;
        if (maxGasPriceStringGwei !== '' && customGasPriceStringGwei === ''){           
           if (recommendedGasPerUnitRationalGwei.greater(maxGasFeeRationalGwei)){
                win.send({message: `Gas price: ${recommendedGasPerUnitStringGwei} gwei 🞪`}, callbackTicket);
                const line = `Recommended gas price exceeds maximum (${util.formatRational(recommendedGasPerUnitRationalGwei, endpointNode.ethTokenDecimals)} > ${util.formatRational(maxGasFeeRationalGwei, endpointNode.ethTokenDecimals)}). Transaction cancelled`;
                throw line;
            } 
        }
        let gasPriceToUseRationalGwei = recommendedGasPerUnitRationalGwei;
        
        if (customGasPriceStringGwei !== ''){
            if (customGasPriceStringGwei.endsWith('%')){
                const customGasPriceRationalGwei = bigRational(customGasPriceStringGwei.slice(0,-1));
                //note you ca set lower gas than recommended by giving a % less than 100
                //if maxGasFeeRationalGwei is lower than result, just the use maxGasFeeRationalGwei (know it's higher than recommended
                //at least)
                gasPriceToUseRationalGwei =  recommendedGasPerUnitRationalGwei.multiply(customGasPriceRationalGwei.divide(100));
                if (maxGasFeeRationalGwei && maxGasFeeRationalGwei.lesser(gasPriceToUseRationalGwei)){
                    gasPriceToUseRationalGwei = maxGasFeeRationalGwei
                    win.send({message: `Custom gas price as percentage exceeds maximum but maximum is higher than recommended. Using maximum: ${util.formatRational(maxGasFeeRationalGwei, endpointNode.ethTokenDecimals)}`}, callbackTicket);
                    win.send({message: `Gas price: ${util.formatRational(gasPriceToUseRationalGwei, endpointNode.ethTokenDecimals)} gwei ✓`}, callbackTicket);
                } else {
                    win.send({message: `Using custom gas: ${customGasPriceStringGwei} of ${util.formatRational(recommendedGasPerUnitRationalGwei, endpointNode.ethTokenDecimals)}`}, callbackTicket);
                    win.send({message: `Gas price: ${util.formatRational(gasPriceToUseRationalGwei, endpointNode.ethTokenDecimals)} gwei ✓`}, callbackTicket);
                }
            } else {
                const customGasPriceRationalGwei = bigRational(customGasPriceStringGwei);
                if (maxGasFeeRationalGwei && customGasPriceRationalGwei.greater(maxGasFeeRationalGwei)) {
                    win.send({message: `Gas price: ${recommendedGasPerUnitStringGwei} gwei 🞪`}, callbackTicket);
                    const line = `Custom gas price exceeds maximum (${util.formatRational(customGasPriceRationalGwei, endpointNode.ethTokenDecimals)} > ${util.formatRational(maxGasFeeRationalGwei, endpointNode.ethTokenDecimals)}). Transaction cancelled`;
                    throw line;
                }
                win.send({message: `Using custom gas: ${customGasPriceStringGwei}`}, callbackTicket);
                if (recommendedGasPerUnitRationalGwei.greater(customGasPriceRationalGwei)){
                    win.send({message: `Gas price: ${customGasPriceStringGwei} gwei 🞪 (may revert)`}, callbackTicket);
                } else {
                    win.send({message: `Gas price: ${customGasPriceStringGwei} gwei ✓`}, callbackTicket);
                }
                gasPriceToUseRationalGwei = customGasPriceRationalGwei;
            }
        } else {
            win.send({message: `Gas price: ${recommendedGasPerUnitStringGwei} gwei ✓`}, callbackTicket);
        }

        if (maxGasPriceStringGwei === '' && customGasPriceStringGwei === ''){//forced only reason
            win.send({message: `Gas price: ${customGasPriceStringGwei} gwei ✓`}, callbackTicket);
        } 

        //nine decimals to go from gwei(9) to wei(0)
        overrides.gasPrice = bigNumber.from(gasPriceToUseRationalGwei.multiply(bigRational('10').pow(9)).toDecimal(0));;
    }
    return overrides;
}




async function transfer(args){
    const endpointName = args.endpointName;
    const endpointNode = Object.values(database.endpoints).filter(possibleEndpointNode => possibleEndpointNode.name === endpointName)[0];
    if (!endpointNode){
        throw `No endpoint found matching name "${endpointName}"`;
    }
    const formatRational = util.formatRational;
    const endpointJS = idToJS[endpointNode.id];
    const callbackTicket = args.callbackTicket;
    const toAddress = args.toAddress;
    const tokenAddress = resolveAddressLocal(endpointNode, args.tokenAddress, callbackTicket); 
    const quantityString = args.quantity;
    const quantityIsPercentage = args.quantityIsPercentage;
    const quantityDerivationLines = args.quantityDerivationLines;
    const {customGasPriceStringGwei, maxGasPriceStringGwei} = args;
    
    const provider = new ethers.providers.JsonRpcProvider(endpointNode.address);
    const wallet = new ethers.Wallet(args.privateKey, provider);

    const [symbol, decimals] = await Promise.all([
        getTokenSymbol(endpointNode.id, tokenAddress),
        getTokenDecimals(endpointNode.id, tokenAddress)
    ]);

    const overrides = await checkGasPriceConstraint(endpointNode, provider, customGasPriceStringGwei, maxGasPriceStringGwei, callbackTicket);

    const balancesRationalArray = await Promise.all([
        getBalance({tokenAddress, walletAddress: wallet.address, endpointName, decimals, symbol}),
        getBalance({tokenAddress, walletAddress: toAddress, endpointName, decimals, symbol})
    ]);
    const balancesForOutput = {
        [wallet.address]:  formatRational(balancesRationalArray[0], decimals),
        [toAddress]:  formatRational(balancesRationalArray[1], decimals),
    }
    win.send({message: `${symbol} balances before: ${JSON.stringify(balancesForOutput)}`}, callbackTicket); 
    
    for (const quantityLine of quantityDerivationLines){
        win.send({message: quantityLine}, callbackTicket);
    }
    let exactQuantityRational = bigRational(quantityString);
    if (quantityIsPercentage){
        exactQuantityRational = bigRational(quantityString).divide(100).multiply(balancesRationalArray[0]);
    } 
    const exactQuantityBigNumber = bigNumber.from(exactQuantityRational.multiply(bigRational('10').pow(decimals)).toDecimal(0));
    const exactString = formatRational(exactQuantityRational, decimals);
    if (quantityIsPercentage){ //otherwise we'd have already outputted final form
        win.send({message: `Quantity = ${exactString} ${symbol}`}, callbackTicket);
    }

    win.send({message: `Sending ${exactString} ${symbol} to ${toAddress}`}, callbackTicket);
    
    let transactionResponse;
    const nonceManagerProvider = getNonceManagerProvider(endpointNode.ethTokenAddress, wallet);
    if (tokenAddress === endpointNode.ethTokenAddress){
        overrides.to = toAddress;
        overrides.value = exactQuantityBigNumber
        transactionResponse = await sendtransaction(endpointJS, nonceManagerProvider, 'sendTransaction', overrides);
    } else {
        const tokenContract = ABI.createTokenContract(nonceManagerProvider, tokenAddress);
        transactionResponse = await sendtransaction(endpointJS, tokenContract, 'transfer', toAddress, exactQuantityBigNumber, overrides);
    }
    
    win.send({message: `Transaction ${transactionResponse.hash} sent - awaiting confirmation...`}, callbackTicket);
    let transactionReceipt;
    try {
        transactionReceipt = await waitForTransaction(endpointJS, transactionResponse);
    } catch (error){
        console.log(error);
        throw error;
    }
    win.send({message: 'OK! TX: ' + transactionReceipt.transactionHash}, callbackTicket);

    const balancesAfterRationalArray = await Promise.all([
        getBalance({tokenAddress, walletAddress: wallet.address, endpointName, decimals, symbol}),
        getBalance({tokenAddress, walletAddress: toAddress, endpointName, decimals, symbol})
    ]);
    const balancesAfterForOutput = {
        [wallet.address]:  formatRational(balancesAfterRationalArray[0], decimals),
        [toAddress]:  formatRational(balancesAfterRationalArray[1], decimals),
    }
    win.send({message: `${symbol} balances after: ${JSON.stringify(balancesAfterForOutput)}`}, callbackTicket);

    return {
        transactionHash: transactionReceipt.transactionHash,
        senderBalanceBefore: (balancesForOutput[wallet.address]),
        senderBalanceAfter: (balancesAfterForOutput[wallet.address]),
        receiverBalanceBefore: (balancesForOutput[toAddress]),
        receiverBalanceAfter: (balancesAfterForOutput[toAddress]),
        tokenAmountIn: exactString
    }
}

function getAbiAsJson(str){
    if (!str.startsWith(`[`)){
        if (str.startsWith(`{`)){
            str = `[${str}]`;
        } else {
            str =  `["${str}"]`;
        }
    }
    try {
        return JSON.parse(new ethers.utils.Interface(str).format(ethers.utils.FormatTypes.json));
    } catch (error) {
        return null;
    }
}



async function generalContractCall({endpointName, privateKey, contractAddress, customGasPriceStringGwei, maxGasPriceStringGwei, valueField, abiFragment, functionArgsDerivedValues, callbackTicket}){
    const endpointNode = Object.values(database.endpoints).filter(possibleEndpointNode => possibleEndpointNode.name === endpointName)[0];
    if (!endpointNode){
        throw `No endpoint found matching name "${endpointName}"`;
    }
    const endpointJS = idToJS[endpointNode.id];
    
    const abiFragmentJSON = getAbiAsJson(abiFragment);

    const functionName = abiFragmentJSON[0].name;
    

    let provider = endpointJS.provider;
    if (privateKey){
        const wallet = new ethers.Wallet(privateKey, provider);
        const nonceManagerProvider = getNonceManagerProvider(endpointNode.ethTokenAddress, wallet);
        provider = nonceManagerProvider;
    } 

    //win.send({message: `Contract: ${contractAddress}`}, callbackTicket);
    win.send({message: `Function: ${functionName}`}, callbackTicket);
    const functionArgValues = [];
    for (let i = 0; i < functionArgsDerivedValues.length; ++ i){
        const functionArgDerivedValues = functionArgsDerivedValues[i];
        for (const value of functionArgDerivedValues){
            win.send({message: `Args ${i}: ${value}`}, callbackTicket);
        }
        let arg = functionArgDerivedValues[functionArgDerivedValues.length - 1];
        if (arg !== '' && !isNaN(arg) && !util.VALID_ERC20_REGEX.test(arg)){
            arg = bigNumber.from(arg.split(".")[0]);
        }
        functionArgValues.push(arg);
    }

    const contract = new ethers.Contract(contractAddress, abiFragmentJSON, provider);

    const overrides = await checkGasPriceConstraint(endpointNode, provider, customGasPriceStringGwei, maxGasPriceStringGwei, callbackTicket);
    if (valueField !== null && valueField !== undefined){
        overrides.value = bigNumber.from(valueField);
    }

    let response = sendtransaction(endpointJS, contract, functionName, ...functionArgValues, overrides);
    win.send({message: 'Sending transaction...'}, callbackTicket);
    response = await response;
    if (typeof response === 'object' && response.wait && response.nonce){
        win.send({message: 'TX: ' + response.hash}, callbackTicket);
        win.send({message: 'Awaiting confirmation...'}, callbackTicket);

        let transactionReceipt;
        try {   
            transactionReceipt = await waitForTransaction(endpointJS, transactionResponse);
        } catch (error){
            console.log(error);
            throw error;
        }

        win.send({message: 'OK!'}, callbackTicket);
        return transactionReceipt.transactionHash;
    } else {
        if (bigNumber.isBigNumber(response)){
            response = response.toString();
        }
        return response;
    }   
}





async function generalContractWait({endpointName, contractAddress, abiFragment, callbackTicket}){
    const endpointNode = Object.values(database.endpoints).filter(possibleEndpointNode => possibleEndpointNode.name === endpointName)[0];
    if (!endpointNode){
        throw `No endpoint found matching name "${endpointName}"`;
    }
    const endpointJS = idToJS[endpointNode.id];

    const abiFragmentJSON = getAbiAsJson(abiFragment);

    const eventName = abiFragmentJSON[0].name;

    const contract = new ethers.Contract(contractAddress, abiFragmentJSON, endpointJS.provider);

    win.send({message: `Waiting for "${eventName}"...`}, callbackTicket);

    let resolverFunc;
    const promise = new Promise((resolve, reject) => {
        resolverFunc = resolve;
    });

    contract.once(eventName, (...parameters) => {
        let result = {};
        for (let i = 0; i < abiFragmentJSON[0].inputs.length; ++i){
            const name = abiFragmentJSON[0].inputs[i].name;
            result[name] = bigNumber.isBigNumber(parameters[i]) ? parameters[i].toString() : parameters[i];
        }
     
        win.send({message: 'Event fired!'}, callbackTicket)
        resolverFunc(result);
    });

    return promise;
}





//assumes nodes will all be of the same type
async function updateDatabase(args){
    //this is where the assumption is made- we don't copy the whole database
    let oldDatabaseSection;
    let databaseSectionName;
    const {addedNodes, editedNodes, removedNodes} = args;
    for (const nodeArray of [addedNodes, editedNodes, removedNodes]){
        if (nodeArray.length){
            databaseSectionName = NODE_TYPE_TO_DATABASE_NAME[nodeArray[0].type];
            oldDatabaseSection = JSON.parse(JSON.stringify(database[databaseSectionName]));
        }
    }
    try {
        let addedNodeInfos = [];
        const addNodesPromise = Promise.all(addedNodes.map(async addedNode => {
            if (addedNode.type === NODE_TYPE.ENDPOINT){
                addedNodeInfos.push(await addEndpointNode(addedNode, false));
            } else if (addedNode.type === NODE_TYPE.EXCHANGE){
                addedNodeInfos.push(await addExchangeNode(addedNode, false));
            }
        }));
        const updateNodesPromise = Promise.all(editedNodes.map(async editedNode => {
            const node = database[databaseSectionName][editedNode.id];
            let ethTokenAddressChanged = false;
            for (const key of Object.keys(editedNode)){
                if (node[key] !== editedNode[key]){
                    node[key] = editedNode[key];
                    if (key === 'ethTokenAddress'){

                    }
                }
            }
            if (ethTokenAddressChanged){
                emitter.emit('addTrackerProgress', {message: 'Retreiving native token info for updated endpoint'});
                const tokenContract = ABI.createTokenContract(idToJS[node.id].provider,  node.ethTokenAddress);
                const [symbol, decimals] = await Promise.all([
                    idToJS[node.id].sendOne(tokenContract, 'symbol'),
                    idToJS[node.id].sendOne(tokenContract, 'decimals')
                ])
                node.ethTokenSymbol = symbol;
                node.ethTokenDecimals = decimals;
            }
        }));
        for (const removedNode of removedNodes){
            delete database[databaseSectionName][removedNode.id];
        }
        await Promise.all([addNodesPromise, updateNodesPromise]);
        writeTokenDatabase();
        return {success: true, addedNodeInfos};
    } catch (error){
        console.log(error);
        database[databaseSectionName] = oldDatabaseSection;
        return {success: false, error};
    }
}



async function getLiquidityTotalSupplyMarketCap(nodeId){
    const node =  database.pairNodes[nodeId];
    const nodeJS =  idToJS[nodeId];
    const exchangeNode = database.exchanges[node.exchangeId];
    const endpointNode = database.endpoints[exchangeNode.endpointId];
    const endpointJS = idToJS[exchangeNode.endpointId];
    const token0Decimals = node.comparatorIsToken1 ? node.tokenDecimals : node.comparatorDecimals;
    const token1Decimals = node.comparatorIsToken1 ? node.comparatorDecimals : node.tokenDecimals;

    const tokenContract = ABI.createTokenContract(endpointJS.provider, node.tokenAddress);
    const [reservesBigNumber, totalSupplyBigNumber] = await Promise.all([
        endpointJS.sendOne(idToJS[node.id].pairContract, 'getReserves'),
        endpointJS.sendOne(tokenContract, 'totalSupply'),
    ]);
    const reserve0AsRational = bigRational(reservesBigNumber.reserve0.toString()).divide(bigRational('10').pow(token0Decimals));
    const reserve1AsRational = bigRational(reservesBigNumber.reserve1.toString()).divide(bigRational('10').pow(token1Decimals));
    const reserveTokenRational = node.comparatorIsToken1 ? reserve0AsRational : reserve1AsRational;
    const reserveComparatorRational = node.comparatorIsToken1 ? reserve1AsRational : reserve0AsRational;
    const liquidity = {
        token: util.formatRational(reserveTokenRational, node.tokenDecimals),
        comparator: util.formatRational(reserveComparatorRational, node.comparatorDecimals),
    }

    const totalsupplyRational = bigRational(totalSupplyBigNumber.toString()).divide(bigRational('10').pow(node.tokenDecimals));
    const totalSupply = util.formatRational(totalsupplyRational, node.tokenDecimals);
    const priceComparator = nodeJS.mostRecentPrice && nodeJS.mostRecentPrice.comparator ? bigRational(nodeJS.mostRecentPrice.comparator) : reserveComparatorRational.divide(reserveTokenRational)
    const marketCapComparatorRational = totalsupplyRational.multiply(priceComparator);
    const marketCapFiatRational = nodeJS.mostRecentPrice && nodeJS.mostRecentPrice.fiat ? totalsupplyRational.multiply(bigRational(nodeJS.mostRecentPrice.fiat)) : null;
        
    const marketCap = {
        comparator: util.formatRational(marketCapComparatorRational, node.tokenDecimals),
        fiat: marketCapFiatRational ? util.formatRational(marketCapFiatRational, FIAT_DECIMALS) : null,
    }
    
    return {liquidity, totalSupply, marketCap};

}




async function addOrRemoveliquidity({id, privateKey, type, tokenQuantity, liquidityQuantity, quantityDerivationLines, minEthReserved,
slippagePercent, quantityIsPercentage, timeoutSecs, customGasPriceStringGwei, maxGasPriceStringGwei, callbackTicket}){

    const formatRational = util.formatRational;

    const node =  database.pairNodes[id];
    const exchangeNode = database.exchanges[node.exchangeId];
    const endpointNode = database.endpoints[exchangeNode.endpointId];

    const nodeJS = idToJS[node.id];
    const exchangeJS = idToJS[exchangeNode.id];
    const endpointJS = idToJS[endpointNode.id];

    const provider = new ethers.providers.JsonRpcProvider(endpointNode.address);
    const wallet = new ethers.Wallet(privateKey, provider);
    const nonceManagerProvider = getNonceManagerProvider(endpointNode.ethTokenAddress, wallet);
    const routerContract = ABI.createRouterContract(nonceManagerProvider, exchangeNode.routerAddress);
    const pairContract = ABI.createPairContract(nonceManagerProvider, node.pairAddress);

    const deadline = Math.floor(Date.now() / 1000) + Number(timeoutSecs); //deadline is unix timestamp (seconds, not ms)
    const slippageProportionRational = bigRational(slippagePercent).divide(100);

    const [overrides, reserveRatios] = await Promise.all([
        await checkGasPriceConstraint(endpointNode, provider, customGasPriceStringGwei, maxGasPriceStringGwei, callbackTicket),
        await getReserveRatio(node),
    ]);

    const addressToDecimals = {[node.tokenAddress]: node.tokenDecimals, [node.comparatorAddress]: node.comparatorDecimals, [node.pairAddress]: node.pairDecimals};
    const addressToSymbol = {[node.tokenAddress]: node.tokenSymbol, [node.comparatorAddress]: node.comparatorSymbol, [node.pairAddress]: node.name};

    const balancesForOutput = {};
    const balancesRational = {};
    await Promise.all(Object.keys(addressToDecimals).map(async address => balancesRational[address] = await getBalanceRational(node.id, wallet.address, addressToSymbol[address])));
    for (const address of Object.keys(addressToDecimals)){
        balancesForOutput[addressToSymbol[address]] = formatRational(balancesRational[address], addressToDecimals[address]);
    }
    win.send({message: 'Balances before: ' + JSON.stringify(balancesForOutput)}, callbackTicket);

    

    let transactionResponse;
    if (type === 'Add'){
        const minEthReservedRational = bigRational(minEthReserved);
        
        let tokenQuantityRational = bigRational(tokenQuantity);

        //token quantity
        if (quantityIsPercentage){
            tokenQuantityRational = tokenQuantityRational.divide(100).multiply(balancesRational[node.tokenAddress]);
        } 
        if (node.tokenAddress === endpointNode.ethTokenAddress){
            const leftover = balancesRational[node.tokenAddress].minus(tokenQuantityRational);
            if (leftover.lesser(minEthReservedRational)){
                tokenQuantityRational = balancesRational[node.tokenAddress].minus(minEthReservedRational);
            }
        }
        for (const quantityLine of quantityDerivationLines){
            win.send({message: quantityLine}, callbackTicket);
        }
        if (quantityIsPercentage){ //otherwise we'd have already outputted final form
            const quantityString = formatRational(tokenQuantityRational, node.tokenDecimals);
            win.send({message: `Token quantity = ${quantityString} ${node.tokenSymbol}`}, callbackTicket);
        }
        if (node.tokenAddress === endpointNode.ethTokenAddress 
        && tokenQuantityRational.add(minEthReservedRational).greater(balancesRational[node.tokenAddress])){
            throw `${node.tokenSymbol} balance is less than required to leave reserved`;
        }
        if (tokenQuantityRational.greater(balancesRational[node.tokenAddress])){
            throw `Insufficient ${node.tokenSymbol} balance`;
        }

        //comparator quantity and downscaling
        let comparatorQuantityRational = tokenQuantityRational.multiply(reserveRatios.comparatorPerToken);
        {
            const quantityString = formatRational(comparatorQuantityRational, node.comparatorDecimals);
            win.send({message: `Comparator quantity = ${quantityString} ${node.comparatorSymbol}`}, callbackTicket);
        }
        let leftover = balancesRational[node.comparatorAddress].minus(comparatorQuantityRational);
        if (node.comparatorAddress === endpointNode.ethTokenAddress){
            if (!balancesRational[node.comparatorAddress].minus(minEthReservedRational).isPositive()){
                throw `${node.comparatorSymbol} balance is less than required to leave reserved`;
            }
            leftover = leftover.minus(minEthReservedRational);
        }
        if (leftover.isNegative()){
            const difference = leftover.abs();
            const differenceProportion = difference.divide(comparatorQuantityRational)
            win.send({message: `Lowering quantities to match balance constraints...`}, callbackTicket);
            tokenQuantityRational = tokenQuantityRational.minus(tokenQuantityRational.multiply(differenceProportion));
            comparatorQuantityRational = comparatorQuantityRational.minus(comparatorQuantityRational.multiply(differenceProportion));
        }
        
        //ok!
        const minTokenRational = tokenQuantityRational.minus(tokenQuantityRational.multiply(slippageProportionRational));
        const minComparatorRational = comparatorQuantityRational.minus(comparatorQuantityRational.multiply(slippageProportionRational));

        const tokenQuantityBigNumber = bigNumber.from(tokenQuantityRational.multiply(bigRational('10').pow(node.tokenDecimals)).toDecimal(0));
        const mintokenQuantityBigNumber = bigNumber.from(minTokenRational.multiply(bigRational('10').pow(node.tokenDecimals)).toDecimal(0));
      
        const comparatorQuantityBigNumber = bigNumber.from(comparatorQuantityRational.multiply(bigRational('10').pow(node.comparatorDecimals)).toDecimal(0));
        const minComparatorQuantityBigNumber = bigNumber.from(minComparatorRational.multiply(bigRational('10').pow(node.comparatorDecimals)).toDecimal(0));

        await checkAllowance({
            endpointId: endpointNode.id, callbackTicket,
            walletAddress: wallet.address, 
            addressToAllow: exchangeNode.routerAddress, nameToAllow: exchangeNode.name,
            tokenAddress: node.tokenAddress, tokenSymbol: node.tokenSymbol, tokenContract: ABI.createTokenContract(nonceManagerProvider, node.tokenAddress),
            requiredAmount: tokenQuantityBigNumber,
        });
        await checkAllowance({
            endpointId: endpointNode.id, callbackTicket,
            walletAddress: wallet.address, 
            addressToAllow: exchangeNode.routerAddress, nameToAllow: exchangeNode.name,
            tokenAddress: node.comparatorAddress, tokenSymbol: node.comparatorSymbol, tokenContract: ABI.createTokenContract(nonceManagerProvider, node.comparatorAddress),
            requiredAmount: comparatorQuantityBigNumber,
        });

        const tokenPart = `${formatRational(tokenQuantityRational, node.tokenDecimals)} ${node.tokenSymbol} (min ${formatRational(minTokenRational, node.tokenDecimals)})`;
        const comparatorPart = `${formatRational(comparatorQuantityRational, node.comparatorDecimals)} ${node.comparatorSymbol} (min ${formatRational(minComparatorRational, node.comparatorDecimals)})`;
        const intentionStatement = `Adding ${tokenPart} and ${comparatorPart} to liquidity on ${exchangeNode.name}`;
        win.send({message: intentionStatement}, callbackTicket);

        //finally, add liquidity
        if (node.comparatorAddress === endpointNode.ethTokenAddress){
            overrides.value = comparatorQuantityBigNumber;
            transactionResponse = await sendtransaction(
                endpointJS, routerContract, 'addLiquidityETH', node.tokenAddress, 
                tokenQuantityBigNumber, mintokenQuantityBigNumber,
                minComparatorQuantityBigNumber, wallet.address, deadline, overrides
            );
        } else if (node.tokenAddress === endpointNode.ethTokenAddress){
            overrides.value = tokenQuantityBigNumber;
            transactionResponse = await sendtransaction(
                endpointJS, routerContract, 'addLiquidityETH', node.comparatorAddress, 
                comparatorQuantityBigNumber, minComparatorQuantityBigNumber,
                mintokenQuantityBigNumber, wallet.address, deadline, overrides
            );
        } else {
            transactionResponse = await sendtransaction(
                endpointJS, routerContract, 'addLiquidity', node.tokenSymbol, node.comparatorAddress, 
                tokenQuantityBigNumber, comparatorQuantityBigNumber,
                mintokenQuantityBigNumber, minComparatorQuantityBigNumber,
                wallet.address, deadline, overrides
            );
        }
    

    
    } else if (type === 'Remove') {
        win.send({message: `Calculating LP distribution...`}, callbackTicket);
        const [totalPairSupplyBigNumber, reservesBigNumber] = await Promise.all([
            endpointJS.sendOne(pairContract, 'totalSupply'),
            endpointJS.sendOne(pairContract, 'getReserves'),
        ]);
        const totalSupplyRational = bigRational(totalPairSupplyBigNumber.toString()).divide(bigRational('10').pow(node.pairDecimals));
        const token0Decimals = node.comparatorIsToken1 ? node.tokenDecimals : node.comparatorDecimals;
        const token1Decimals = node.comparatorIsToken1 ? node.comparatorDecimals : node.tokenDecimals;
        const reserve0AsRational = bigRational(reservesBigNumber.reserve0.toString()).divide(bigRational('10').pow(token0Decimals));
        const reserve1AsRational = bigRational(reservesBigNumber.reserve1.toString()).divide(bigRational('10').pow(token1Decimals));
        const reserveTokenRational = node.comparatorIsToken1 ? reserve0AsRational : reserve1AsRational;
        const reserveComparatorRational = node.comparatorIsToken1 ? reserve1AsRational : reserve0AsRational;
        const tokenPerLPRational = reserveTokenRational.divide(totalSupplyRational);
        const comparatorPerLPRational = reserveComparatorRational.divide(totalSupplyRational);

        let liquidityQuantityRational = bigRational(liquidityQuantity);
        if (quantityIsPercentage){
            liquidityQuantityRational = liquidityQuantityRational.divide(100).multiply(balancesRational[node.pairAddress]);
        } 
        for (const quantityLine of quantityDerivationLines){
            win.send({message: quantityLine}, callbackTicket);
        }
        if (quantityIsPercentage){ //otherwise we'd have already outputted final form
            const quantityString = formatRational(liquidityQuantityRational, node.pairDecimals);
            win.send({message: `Liquidity quantity = ${quantityString} ${node.name}`}, callbackTicket);
        }
        if (liquidityQuantityRational.greater(balancesRational[node.pairAddress])){
            throw `Insufficient ${node.name} balance`;
        }
        const liquidityQuantityBigNumber = bigNumber.from(liquidityQuantityRational.multiply(bigRational('10').pow(node.pairDecimals)).toDecimal(0));

        const tokenQuantityRational = liquidityQuantityRational.multiply(tokenPerLPRational);
        const minTokenAmountRational = tokenQuantityRational.minus(tokenQuantityRational.multiply(slippageProportionRational));

        const comparatorQuantityRational = liquidityQuantityRational.multiply(comparatorPerLPRational);
        const minComparatorAmountRational = comparatorQuantityRational.minus(comparatorQuantityRational.multiply(slippageProportionRational));

        await checkAllowance({
            endpointId: endpointNode.id, callbackTicket,
            walletAddress: wallet.address, 
            addressToAllow: exchangeNode.routerAddress, nameToAllow: exchangeNode.name,
            tokenAddress: node.pairAddress, tokenSymbol: node.name, tokenContract: ABI.createPairContract(nonceManagerProvider, node.pairAddress),
            requiredAmount: liquidityQuantityBigNumber,
        });

        const tokenPart = `${formatRational(minTokenAmountRational, node.tokenDecimals)} ${node.tokenSymbol}`;
        const comparatorPart = `${formatRational(minComparatorAmountRational, node.comparatorDecimals)} ${node.comparatorSymbol}`;
        const intentionStatement =  `Splitting ${node.name} into minimum ${tokenPart} and ${comparatorPart} on ${exchangeNode.name}`;
        win.send({message: intentionStatement}, callbackTicket);

        const minTokenQuantityBigNumber = bigNumber.from(minTokenAmountRational.multiply(bigRational('10').pow(node.tokenDecimals)).toDecimal(0));
        const minComparatorQuantityBigNumber = bigNumber.from(minComparatorAmountRational.multiply(bigRational('10').pow(node.comparatorDecimals)).toDecimal(0));

        //finally, remove liquidity
        if (node.comparatorAddress === endpointNode.ethTokenAddress){
            transactionResponse = await sendtransaction(
                endpointJS, routerContract, 'removeLiquidityETH', node.tokenAddress, 
                liquidityQuantityBigNumber, 
                minTokenQuantityBigNumber, minComparatorQuantityBigNumber, 
                wallet.address, deadline, overrides
            );
        } else if (node.tokenAddress === endpointNode.ethTokenAddress){
            transactionResponse = await sendtransaction(
                endpointJS, routerContract, 'removeLiquidityETH', node.comparatorAddress, 
                liquidityQuantityBigNumber, 
                minComparatorQuantityBigNumber, minTokenQuantityBigNumber, 
                wallet.address, deadline, overrides
            );
        } else {
            transactionResponse = await sendtransaction(
                endpointJS, routerContract, 'addLiquidity', node.tokenSymbol, node.comparatorAddress, 
                liquidityQuantityBigNumber, 
                minTokenQuantityBigNumber, minComparatorQuantityBigNumber,
                wallet.address, deadline, overrides
            );
        }
    }


    win.send({message: `Transaction ${transactionResponse.hash} sent - awaiting confirmation...`}, callbackTicket);
    //if it hasn't gone through by 1.5 * timeout, it probably won't
    let transactionReceipt;
    try {   
        transactionReceipt = await waitForTransaction(endpointJS, transactionResponse);
    } catch (error){
        console.log(error);
        throw error;
    }
    win.send({message: 'OK! TX: ' + transactionReceipt.transactionHash}, callbackTicket);

    const balancesAfterForOutput = {};
    const balancesAfterRational = {};
    await Promise.all(Object.keys(addressToDecimals).map(async address => balancesAfterRational[address] = await getBalanceRational(node.id, wallet.address, addressToSymbol[address])));
    for (const address of Object.keys(addressToDecimals)){
        balancesAfterForOutput[addressToSymbol[address]] = formatRational(balancesAfterRational[address], addressToDecimals[address]);
    }
    win.send({message: 'Balances after: ' + JSON.stringify(balancesAfterForOutput)}, callbackTicket);

    return {
        transactionHash: transactionReceipt.transactionHash,
        lpBalanceBefore: (balancesForOutput[node.name]),
        lpBalanceAfter: (balancesAfterForOutput[node.name]),
        tokenBalanceBefore: (balancesForOutput[node.tokenSymbol]),
        tokenBalanceAfter: (balancesAfterForOutput[node.tokenSymbol]),
        comparatorBalanceBefore: (balancesForOutput[node.comparatorSymbol]),
        comparatorBalanceAfter: (balancesAfterForOutput[node.comparatorSymbol]),
    }
}

/*
This is a workaround for https://github.com/ethers-io/ethers.js/issues/945
where tx.wait() hangs if tx is dropped from mempool.
So we also poll for that case (idea thanks to https://github.com/ethers-io/ethers.js/issues/945#issuecomment-1047428066)
*/
async function waitForTransaction(endpointJS, tx){
    let finished = false;
    const result = await Promise.race([
        tx.wait(),
        (async () => {
            while (!finished) {
                await util.waitMs(3000);
                const mempoolTx = await endpointJS.sendOne(endpointJS.provider, 'getTransaction', tx.hash);
                if (!mempoolTx){
                    return null;
                } 
            }
        })()
    ]);
    finished = true;
    if (!result){
        throw `Transaction ${tx.hash} failed`;
    }
    return result;
}

async function checkAllowance({endpointId, walletAddress, addressToAllow, nameToAllow, tokenAddress, tokenSymbol, tokenContract, requiredAmount, callbackTicket}){
    const endpointNode = database.endpoints[endpointId];
    const endpointJS = idToJS[endpointId];
    if (tokenAddress !== endpointNode.ethTokenAddress){//no need for approval to spend native wrapped token
        const approvedAmountBigNumber = await endpointJS.sendOne(tokenContract, 'allowance', walletAddress, addressToAllow);
        if (approvedAmountBigNumber.lt(requiredAmount)){
            win.send({message: `Approving ${tokenSymbol} for router ${nameToAllow} (${addressToAllow})`}, callbackTicket);
            const tx = await endpointJS.sendOne(tokenContract, 'approve', addressToAllow, ethers.constants.MaxUint256);
            try {
                await waitForTransaction(endpointJS, tx);
            } catch (error){
                console.log(error);
                throw error;
            }
            win.send({message: "Router approved"}, callbackTicket);
        }
    }
}



module.exports = {
    create
};
