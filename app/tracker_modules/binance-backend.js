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

const cexModule = require('./cex-backend-module');
const crypto = require('crypto')
const {Spot} = require('@binance/connector');
const binanceAPIBase = require('@binance/connector/src/APIBase.js');
const binanceUtils = require('@binance/connector/src/helpers/utils.js');
const util = require('./util.js');
const bigRational = require("big-rational");
const fetch = require('node-fetch');

const apiIdToStuff = {};
const trackerIdToStuff = {};


//a single connection to stream.binance.com is only valid for 24 hours; expect to be disconnected at the 24 hour mark
function resetConnection(apiId){
    const stuff = apiIdToStuff[apiId];
    if (stuff){
        stuff.restartListener();
    }
}




function create(){
    let module;
    module = cexModule.create({
        moduleName: 'binance',
        frontendCall: async function(functionName, args){
            if (functionName === 'swap'){
                return swap(module.win, args);
            } else if (functionName === 'getPairBalances'){
                const tracker = module.call('getTrackersMap')[args.id]
                return getPairBalances(module.win, tracker, args);
            } else if (functionName === 'getBalance'){
                return getBalance(module.win, args);
            } else if (functionName === 'withdraw'){
                return withdraw(module.win, args);
            } else if (functionName === 'awaitDepositOrWithdraw'){
                return awaitDepositOrWithdraw(module.win, args);
            } else if (functionName === 'generalQuery'){
                return generalQuery(module.win, args);
            } else if (functionName === 'getCoingeckoCoins'){
               return (await fetch('https://api.coingecko.com/api/v3/coins/')).json();
            } else if (functionName === 'updateCoingeckoId'){
                const tracker = module.call('getTrackersMap')[args.id];
                tracker.coingeckoId = args.coingeckoId;
                module.call('writeDatabase');
            }
        },
        setTrackerOptions: function(trackerId, options){

        },
        initAPI: function(apiEntry){
            const stuff = {
                client: new Spot(apiEntry.key, apiEntry.secret ? apiEntry.secret : ''),
                wsRef: null,
                tokenSymbolToTrackerIds: {},
                resetConnectionTimeout: null,
            };
            apiIdToStuff[apiEntry.id] = stuff;
            stuff.stopListener = function() {
                if (stuff.wsRef){
                    stuff.client.unsubscribe(stuff.wsRef);
                }
            }
            stuff.restartListener = function() {
                if (stuff.wsRef){
                    stuff.client.unsubscribe(stuff.wsRef);
                }
                stuff.wsRef = null;
                const streamNameToTrackerId = {};
                for (const tracker of Object.values(module.call('getTrackersMap'))){
                    if (tracker.apiId === apiEntry.id && tracker.isActive){
                        streamNameToTrackerId[trackerIdToStuff[tracker.id].streamName] = tracker.id;
                    }
                }
                const streamNames = Object.keys(streamNameToTrackerId);
                if (streamNames.length){
                    stuff.wsRef = stuff.client.combinedStreams(streamNames, {
                        open: () => {
                            stuff.client.logger.debug('open');
                        },
                        close: () => stuff.client.logger.debug('closed'),
                        message: async message => {
                            message = JSON.parse(message);
                            const streamName = message.stream;
                            if (message.data.e === 'trade'){
                                const trackerId = streamNameToTrackerId[streamName];
                                const timestamp = Math.round(message.data.T / 1000);
                                if (trackerIdToStuff[trackerId].oldestTradeTimestamp === null){
                                    trackerIdToStuff[trackerId].oldestTradeTimestamp = timestamp;
                                    console.log(`Set to ${util.getTimeString(new Date(timestamp*1000))}`);
                                }
                                const price = message.data.p;
                                const quantity = message.data.q;
                                module.processTrade(trackerId, {timestamp, price, quantity});
                            }  
                            
                        }
                    });
                    if (stuff.resetConnectionTimeout){
                        clearTimeout(stuff.resetConnectionTimeout);
                    }
                    stuff.resetConnectionTimeout = setTimeout(resetConnection, 23 * 60 * 60 * 1000, apiEntry.id);
                }
            }
        },
        startAPI: function(apiEntry){
            apiIdToStuff[apiEntry.id].restartListener();
        },
        initTracker: async function(tracker, alreadyConfirmed){
            const stuff = apiIdToStuff[tracker.apiId];
            const ticker = tracker.tokenSymbol.toUpperCase() + tracker.comparatorSymbol.toUpperCase();
            if (!alreadyConfirmed){
                //check whether the ticker exists- could use anything
                const avgPrice = await stuff.client.avgPrice(ticker);
            }
            trackerIdToStuff[tracker.id] = {
                streamName: `${tracker.tokenSymbol.toLowerCase()}${tracker.comparatorSymbol.toLowerCase()}@trade`,
                ticker,
                isRetreivingHistory: false,
                oldestTradeTimestamp: null
            }

            return true;
            
        },
        startTracker: function(tracker){
            tracker.isActive = true;
            apiIdToStuff[tracker.apiId].restartListener();
        },
        stopTracker(tracker){
            tracker.isActive = false;
            apiIdToStuff[tracker.apiId].restartListener();
        },
        getPrice: async function(tracker){
            const response = await  apiIdToStuff[tracker.apiId].client.tickerPrice(trackerIdToStuff[tracker.id].ticker);
            return response.data.price;
        },

        getHistoryAllowed: function(tracker){
            return ! trackerIdToStuff[tracker.id].isRetreivingHistory;
        },
        getHistoryMinuteKlines: async function(tracker){

            trackerIdToStuff[tracker.id].isRetreivingHistory = true;
            const options = {limit: 1000};
            if (trackerIdToStuff[tracker.id].oldestTradeTimestamp !== null){
                options.endTime = (trackerIdToStuff[tracker.id].oldestTradeTimestamp + 360) * 1000 ; //3 minute overlap buffer
                console.log(`Requested to ${util.getTimeString(new Date(options.endTime))}`);
            } else {
                console.log(`Requested to ${util.getTimeString(new Date())}`);
            }

            try {
                const response = await apiIdToStuff[tracker.apiId].client.klines(
                    trackerIdToStuff[tracker.id].ticker, '1m', options
                );
                const klineArrays = response.data;
                const klineObjects = [];
                for (const klineArray of klineArrays){
                    klineObjects.push({
                        utcTime: klineArray[0] / 1000,
                        open: Number(klineArray[1]),
                        high: Number(klineArray[2]),
                        low: Number(klineArray[3]),
                        close: Number(klineArray[4]),
                        volume: Number(klineArray[5])
                    })
                }
                if (klineObjects.length){
                    console.log(`Received from ${util.getTimeString(new Date(klineObjects[0].utcTime * 1000))} to ${
                        util.getTimeString(new Date(klineObjects[klineObjects.length-1].utcTime * 1000))
                    }`);
                    trackerIdToStuff[tracker.id].oldestTradeTimestamp = klineObjects[0].utcTime
                }
                trackerIdToStuff[tracker.id].isRetreivingHistory = false;
                return klineObjects;
            } catch (error){
                trackerIdToStuff[tracker.id].isRetreivingHistory = false;
                throwError(error, 'klines');
            }
            
        }
    });   



    return module;
}

