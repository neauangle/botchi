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




//we have to do it this way or typescript thinks it's an error- doesn't actually affect anything but I don't like seeing the red filename...
//https://stackoverflow.com/questions/35758584/cannot-redeclare-block-scoped-variable-typescript
import * as Electron from 'electron';
const { contextBridge, ipcRenderer } = Electron; 

let generalCallback : Function | undefined;

const callbackTickets: any = {};
let callbackTicketCounter = 0;


contextBridge.exposeInMainWorld(
    'bridge', {
        isFirstStart: () => ipcRenderer.invoke("is-first-start"),
        checkPassword: (password: string) => ipcRenderer.invoke("check-password", password),
        changePassword: (password: string, scriptModuleDatabase: any) => ipcRenderer.invoke("change-password", password, scriptModuleDatabase),
        passwordWindowResult: (password: string) => ipcRenderer.invoke("password-window-result", password),

        getCallbackTicket: (func: Function) => {const x = (++callbackTicketCounter).toString(); callbackTickets[x] = func; return x;},
        disposeCallbackTicket : (ticket: string) => delete callbackTickets[ticket],

        setGeneralCallback: (func: Function) => { generalCallback = func;},

        checkNetworkConnectivity: (args:any) => ipcRenderer.invoke("check-network-connectivity", args),

        toolbarButtonPressed: (action:string) => ipcRenderer.invoke("main-toolbar-pressed", action),

        openURL: (url: string) => ipcRenderer.invoke('open-url', url),

        setFullScreen:  (val: boolean) => ipcRenderer.invoke("set-full-screen", val),

        getInitialUserData: (password: string) => ipcRenderer.invoke('get-init-user-data', password),
        updateUserData: (userData: any) => ipcRenderer.invoke('update-user-data', userData),

        getScriptModuleDatabase: () => ipcRenderer.invoke('get-script-module-database'),
        updateScriptModuleDatabase: (data: any) => ipcRenderer.invoke('update-script-module-database', data),

        showFileDialogue: (options: any) => ipcRenderer.invoke('show-file-dialogue', options),

        loadBotGroups: () => ipcRenderer.invoke('load-bot-groups'),
        loadBotGroup: (filePath: string) => ipcRenderer.invoke('load-bot-group', filePath),
        saveBotGroup: (botGroup: any) => ipcRenderer.invoke('save-bot-group', botGroup),
        saveBotGroups: (botGroups: any) => ipcRenderer.invoke('save-bot-groups', botGroups),
        saveBotGroupAs: (botGroup: any, filePath: string) => ipcRenderer.invoke('save-bot-group-as', botGroup, filePath),
        removeBotGroup:  (botGroup: any) => ipcRenderer.invoke('remove-bot-group', botGroup),

        loadWorkspace: (filePath: string) => ipcRenderer.invoke('load-workspace', filePath),
        saveWorkspaceAs: (botGroups: any, filePath: string) => ipcRenderer.invoke('save-workspace-as', botGroups, filePath),

        logBotInstance: (botInstance: any, botFullId: string, runNumberAsString: number) =>  ipcRenderer.invoke('log-bot-instance', botInstance,botFullId,runNumberAsString),
        
        logTracePage: (botFullId: string, runNumberAsString: string, pageIndex: string, innerHTML: string) => ipcRenderer.invoke('log-page-trace', botFullId, runNumberAsString, pageIndex, innerHTML),
        getTracePage: (botFullId: string, runNumberAsString: string, pageIndex: string) => ipcRenderer.invoke('get-page-trace', botFullId, runNumberAsString, pageIndex),

        loadGlobals:  () => ipcRenderer.invoke('load-globals'),
        saveGlobals:  (globals: any) => ipcRenderer.invoke('save-globals', globals),
        
        getBackendInfos: () => ipcRenderer.invoke('get-backend-infos'),
        getBackendIPCDataCapsules: (callbackTicket: string, disposeTicket: boolean) => {
            if (disposeTicket){
                delete callbackTickets[callbackTicket];
            }
            return ipcRenderer.invoke('get-backend-ipc-data-capsules', callbackTicket, disposeTicket);
        },
        callBackendFunction: (backendIndex:number, funcName:string, args:any) => ipcRenderer.invoke('call-backend-function', backendIndex, funcName, args),

        getPlugins: () => ipcRenderer.invoke('get-plugins'),
        updateAcceptedPlugins: (plugins: any) => ipcRenderer.invoke('update-accepted-plugins', plugins),

        executeCommand: (args: any) => ipcRenderer.invoke('execute-command', args),
        getDirectoryPath: (key: string) => ipcRenderer.invoke('get-directory-path', key),
        sendEmail: (auth: any, to: string, subject: string, text: string) => ipcRenderer.invoke('send-email', auth, to, subject, text),
        writeToFile: (filePath: string, text: string, isAppend: boolean) => ipcRenderer.invoke('write-to-file', filePath, text, isAppend),
        readFromFile: (filePath: string) => ipcRenderer.invoke('read-from-file', filePath),
    }   
)



ipcRenderer.on('ipc', async (event, type, args, ticket) => {
    if (ticket && callbackTickets[ticket]) {
        return callbackTickets[ticket](type, args, ticket);
    } else if (generalCallback){  
        return generalCallback(type, args, ticket);
    }
});


