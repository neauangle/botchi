"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
//we have to do it this way or typescript thinks it's an error- doesn't actually affect anything but I don't like seeing the red filename...
//https://stackoverflow.com/questions/35758584/cannot-redeclare-block-scoped-variable-typescript
const Electron = __importStar(require("electron"));
const { contextBridge, ipcRenderer } = Electron;
let generalCallback;
const callbackTickets = {};
let callbackTicketCounter = 0;
contextBridge.exposeInMainWorld('bridge', {
    isFirstStart: () => ipcRenderer.invoke("is-first-start"),
    checkPassword: (password) => ipcRenderer.invoke("check-password", password),
    changePassword: (password, scriptModuleDatabase) => ipcRenderer.invoke("change-password", password, scriptModuleDatabase),
    passwordWindowResult: (password) => ipcRenderer.invoke("password-window-result", password),
    getCallbackTicket: (func) => { const x = (++callbackTicketCounter).toString(); callbackTickets[x] = func; return x; },
    disposeCallbackTicket: (ticket) => delete callbackTickets[ticket],
    setGeneralCallback: (func) => { generalCallback = func; },
    checkNetworkConnectivity: (args) => ipcRenderer.invoke("check-network-connectivity", args),
    toolbarButtonPressed: (action) => ipcRenderer.invoke("main-toolbar-pressed", action),
    openURL: (url) => ipcRenderer.invoke('open-url', url),
    setFullScreen: (val) => ipcRenderer.invoke("set-full-screen", val),
    getInitialUserData: (password) => ipcRenderer.invoke('get-init-user-data', password),
    updateUserData: (userData) => ipcRenderer.invoke('update-user-data', userData),
    getScriptModuleDatabase: () => ipcRenderer.invoke('get-script-module-database'),
    updateScriptModuleDatabase: (data) => ipcRenderer.invoke('update-script-module-database', data),
    showFileDialogue: (options) => ipcRenderer.invoke('show-file-dialogue', options),
    loadBotGroups: () => ipcRenderer.invoke('load-bot-groups'),
    loadBotGroup: (filePath) => ipcRenderer.invoke('load-bot-group', filePath),
    saveBotGroup: (botGroup) => ipcRenderer.invoke('save-bot-group', botGroup),
    saveBotGroups: (botGroups) => ipcRenderer.invoke('save-bot-groups', botGroups),
    saveBotGroupAs: (botGroup, filePath) => ipcRenderer.invoke('save-bot-group-as', botGroup, filePath),
    removeBotGroup: (botGroup) => ipcRenderer.invoke('remove-bot-group', botGroup),
    loadWorkspace: (filePath) => ipcRenderer.invoke('load-workspace', filePath),
    saveWorkspaceAs: (botGroups, filePath) => ipcRenderer.invoke('save-workspace-as', botGroups, filePath),
    logBotInstance: (botInstance, botFullId, runNumberAsString) => ipcRenderer.invoke('log-bot-instance', botInstance, botFullId, runNumberAsString),
    logTracePage: (botFullId, runNumberAsString, pageIndex, innerHTML) => ipcRenderer.invoke('log-page-trace', botFullId, runNumberAsString, pageIndex, innerHTML),
    getTracePage: (botFullId, runNumberAsString, pageIndex) => ipcRenderer.invoke('get-page-trace', botFullId, runNumberAsString, pageIndex),
    loadGlobals: () => ipcRenderer.invoke('load-globals'),
    saveGlobals: (globals) => ipcRenderer.invoke('save-globals', globals),
    getBackendInfos: () => ipcRenderer.invoke('get-backend-infos'),
    getBackendIPCDataCapsules: (callbackTicket, disposeTicket) => {
        if (disposeTicket) {
            delete callbackTickets[callbackTicket];
        }
        return ipcRenderer.invoke('get-backend-ipc-data-capsules', callbackTicket, disposeTicket);
    },
    callBackendFunction: (backendIndex, funcName, args) => ipcRenderer.invoke('call-backend-function', backendIndex, funcName, args),
    getPlugins: () => ipcRenderer.invoke('get-plugins'),
    updateAcceptedPlugins: (plugins) => ipcRenderer.invoke('update-accepted-plugins', plugins),
    executeCommand: (args) => ipcRenderer.invoke('execute-command', args),
    getDirectoryPath: (key) => ipcRenderer.invoke('get-directory-path', key),
    sendEmail: (auth, to, subject, text) => ipcRenderer.invoke('send-email', auth, to, subject, text),
    writeToFile: (filePath, text, isAppend) => ipcRenderer.invoke('write-to-file', filePath, text, isAppend),
    readFromFile: (filePath) => ipcRenderer.invoke('read-from-file', filePath),
});
ipcRenderer.on('ipc', async (event, type, args, ticket) => {
    if (ticket && callbackTickets[ticket]) {
        return callbackTickets[ticket](type, args, ticket);
    }
    else if (generalCallback) {
        return generalCallback(type, args, ticket);
    }
});