function throwError(error, func){
    console.log(error);
    throw `${func ? 'Calling '+func+'(): ' : ''}${JSON.stringify(error && error.response && error.response.data ? error.response.data : (error && error.message ? error.message : error))}`;
}


async function awaitDepositOrWithdraw(win, args){
    const type = args.type;
    const isTestnet = false;
    const callbackTicket = args.callbackTicket;
    const apiKey = args.apiKey;
    const secretKey = args.secretKey;
    const filter = args.filter;
    const intervalMS = args.intervalMS ? args.intervalMS : 5000;
    const timeoutMS = Number(args.timeoutSecs) * 1000;
    const msAtStart = new Date().getTime();

    win.send({message: `Waiting for ${type} with filter: ${JSON.stringify(filter)} to complete...`}, callbackTicket);
    let legendString;
    if (type === 'Deposit'){
        legendString = `STATUS LEGEND: 0:pending, 6:credited but cannot withdraw, 1:success`;
    } else {
        legendString = `STATUS LEGEND: 0:Email Sent, 1:Cancelled, 2:Awaiting Approval, 3:Rejected, 4:Processing, 5:Failure, 6:Completed`;
    }
    win.send({message: legendString}, callbackTicket);

    let lastStatus;
    let lastTransactionHash; 
    while (new Date().getTime() - msAtStart < timeoutMS){
        const client = new Spot(apiKey, secretKey, { baseURL: isTestnet ? 'https://testnet.binance.vision' : undefined });
        const transactionInfos = (await (type === 'Deposit' ? client.depositHistory({limit: 20}) : client.withdrawHistory({limit: 20}))).data;
        let matchingTransactionInfo;
        for (const transactionInfo of transactionInfos){
            if (!Object.keys(filter).some(key => {
                if (typeof filter[key] === 'string' && typeof transactionInfo[key] === 'string'){
                    return filter[key].toLowerCase() !== transactionInfo[key].toLowerCase();
                } else {
                    return filter[key] !== transactionInfo[key];
                }
            })){
                matchingTransactionInfo = transactionInfo;
                break;
            }
        }
        
        if (matchingTransactionInfo){
            if (lastStatus !== matchingTransactionInfo.status || lastTransactionHash !== matchingTransactionInfo.txId){
                lastStatus = matchingTransactionInfo.status;
                lastTransactionHash = matchingTransactionInfo.txId;
                const info = {
                    id: matchingTransactionInfo.id,
                    status: lastStatus,
                    txId: lastTransactionHash,
                }
                win.send({message: `Update: ${JSON.stringify(info)}`}, callbackTicket);
            }
            
            
            if (type === 'Withdraw'){
                if (matchingTransactionInfo.status === 6){
                    win.send({message: `Withdraw success!`}, callbackTicket);
                    return matchingTransactionInfo;
                } else if (matchingTransactionInfo.status === 5 
                || matchingTransactionInfo.status === 3 
                ||matchingTransactionInfo.status === 1){
                    throwError(`Withdrawal failed, rejected or cancelled`);
                }
            } else {
              if (matchingTransactionInfo.status === 1){
                    win.send({message: `Deposit success!`}, callbackTicket);
                    return matchingTransactionInfo;
                }
            }
        }
            
        await util.waitMs(intervalMS);
    }
    throwError(`Timeout!`);
}




