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

const { contextBridge, ipcRenderer } = require('electron');

let generalCallback : Function | undefined;


contextBridge.exposeInMainWorld(
    'bridge', {
        setGeneralCallback: (func: Function) => { generalCallback = func;},
        checkPassword: (password: string) => ipcRenderer.invoke("check-password", password),
        passwordWindowResult: (password: string) => ipcRenderer.invoke("password-window-result", password),
    }   
)


ipcRenderer.on('ipc', async (event, type, args, ticket) => {
  if (generalCallback){  
        return generalCallback(type, args, ticket);
    }
});
