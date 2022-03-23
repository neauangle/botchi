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

/*
    There shoule be two files, one named <tracker_type>-backend.js and the other named <tracker_type>-frontend.js .
*/


const BACKEND_API = {
    functions: {
        create: {
            return:  {
                emitter: { //we listen by calling emitter.on(event, data)
                    events: {
                        swap: {
                            data: {
                                trackerId: 'string',
                                timestamp: 'seconds',
                                action: 'BUY / SELL / TRADE',
                                tokenAmount: 'string',
                                comparatorAmount: 'string',
                                fiatAmount: 'string or can be falsy',
                                transactionHash: 'string',
                                transactionURL: 'string or can be falsy'
                            }
                        },
                        addTrackerProgress: {
                            data: {
                                message: 'string'
                            }
                        },
                        trackerAdded: {
                            data: {
                                tracker: '{...} (see getTrackersMap return)'
                            }
                        },
                        historyProgress: {
                            data: {
                                p: 'percentage complete'
                            }
                        }
                    }
                },

                init: 'function- read databse in, start listeners etc.',

                call: {//this is the function gateway: call(functionName, args)
                    getTrackersMap: {
                        return: '{id -> {id, name, isActive, tokenSymbol, comparatorSymbol, comparatorIsFiat}, ...}'
                    },
                    getMostRecentPrice: {
                        args: 'trackerId',
                        returns: '{fiat: string, comparator: string}'
                    },
                    addTracker: {
                        args: '{whatever args you need- provided by getArgs in frontend api}',
                    },
                    removeTracker: {
                        args: 'id'
                    },
                    setTrackerOptions: {
                        args: '{tbd. probably at least comparatorIsFiat, isActive, and room for backend-spcific settings}'
                    },
                    getHistoryAllowed: {
                        args: 'trackerId',
                        returns: `whether or not it's okay to request (more) history`
                    },
                    getHistoryMinuteKlines: {
                        args: 'trackerId',
                        returns: `A collection of historic minute klines. It's up to the module to track the range
                            of klines to get and organise them to have open, high, low, close, and utcTime as number types.
                            It's okay to overlap the klines with current klines, but not okay for there to be a gap between
                            oldest current minute kline and newest historic minute kline
                        `
                    }
                }
            }
        }
    }
}




//todo - out of date
const FRONTEND_API = {
    emitter: { //we listen by calling emitter.on(event, data)
        events: {
            updatedDisableds: {
                data: '{addTrackerButtonShouldBeDisabled}'
            }
        }
    },

    addTrackerForm: {
        getArgs: { //function
            return: 'args dict for addTracker function in backend api'
        },
            
        refresh: { //function
            //called on show if selected, and on selected- this is where you pre-populate fields from backend, etc.
        },
        dom: `the dom object form elements for adding tokens of this type. 
              See .add-tracker-backend-section-form in app.css for grid layout`  
    }
}



module.exports = {
    BACKEND_API, FRONTEND_API
};