//if network is undefined, resolves to default network of coin
//you can find all that info here: sapi/v1/capital/config/getall
async function withdraw(win, {apiKey, secretKey, isTestnet,
network, tokenSymbol, walletAddress, quantity, quantityIsPercentage, quantityDerivationLines,
awaitUntilComplete, awaitWithdrawTimeoutSecs, callbackTicket}){
    const formatRational = util.formatRational;
   
    const client = new Spot(apiKey, secretKey, { baseURL: isTestnet ? 'https://testnet.binance.vision' : undefined });

    const basePrecision = 10;
    let accountInfo;
    try {
        accountInfo = (await client.account()).data;
    } catch (error) {
        throwError(error, `account`);
    }
    const canWithdraw = accountInfo.canWithdraw;
    if (!canWithdraw){
        throwError( 'API restricted (withdraws disallowed)');
    }

    let balanceOfTokenRational = bigRational(0);
    for (const balance of accountInfo.balances){
        if (balance.asset === tokenSymbol){
            balanceOfTokenRational = bigRational(balance.free);
        }
    }
    win.send({message: `Balance before: ${formatRational(balanceOfTokenRational, basePrecision)} ${tokenSymbol}`}, callbackTicket);

    let exactQuantityRational = bigRational(quantity);
    if (quantityIsPercentage){
        exactQuantityRational = exactQuantityRational.divide(100).multiply(balanceOfTokenRational);
    }
    const exactQuantityString = formatRational(exactQuantityRational, basePrecision);
    for (const line of quantityDerivationLines){
        win.send({message: line}, callbackTicket);
    }
    if (quantityIsPercentage){//otherwise we'd have already outputted it in the derivation lines
        win.send({message: `Quantity = ${exactQuantityString} ${tokenSymbol}`}, callbackTicket);
    }

    if (network){
        win.send({message: `Sending ${exactQuantityString} ${tokenSymbol} to ${network}...`}, callbackTicket);
    } else {
        win.send({message: `Sending ${exactQuantityString} ${tokenSymbol} to default network...`}, callbackTicket);
    }

    let result;
    try {
        result = (await client.withdraw(tokenSymbol, walletAddress, Number(exactQuantityString), { network })).data;
    } catch (error){
        throwError(error, `withdraw`);
    }

    win.send({message: `Transaction sent successfully!`}, callbackTicket);

    //for most people, this would be the latest withdraw, but you never know- someone could be sending withdraws like crazy
    //so we get the last 10 just to be heaps surer.
    let withdrawInfo;
    console.log('result id', result.id);
    while (!withdrawInfo && awaitWithdrawTimeoutSecs > 0){
        console.log('time left', awaitWithdrawTimeoutSecs);
        const tokenWithdraws = (await client.withdrawHistory({coin: tokenSymbol, limit: 10})).data;
        for (const tokenWithdraw of tokenWithdraws){
            console.log(tokenWithdraw.id);
            if (tokenWithdraw.id === result.id){
                withdrawInfo = tokenWithdraw;
                break;
            }
        }
        if (!withdrawInfo && awaitWithdrawTimeoutSecs > 0){
            await util.waitMs(4 * 1000);
            awaitWithdrawTimeoutSecs -= 4;
        }
    }
    if (!withdrawInfo){
        throwError(`Invalid withdraw id ${result.id}... (this shouldn't happen)`, 'withdrawHistory');
    }

    if (awaitUntilComplete){
        if (!withdrawInfo.id){
            throwError( `No id given for withdrawal- cannot wait on it (this shouldn't happen)`, 'withdrawHistory');
        }
        if (withdrawInfo.status === 6){
            win.send({message: `Withdraw success!`}, callbackTicket);
            return withdrawInfo;
        } else if (withdrawInfo.status === 5 
        || withdrawInfo.status === 3 
        ||withdrawInfo.status === 1){
            throwError(`Withdrawal failed, rejected or cancelled`);
        } else {
            withdrawInfo = await awaitDepositOrWithdraw(win, {
                apiKey,
                secretKey,
                callbackTicket,
                timeoutSecs: awaitWithdrawTimeoutSecs,
                type: 'Withdraw',
                filter: {id: withdrawInfo.id}
            });
        }
    } else {
        win.send({message: `Info: ${JSON.stringify(withdrawInfo)}`}, callbackTicket);
    }
    
    try {
        accountInfo = (await client.account()).data;
    } catch (error){
        throwError(error, 'account');
    }
    balanceOfTokenRational = bigRational(0);
    for (const balance of accountInfo.balances){
        if (balance.asset === tokenSymbol){
            balanceOfTokenRational = bigRational(balance.free);
        }
    }
    win.send({message: `Balance after: ${formatRational(balanceOfTokenRational, basePrecision)} ${tokenSymbol}`}, callbackTicket);
    
    return withdrawInfo;

}




