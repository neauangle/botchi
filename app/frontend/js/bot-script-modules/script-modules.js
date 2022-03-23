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

import * as ScriptModuleCommon from './script-module-common.js'; export {ScriptModuleCommon};
import * as Prompt from '../prompt.js';
import * as Util from '../util.js'; export {Util};

const BUILTIN_MODULE_FILEPATHS = [
    './start.js',
    './end.js',
    './await-rise.js',
    './await-fall.js',
    './await-rise-then-fall.js',
    './await-fall-then-rise.js',
    './technical-analysis.js',
    './child-process.js',
    './go-to.js',
    './email.js',
    './write-file.js',
    './statements.js',
    './ethers-balance.js',
    './ethers-swap.js',
    './ethers-transfer.js',
    './ethers-call.js',
    './ethers-liquidity.js',
    './ethers-event.js',
    './binance-balance.js',
    './binance-swap.js',
    './binance-wait.js',
    './binance-withdraw.js',
    './binance-query.js',
    './timer.js',
    './spawn-bot.js',
    './await-candle.js',
    './throw-error.js',
    './user-input.js',
    './random-number.js',
];

export const TYPES = {};
export const modules = {};
const typeToInfo = {};

const initBuiltinsPromise = Promise.all(BUILTIN_MODULE_FILEPATHS.map(async filePath => {
    const module = await import(filePath); 
    module.init(ScriptModuleCommon);
    TYPES[module.NAME] = module.NAME
    modules[module.NAME] = module;
    typeToInfo[module.NAME] = {plugin: false};
}))

export function isPlugin(type){
    return typeToInfo[type].isPlugin;
}
 

export async function init(plugins){
    await initBuiltinsPromise;
    
    const pluginsWithNewHash = [];
    let someNewHashesAccepted = false;
    for (const plugin of plugins){
        if (plugin.newHash){
            pluginsWithNewHash.push(plugin);
        }
    }
    if (pluginsWithNewHash.length){
        await Prompt.showMessage({
            title: "New Plugins Detected", 
            message: "You will be presented with the source code of the new plugins and you can decide whether to accept/reject them here. Be very careful about which plugins you use- they have exactly as much access and power as the built-in modules."
        });
        for (const plugin of pluginsWithNewHash){
            const result = await Prompt.showBigTextArea({
                title: plugin.basename, 
                noCancel: false,
                okButtonText: "Accept", 
                cancelButtonText: "Reject",
                readonly: true, 
                text: plugin.sourceCode
            });
            if (result.okay){
                someNewHashesAccepted= true;
                await Prompt.showMessage({title: 'Plugin Accepted', message: 'This plugin will be trusted until the source code changes.'});
            } else {
                Util.removeArrayItemOnce(plugins, plugin);
                await Prompt.showMessage({title: 'Plugin Rejected', message: 'It is advised that you remove this plugin from the plugins folder.'});
            }
        }
    }

    if (someNewHashesAccepted){
        window.bridge.updateAcceptedPlugins(plugins);
    }


    await Promise.all(plugins.map(async plugin => {
        try {
            const module = await import(plugin.filePath);
            if (TYPES[module.NAME]){
                throw "illegal plugin name " + module.NAME;
            } 
            module.init(ScriptModuleCommon);
            TYPES[module.NAME] = module.NAME
            modules[module.NAME] = module;
            typeToInfo[module.NAME] = {isPlugin: true};
        } catch (error){
            console.log(`Error loading plugin ${plugin.filePath}: ${error}`);
        }
    }));
  
}

 






