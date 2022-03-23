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
import * as Util from './util.js';

export const EVENT = {
    NETWORK_STATUS_CHANGED: 'NETWORK_STATUS_CHANGED', 
};

let isConnected = true; //assume connected at start (emit change if turns to false)
let performChecks  = true;
let timesFailedSuccessively = 0;

export async function beginCheckingNetwork(){
    performChecks = true;
    while (performChecks){
        await Util.wait(10*1000);
        if (!performChecks){
            return;
        }
        const result = await window.bridge.checkNetworkConnectivity({addresses: [
            {ip: '8.8.8.8', port: 53}, //Google DNS
            {ip: '208.67.222.222', port: 53}, //OpenDNS
        ]});
        if (!performChecks){
            return;
        }
        if (result){
            timesFailedSuccessively = 0;
            if (!isConnected){
                isConnected = true;
                emitter.emitEvent(EVENT.NETWORK_STATUS_CHANGED, {isConnected});
            }
        
        } else {
            timesFailedSuccessively += 1;
            if (timesFailedSuccessively >= 3 && isConnected){
                isConnected = false;
                emitter.emitEvent(EVENT.NETWORK_STATUS_CHANGED, {isConnected});
            }
        }
    }
}