async function generalQuery(win, args){
    const callbackTicket = args.callbackTicket;
    const apiKey = args.apiKey;
    const secretKey = args.secretKey;
    
    const isTestnet = args.isTestnet;
    let baseURL = isTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
    if (isTestnet && win){
        win.send({message: '~ Querying testnet ~'}, callbackTicket);
    }
    let queryString = args.query;
    if (!queryString.startsWith('/')){
        queryString = '/' + queryString;
    }
    const url = new URL(`${baseURL}${queryString}`);
    const params = {};
    for (const param of url.searchParams.keys()){
        params[param] = url.searchParams.get(param);
    }
    const binanceApi = new binanceAPIBase({apiKey, apiSecret:secretKey, baseURL});
    if (win){
        win.send({message: 'Sending query...'}, callbackTicket);
    }
    let data;
    try {
        if (!apiKey){
            data = await (await fetch(url.href)).json(); 
            //result = await binanceApi.publicRequest('GET', baseURL + url.pathname, params);
        } else {
            const result = await binanceApi.signRequest('GET', baseURL + url.pathname, params);
            data = result.data;
        }
    } catch (error){
        throwError(error, 'generalQuery');
    }
    
    //if (win){
        //win.send({message: 'Response: ' + JSON.stringify(data)}, callbackTicket);
    //}
    return data;
}



