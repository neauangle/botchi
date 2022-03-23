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
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const emitter = new EventEmitter();

const databaseFilename = path.join(app.getPath("userData"), '/default_users/test-token-database.json');
let database = {};
let idTracker = 0;

function create() {
    function writeDatabase(){
        if (!fs.existsSync(databaseFilename)){
            fs.mkdirSync(path.dirname(databaseFilename), {recursive: true});
        }
        fs.writeFileSync(databaseFilename, JSON.stringify(database, null," "));

    }

    return {
        emitter: emitter,
        init: () => {
            if (!fs.existsSync(databaseFilename)){
                return;
            }
            const fileString = fs.readFileSync(databaseFilename).toString('utf-8');
            try {
                database = JSON.parse(fileString);
            } catch (error){
                console.log(error);
                fs.writeFileSync(databaseFilename + Date(), fileString); //backup the faulty file and move on
            }
            if (!database){
                database = { };
            }
            for (const id of Object.keys(database)){
                if (id > idTracker){
                    idTracker = id + 1;
                }
            }

        },
        changePassword: function(newMasterKey){
            return;
        },
        call: (functionName, args) => {
            if (functionName === 'getName'){
                return "test";
            } else if (functionName === 'getTrackersMap'){
                return database;
            } else if (functionName === 'addTracker'){
                const id = (idTracker++).toString();
                database[id] = {
                    id: id,
                    name: "BASE-QUOTE",
                    isActive: true,
                    tokenSymbol: "BASE",
                    comparatorSymbol: "QUOTE",
                    comparatorIsFiat: false,
                    comparatorPerFiat: args.comparatorPerFiat
                }
                writeDatabase()
                return database[id];
            } else if (functionName === 'removeTracker'){
                delete database[args.id];
                writeDatabase();
            } else if (functionName === 'setTrackerOptions'){
                if (Object.keys(args.options).includes('isActive')){
                    database[args.id].isActive = args.options['isActive'];
                   writeDatabase();
                }
                
            } else if (functionName === 'getMostRecentPrice'){
                return {comparator: '1', fiat: (database[args.id].comparatorPerFiat).toString()}
            } else if (functionName === 'getHistoryAllowed'){
                return false;
            } else if (functionName === 'getHistoryMinuteKlines'){
                
            }
        }
    }
}


module.exports = {
    create
};




