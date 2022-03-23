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
const EventEmitter = require('events');
const fs = require('fs');
const util = require('./util.js');
const path = require('path');
const cryptoHelper = require("../cryptohelper");

const TYPE = {TRACKER: "TRACKER", API: "API"};
const FIAT_DECIMALS = 8;

let masterKey;

/*
    This is a pseudo-base class for CEX backend

    Call module.processTrade(trackerId, {timestamp: number, price: string, quantity: string}) 
        to process and emit a trade event

    create: function(args)
        moduleName: string
        frontendCall: function(functionName, args)
            Called when the frontend calls `call` and the functionName is unrecognised
        setTrackerOptions function(tracker, options)
            Called when frontend calls `call` where functionName is `setTrackerOptions`
        initAPI: function(apiEntry)
            Called when api entry is created and/or read in from database.
        startAPI: function(apiEntry)
            Called after api entry is read in. We don't just call `startTracker` on all the trackers
            because that would in many cases be inefficient- although you can in turn call startTracker yourself if
            that's the best way to do for that API.
        initTracker: async function(tracker, alreadyConfirmed)
            called when a tracker is created and/or read in from database.
            Return null if the tracker is invalid
        startTracker: function(tracker)
            start listening to tracker. Must set tracker.isActive to true
        stopTracker: function(tracker)
            stop listening to tracker. Must set tracker.isActive to false
        getPrice: async function(tracker)
            get current price in comparator. Return a string.
        getHistoryAllowed: function (tracker)
            returns whether (more) history can be requested for this token
        getHistoryMinuteKlines: function (tracker)
            returns a chunk of historic minute klines 
*/