async function getBalance(win, args){
    const callbackTicket = args.callbackTicket;
    const tokenSymbol = args.tokenSymbol;
    const formatRational = util.formatRational;
    const apiKey = args.apiKey;
    const secretKey = args.secretKey;
    const isTestnet = args.isTestnet;
    if (isTestnet){
        win.send({message: '~ This is a test ~'}, callbackTicket);
    }
    win.send({message: `Retreiving ${tokenSymbol} balance...`}, callbackTicket);
    const client = new Spot(apiKey, secretKey, { baseURL: isTestnet ? 'https://testnet.binance.vision' : undefined });
    let accountInfo;
    try {
        accountInfo = (await client.account()).data;
    } catch (error){
        throwError(error, 'account');
    }

    let tokenBalanceRational = bigRational(0);
    for (const balance of accountInfo.balances){
        if (balance.asset === tokenSymbol){
            tokenBalanceRational = bigRational(balance.free);
            break;
        }
    }

    const balanceForOutput = formatRational(tokenBalanceRational, 10);
    console.log(tokenSymbol, balanceForOutput, `${tokenSymbol}: ${balanceForOutput}`);
    win.send({message: `${tokenSymbol}: ${balanceForOutput}`}, callbackTicket);
  
    return balanceForOutput;
}


async function getPairBalances(win, tracker, args){
    const tokenSymbol = tracker.tokenSymbol;
    const comparatorSymbol = tracker.comparatorSymbol;
    const ticker = trackerIdToStuff[tracker.id].ticker;
    const callbackTicket = args.callbackTicket;
    const formatRational = util.formatRational;
    const apiKey = args.apiKey;
    const secretKey = args.secretKey;
    const isTestnet = args.isTestnet;
    if (isTestnet){
        win.send({message: '~ This is a test ~'}, callbackTicket);
    }
    win.send({message: 'Retreiving balance...'}, callbackTicket);
    const client = new Spot(apiKey, secretKey, { baseURL: isTestnet ? 'https://testnet.binance.vision' : undefined });
    let pairExchangeParameters;
    try {
        pairExchangeParameters = (await client.exchangeInfo({ symbol: ticker })).data.symbols[0];
    } catch (error){
        throwError(error, 'exchangeInfo');
    }
    const quotePrecision = pairExchangeParameters.quotePrecision;
    const basePrecision = pairExchangeParameters.basePrecision;
    let accountInfo;
    try {
        accountInfo = (await client.account()).data;
    } catch (error){
        throwError(error, 'account');
    }

    const balancesBefore = accountInfo.balances;
    let balanceOfBase = bigRational(0);
    let balanceOfQuote = bigRational(0);;
    for (const balance of balancesBefore){
        if (balance.asset === tokenSymbol){
            balanceOfBase = bigRational(balance.free);
        } else if (balance.asset === comparatorSymbol){
            balanceOfQuote = bigRational(balance.free);
        }
    }
    const balancesOutput = {[comparatorSymbol]: formatRational(balanceOfQuote, quotePrecision), [tokenSymbol]: formatRational(balanceOfBase, basePrecision)};
    [tokenSymbol, comparatorSymbol].map(symbol => win.send({message: `${symbol}: ${balancesOutput[symbol]}`}, callbackTicket));
    return balancesOutput;
}



async function swap(win, {callbackTicket, apiKey, secretKey, isTestnet, type, order, timeInForce, 
base, quote, specifyingExactOf, currentMarketPrice,
quantity, quantityDerivationLines, quantityIsPercentage, 
limitPrice, limitPriceDerivationLines}){
    const formatRational = util.formatRational;
    const ticker = `${base}${quote}`.toUpperCase();
    const isBuy = type === 'Buy';
    const isLimitOrder = order === 'Limit';
    const unspecified = specifyingExactOf === quote ? base : quote;

    if (isTestnet){
        win.send({message: '~ This is a test transaction ~'}, callbackTicket);
    }
    const client = new Spot(apiKey, secretKey, { baseURL: isTestnet ? 'https://testnet.binance.vision' : undefined });
    let pairExchangeParameters;
    try {
        pairExchangeParameters = (await client.exchangeInfo({ symbol: ticker })).data.symbols[0];
    } catch (error){
        throwError(error, 'exchangeInfo');
    }
    const precisions = {
        [base]: pairExchangeParameters.basePrecision,
        [quote]: pairExchangeParameters.quotePrecision
    }
    const filters = (() => {
        const filters = {};
        for (const filter of pairExchangeParameters.filters){
            filters[filter.filterType] = filter;
        }
        return filters;
    })();

    let accountInfo;
    try {
        accountInfo = (await client.account()).data;
    } catch (error){
        throwError(error, 'account');
    }
    if (!accountInfo.canTrade){
        throwError(`Error: API restricted (trades disallowed)`);
    }

    const balancesBefore = accountInfo.balances;
    let balancesRational = {
        [base]: bigRational(0),
        [quote]: bigRational(0)
    }
    for (const balance of balancesBefore){
        if (balancesRational[balance.asset]){
            balancesRational[balance.asset] = bigRational(balance.free);
        }
    }
    let balancesForOutput = {};
    for (const symbol of [base, quote]){
        balancesForOutput[symbol] = Number(formatRational(balancesRational[symbol], precisions[symbol]));
    } 
    win.send({message: 'Balances before: ' + JSON.stringify(balancesForOutput)}, callbackTicket);

    let quantityKey = specifyingExactOf === quote ? 'quoteOrderQty' : 'quantity';
    let exactQuantityRational = bigRational(quantity);
    let marketOrderStatement;
    if (isLimitOrder){
        exactSymbol = base;
        if (quantityIsPercentage){
            exactQuantityRational = exactQuantityRational.divide(100).multiply(balancesRational[base]);
        }
    } else {
        if (quantityIsPercentage){
            exactQuantityRational = exactQuantityRational.divide(100).multiply(balancesRational[specifyingExactOf]);
        }
        console.log(isBuy, specifyingExactOf, base, quote, isBuy && specifyingExactOf === quote)
        if (isBuy && specifyingExactOf === quote || !isBuy && specifyingExactOf === base){
            marketOrderStatement = `Swap exactly {{quantity}} ${specifyingExactOf} for as many ${unspecified} as possible`;
        } else if (isBuy && specifyingExactOf === base || !isBuy && specifyingExactOf === quote){
            marketOrderStatement = `Swap as many ${unspecified} as necessary for exactly {{quantity}} ${specifyingExactOf}`;
        }
    }

    for (const line of quantityDerivationLines){
        win.send({message: line}, callbackTicket);
    }
    let exactQuantityString = formatRational(exactQuantityRational, precisions[specifyingExactOf]);
    if (quantityIsPercentage){//otherwise we'd have already outputted it in the derivation lines
        win.send({message: `Quantity = ${exactQuantityString} ${specifyingExactOf}`}, callbackTicket);
    }
    if (filters.LOT_SIZE){
        const lotFilter = filters.LOT_SIZE;
        const quantity = bigRational(exactQuantityString);
        const minQty = bigRational(lotFilter.minQty);
        const stepSize = bigRational(lotFilter.stepSize);
        let quantityOverMin = quantity.minus(minQty);
        if (!stepSize.isZero() && !minQty.isZero()){
            const mod = (quantityOverMin.mod(stepSize));
             if (!mod.isZero()){
                exactQuantityString = minQty.add(stepSize.multiply(quantityOverMin.divide(stepSize).floor())).toDecimal(precisions[specifyingExactOf]);
                exactQuantityRational = bigRational(exactQuantityString);
                const lotFixMessage = `(Quantity is not ${minQty.toDecimal(precisions[specifyingExactOf])} + a multiple of ${stepSize.toDecimal(precisions[specifyingExactOf])}. Floored down to ${exactQuantityString})`;
                win.send({message: lotFixMessage}, callbackTicket);
            }
        }
    }

    if (isLimitOrder){
        for (const line of limitPriceDerivationLines){
            win.send({message: line}, callbackTicket);
        }
        if (filters.PRICE_FILTER){
            const priceFilter = filters.PRICE_FILTER;
            const price = bigRational(limitPrice);
            const minPrice = bigRational(priceFilter.minPrice);
            const tickSize = bigRational(priceFilter.tickSize);
            let priceOverMin = price.minus(minPrice);
            if (!tickSize.isZero() && !minPrice.isZero()){
                const mod = (priceOverMin.mod(tickSize));
                if (!mod.isZero()){
                    limitPrice = minPrice.add(tickSize.multiply(priceOverMin.divide(tickSize).floor())).toDecimal(precisions[quote]);
                    const priceFixMessage = `(Price is not ${minPrice.toDecimal(precisions[quote])} + a multiple of ${tickSize.toDecimal(precisions[quote])}. Floored down to ${limitPrice})`;
                    win.send({message: priceFixMessage}, callbackTicket);
                }
            }
        }

        const extremeComparatorRational = bigRational(limitPrice).multiply(exactQuantityRational);
        const extremeComparatorString = formatRational(extremeComparatorRational, precisions[quote]);
        const extreme = (isBuy ? 'for at most ' : 'for at least ') + `${extremeComparatorString} ${quote}`;
        const intentionStatement = `Limit order: ${type} ${exactQuantityString} ${base} ${extreme} (price = ${limitPrice} ${quote}/${base})`
        win.send({message: intentionStatement}, callbackTicket);
        if (isBuy && extremeComparatorRational.greater(balancesRational[quote])){
            throwError(`Error: Insufficient ${quote} balance`);
        } else if (!isBuy && exactQuantityRational.greater(balancesRational[base])){
            throwError(`Error: Insufficient ${base} balance`);
        }

    } else {
        marketOrderStatement = marketOrderStatement.replace('{{quantity}}', exactQuantityString);
        win.send({message: `Market order: ${marketOrderStatement}`}, callbackTicket);
        if (isBuy && specifyingExactOf === quote && exactQuantityRational.greater(balancesRational[quote])){
            throwError(`Error: Insufficient ${quote} balance`);
        } else if (!isBuy && specifyingExactOf === base && exactQuantityRational.greater(balancesRational[base])){
            throwError(`Error: Insufficient ${base} balance`);
        } else {
            //we could estimate whether user is over-reaching but we don't know the what the execution price will actually be...
        }
    }

    let filterError;
    for (const filter of Object.values(filters)){
        if (isLimitOrder && filter.filterType === 'PRICE_FILTER'){
            const price = Number(limitPrice) ;
            const minPrice = Number(filter.minPrice);
            const maxPrice = Number(filter.maxPrice);
            if (minPrice !== 0 && price < minPrice){
                filterError = `${filter.filterType}: Price is less than min price (${minPrice})`;
                break;
            }
            if (maxPrice !== 0 && price > maxPrice){
                filterError = `${filter.filterType}: Price is greater than max price (${maxPrice})`;
                break;
            }
        } else if (isLimitOrder && filter.filterType === 'LOT_SIZE' 
        || !isLimitOrder && quantityKey === 'quantity' && filter.filterType === 'MARKET_LOT_SIZE'){
            const quantity = Number(exactQuantityString);
            const minQty = Number(filter.minQty);
            const maxQty = Number(filter.maxQty);
            if (minQty !== 0 && quantity < minQty){
                filterError = `${filter.filterType}: Quantity is less than min quantity (${minQty})`;
                break;
            }
            if (maxQty !== 0 && quantity > maxQty){
                filterError = `${filter.filterType}: Quantity is greater than max quantity (${maxQty})`;
                break;
            }
        } else if (isLimitOrder && filter.filterType === 'MIN_NOTIONAL'){
            const minNotional = Number(filter.minNotional);
            const price = Number(limitPrice);
            if (price * Number(exactQuantityString) < minNotional){
                filterError = `${filter.filterType}: Price * quantity (${limitPrice} * ${exactQuantityString}) is less than ${minNotional})`;
                break;
            }
        } else if (!isLimitOrder && filter.applyToMarket && filter.filterType === 'MIN_NOTIONAL'
        && specifyingExactOf === base){
            const minNotional = Number(filter.minNotional);
            const price = Number(currentMarketPrice);
            console.log('price',price )
            if (price * Number(exactQuantityString) < minNotional){
                filterError = `${filter.filterType}: Price * quantity (${price} * ${exactQuantityString}) is less than ${minNotional})`;
                break;
            }
        } else if (isLimitOrder && filter.filterType === 'PERCENT_PRICE'){
            const averagePrice = (await client.avgPrice(ticker)).data.price;
            const min = Number(filter.multiplierDown) * averagePrice;
            const max = Number(filter.multiplierUp) * averagePrice;
            const limitPriceNum = Number(limitPrice);
            if (limitPriceNum < min){
                filterError = `${filter.filterType}: Price is less than ${min} (Avg = ${averagePrice}, multiplier = ${filter.multiplierDown})`;
                break;
            } else if (limitPriceNum > max){
                filterError = `${filter.filterType}: Price is greater than ${max} (Avg = ${averagePrice}, multiplier = ${filter.multiplierUp})`;
                break;
            }
        }
    }
    if (filterError){
        throwError('Filter error: ' + filterError);
    }

    const orderArgs = {
        [quantityKey]: exactQuantityString,
        newOrderRespType: 'RESULT'
    };
    if (isLimitOrder){
        orderArgs.timeInForce = timeInForce;
        orderArgs.price = Number(limitPrice);
    } 

    let response;
    try {
        response = (await client.newOrder(ticker, type.toUpperCase(), order.toUpperCase(), orderArgs)).data;
        const orderId = response.orderId;
        if (isLimitOrder){
            win.send({message: `Order ${orderId} placed!`}, callbackTicket);
        } else {
            const summary = `Order ${orderId}: Filled ${response.executedQty} ${base} (${response.cummulativeQuoteQty} ${quote})`;
            let averagePrice = '0';
            const executedQtyRational = bigRational(response.executedQty);
            if (executedQtyRational.greater(0)){
                averagePrice = formatRational(bigRational(response.cummulativeQuoteQty).divide(executedQtyRational), precisions[quote]);
            }
            win.send({message: summary}, callbackTicket);
            win.send({message: `Average Price: ${averagePrice} ${quote}`}, callbackTicket);
            response.averagePrice = averagePrice;
            response.tokenAmountIn = !isBuy ? response.executedQty : '0';
            response.tokenAmountOut = isBuy ? response.executedQty : '0';
            response.comparatorAmountIn = isBuy ? response.cummulativeQuoteQty : '0';
            response.comparatorAmountOut = !isBuy ? response.cummulativeQuoteQty : '0';
        }
    } catch (error){
        throwError(error, 'newOrder');
    }

    let balancesAfter;
    try {
        balancesAfter = (await client.account()).data.balances;
    } catch (error) {
        throwError(error, 'account');
    }
    balancesRational = {
        [base]: bigRational(0),
        [quote]: bigRational(0)
    }
    for (const balance of balancesAfter){
        if (balancesRational[balance.asset]){
            balancesRational[balance.asset] = bigRational(balance.free);
        }
    }
    for (const symbol of [base, quote]){
        balancesForOutput[symbol] = Number(formatRational(balancesRational[symbol], precisions[symbol]));
    } 
    win.send({message: 'Balances after: ' + JSON.stringify(balancesForOutput)}, callbackTicket);

    return response;

}

























module.exports = {
    create
};