function create({moduleName, frontendCall, setTrackerOptions, 
initAPI, startAPI, initTracker, startTracker, stopTracker, getPrice,
getHistoryAllowed, getHistoryMinuteKlines}){
    const databaseFilename = path.join(app.getPath("userData"), `/default_user/${moduleName}-token-database.json`);
    let database = { trackers: {}, apiEntries: {} }
    let idToJS = {};
    let idTracker = 0;

        
    async function updateApiDatabase(args){
        const databaseSectionName = 'apiEntries';
        const oldDatabaseSection = JSON.parse(JSON.stringify(database[databaseSectionName]));;
        const {added, edited, removed} = args;

        try {
            let addedInfos = [];
            added.map(addedNode => addedInfos.push(addApiEntry(addedNode, false)));
            edited.map(async editedNode => {
                const node = database[databaseSectionName][editedNode.id];
                for (const key of Object.keys(editedNode)){
                    if (node[key] !== editedNode[key]){
                        node[key] = editedNode[key];
                    }
                }
            });
            for (const removedNode of removed){
                delete database[databaseSectionName][removedNode.id];
            }
            writeDatabase();
            return {success: true, addedInfos};
        } catch (error){
            console.log(error);
            database[databaseSectionName] = oldDatabaseSection;
            return {success: false, error};
        }
    }

    

   function setTrackerOptionsBase(trackerId, options){
        const tracker =  database.trackers[trackerId];
        if (Object.keys(options).includes('isActive')){
            if (tracker.isActive && !options.isActive
            || !tracker.isActive && options.isActive){
                if (options.isActive){
                    startTracker(tracker);
                } else {
                    stopTracker(tracker);
                }
                writeDatabase();
            }
        }
        setTrackerOptions(trackerId, options);
    }

    function removeTracker(trackerId){
        const tracker = database.trackers[trackerId];
        stopTracker(tracker);
        delete database.trackers[trackerId];
        let trackerIds = idToJS[tracker.apiId].tokenSymbolToTrackerIds[tracker.tokenSymbol];
        util.removeArrayItemAll(trackerIds, trackerId);
        if (!trackerIds.length){
            delete idToJS[tracker.apiId].tokenSymbolToTrackerIds[tracker.tokenSymbol];
        }
        writeDatabase();
    }

    
    function getTracker(trackerId){
        if (database.trackers[trackerId]){
            return database.trackers[trackerId];
        }
    }


   async function addTracker({tokenSymbol, comparatorSymbol, comparatorIsFiat, isActive, apiId}){
        const apiEntry = getAPIEntry(apiId);
    
        for (const tracker of Object.values(database.trackers)){
            if (tracker.tokenSymbol === tokenSymbol 
            && tracker.comparatorSymbol === comparatorSymbol
            && database[tracker.apiId] === apiKey){
                return tracker;
            }
        }

        module.emitter.emit('addTrackerProgress', {message: 'Adding tracker...'});
        
        const tracker = {
            type: TYPE.TRACKER,
            id: (idTracker++).toString(),
            apiId: apiEntry.id,
            name: tokenSymbol + '-' + comparatorSymbol,
            tokenSymbol,
            comparatorSymbol,
            comparatorIsFiat,
            isActive:  isActive === undefined ? true :isActive,
            msAtLastPriceUpdate: 0,
        }

        if (!await initTracker(tracker, false)){
            return null;
        }

        database.trackers[tracker.id] = tracker;
        if (!idToJS[tracker.apiId].tokenSymbolToTrackerIds[tracker.tokenSymbol]){
            idToJS[tracker.apiId].tokenSymbolToTrackerIds[tracker.tokenSymbol] = [];
        }
        idToJS[tracker.apiId].tokenSymbolToTrackerIds[tracker.tokenSymbol].push(tracker.id);
        writeDatabase();
    
        addJSComponent(tracker);
    
        if (tracker.isActive){
            startTracker(tracker);
        }
    
        return tracker;
    }
    

    function getAPIEntry(apiId){
        if (database.apiEntries[apiId]){
            return database.apiEntries[apiId];
        }
    }
    function addApiEntry({key, name}, writeToDatabase){
        const entry = {
            type: TYPE.API,
            id: (idTracker++).toString(),
            key,
            name
        }
        initAPI(entry);
        database.apiEntries[entry.id] = entry;
        addJSComponent(entry);
        if (writeToDatabase){
            writeDatabase();
        }
        return entry;
    }
    
    
    function writeDatabase(){
        if (!fs.existsSync(databaseFilename)){
            fs.mkdirSync(path.dirname(databaseFilename), {recursive: true});
        }

        let filestring = JSON.stringify(database, null," ");
        if (masterKey){
            filestring = cryptoHelper.encryptStringAES(filestring, masterKey).cipher;
        }
        fs.writeFileSync(databaseFilename, filestring);
    }
    
    function readDatabase(justReturn=false){
        let readInDatabase
        if (fs.existsSync(databaseFilename)){
            let fileString = fs.readFileSync(databaseFilename).toString('utf-8');
            try {
                if (masterKey){
                    fileString = cryptoHelper.decryptStringAES(fileString, masterKey);
                }
                readInDatabase = JSON.parse(fileString);
            } catch (error){
                console.log(error);
                if (!masterKey){
                    fs.writeFileSync(databaseFilename + Date(), fileString); //backup the faulty file and move on
                }
            }
        }
        
        if (!readInDatabase){
            readInDatabase = { trackers: {}, apiEntries: {} };
        }

        if (justReturn){
            return readInDatabase;
        } else {
            database = readInDatabase;
        }            
     
        //ensure apiIds are added by the time we're adding trackers
        for (const key of ['apiEntries', 'trackers']){
            for (const id of Object.keys(database[key])){
                const node = database[key][id];
                idTracker = Math.max(idTracker, Number(id))+1;
                addJSComponent(node);
                if (node.type === TYPE.TRACKER){
                    initTracker(node, true);
                    if (!idToJS[node.apiId].tokenSymbolToTrackerIds[node.tokenSymbol]){
                        idToJS[node.apiId].tokenSymbolToTrackerIds[node.tokenSymbol] = [];
                    }
                    idToJS[node.apiId].tokenSymbolToTrackerIds[node.tokenSymbol].push(node.id);
                } else {
                    initAPI(node);
                }
            }
        }
    }


    function _getLinkToFiat(trackerId, link){
        const tracker = database.trackers[trackerId];
        if (tracker.comparatorIsFiat){
            link.push(tracker.id);
            return link;
        }
        let uplinkTrackerIds = idToJS[tracker.apiId].tokenSymbolToTrackerIds[tracker.comparatorSymbol];
        if (uplinkTrackerIds){
            for (tId of uplinkTrackerIds){
                let successfulLink = _getLinkToFiat(tId, link);
                if (successfulLink){
                    successfulLink.push(tracker.id);
                    return successfulLink;
                }
            }
        }
        return null;
    }
    function getLinkToFiat(trackerId){
        const link = _getLinkToFiat(trackerId, []);
        if (link){
            link.reverse();
        }
        return link;
    }


    async function updatePrice(trackerId, newPrice){
        const tracker = database.trackers[trackerId];
        const js = idToJS[tracker.id];
        let comparator;
        if (newPrice){
            comparator = newPrice;
        } else {
            if (js.priceIsUpdating){
                const price = await new Promise((resolve, reject) => {
                    module.emitter.once('priceUpdated', function(e) {
                        return resolve(js.mostRecentPrice);
                    })
                });
                if (price){
                    return js.mostRecentPrice;
                }
            }

            comparator = await getPrice(tracker);
            if (!comparator){
                return null;
            }
        }

        js.priceIsUpdating = true;

        const linkToFiat  = getLinkToFiat(tracker.id);
        const currentMs = Date.now();
        let fiat;
        if (linkToFiat){
            fiat = Number(comparator);
            for (let i = 1; i < linkToFiat.length; ++i){
                const uplinkTracker = database.trackers[linkToFiat[i]];
                if (idToJS[uplinkTracker.id].mostRecentPrice.comparator === null
                || currentMs - uplinkTracker.msAtLastPriceUpdate > 30000){
                    if (!database.trackers[uplinkTracker.id]){
                        linkToFiat = null;
                        fiat = null;
                        break;
                    }
                    await updatePrice(uplinkTracker.id);
                }           
                fiat = fiat * Number(idToJS[uplinkTracker.id].mostRecentPrice.comparator);
            }
            fiat = fiat.toFixed(FIAT_DECIMALS);
        }

        tracker.msAtLastPriceUpdate = Date.now();

        js.mostRecentPrice = {comparator, fiat};
        js.priceIsUpdating = false;
        module.emitter.emit('priceUpdated');
        return js.mostRecentPrice;
    }
    
    
    function addJSComponent(node){
        let js;
        if (node.type === TYPE.TRACKER){
            js = {
                mostRecentPrice: {
                    fiat: null,
                    comparator: null,
                },
                priceIsUpdating: false,
                
            }
        } else if (node.type === TYPE.API){
            js = {
                tokenSymbolToTrackerIds: {}
            }
        }
        idToJS[node.id] = js;
        return js;
    }




























    const module = {};
    module.emitter = new EventEmitter();
    module.init = async function(pWin, pmasterKey){
        masterKey = pmasterKey;
        readDatabase(false);
        module.win = pWin;
        for (const apiEntry of Object.values(database.apiEntries)){
            startAPI(apiEntry);
        }
    }
    module.changePassword = function(newMasterKey){
        //const database = readDatabase(true);
        masterKey = newMasterKey;
        writeDatabase(database);
    }
    module.call = function(functionName, args){
        //Base API
        if (functionName === 'getName'){
            return moduleName;
        } else if (functionName === 'writeDatabase'){
            writeDatabase();
        } else if (functionName === 'getTrackersMap'){
            return database.trackers;
        } else if (functionName === 'addTracker'){
            return addTracker(args);
        } else if (functionName === 'removeTracker'){
            return removeTracker(args.id);
        } else if (functionName === 'setTrackerOptions'){
            return setTrackerOptionsBase(args.id, args.options);
        } else if (functionName === 'getMostRecentPrice'){
            if (idToJS[args.id].mostRecentPrice.comparator){
                return idToJS[args.id].mostRecentPrice;
            } else {
                return updatePrice(args.id);
            }
        } else if (functionName === 'getHistoryAllowed'){
            return getHistoryAllowed(database.trackers[args.id]);
        } else if (functionName === 'getHistoryMinuteKlines'){
            return getHistoryMinuteKlines(database.trackers[args.id]);
        }

        //cex-module specific
        if (functionName === 'getAPIsWithTrackers'){
            const ret = [];
            for (const apiEntry of Object.values(database.apiEntries)){
                if (!ret.includes(apiEntry) && Object.values(database.trackers).some(tracker => tracker.apiId === apiEntry.id)){
                    ret.push(apiEntry);
                }
            }
            return ret;
        } else if (functionName === 'getApiEntries'){
            return Object.values(database.apiEntries);
        } else if (functionName === 'addApiEntry'){
            return addApiEntry(args);
        } else if (functionName === 'updateDatabase'){
            return updateApiDatabase(args);
        }

        return frontendCall(functionName, args);
    }


    module.processTrade = function(trackerId, {timestamp, price, quantity}){
        const tracker = database.trackers[trackerId]
        if (!tracker){
            return null;
        }
        const comparatorAmount = (Number(price) * Number(quantity)).toString();
        updatePrice(tracker.id, price);
        let fiatAmount = null;
        if (tracker.comparatorIsFiat){
            fiatAmount = comparatorAmount;
        } else {
            const fiatPer = idToJS[tracker.id].mostRecentPrice.fiat;
            if (fiatPer){
                fiatAmount = (Number(quantity) * fiatPer).toString()
            }
        }
        const trade = {
            trackerId: tracker.id,
            timestamp,
            action: 'TRADE',
            tokenAmount: quantity,
            comparatorAmount,
            fiatAmount, 
            transactionHash: 'N/A',
            transactionURL: null
        }
        module.emitter.emit('swap', trade);
    }

    return module;

}






module.exports = {
    create
};

