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

import * as Prompt from './prompt.js';
import * as ThemeEditor from './theme-editor.js';
import * as ContextMenu from './context-menu.js';
import * as ResizeHandler from './resize-handler.js';
import * as AddTracker from './add-tracker.js';
import * as Bots from './bots.js';
import * as NetworkCheck from './network-check.js';
import * as TrackersManager from './trackers-manager.js';
import * as Globals from './globals.js';
import { ScriptModuleCommon } from './bot-script-modules/script-modules.js';


const devToolsButton = document.getElementById("main-toolbar-dev-tools-button");
devToolsButton.style.display = 'none';
const addTrackerButton = document.getElementById("main-toolbar-add-tracker-button");
const changePasswordButton = document.getElementById("main-toolbar-change-password-button");
const lockButton = document.getElementById("main-toolbar-lock-button");
const toggleSwapsButton = document.getElementById("main-toolbar-toggle-swaps-button");
const themeEditorButton = document.getElementById("main-toolbar-theme-editor-button");
const globalsButton = document.getElementById("main-toolbar-globals-button");

devToolsButton.addEventListener('click', () => window.bridge.toolbarButtonPressed('dev-tools'));
addTrackerButton.addEventListener('click', () => window.bridge.toolbarButtonPressed('add-tracker'));
changePasswordButton.addEventListener('click', () => window.bridge.toolbarButtonPressed('change-password'));
lockButton.addEventListener('click', () => window.bridge.toolbarButtonPressed('lock'));
toggleSwapsButton.addEventListener('click', () => window.bridge.toolbarButtonPressed('toggle-swaps'));
themeEditorButton.addEventListener('click', () => window.bridge.toolbarButtonPressed('theme-editor'));
globalsButton.addEventListener('click', () => window.bridge.toolbarButtonPressed('globals'));

const aboutButton = document.getElementById("main-toolbar-about-button");
aboutButton.addEventListener('click', () => {
    Prompt.showMessage({title: "About", textAlign: 'left', messageIsHTML: true, message: `
        Botchi is a free and <a href="https://github.com/neauangle/botchi">open-source</a> project, and I encourage everyone to
        take full advantage of that 😉👍
        <br><br>
        There are no advertisements and no hidden fees of any kind. I <i>have</i> included a dev wallet address in the top
        right, which should accept tokens from any chain that uses Ethereum-compatible addresses (Fantom, 
        Binance Smart Chain- pretty much any chain you can access using MetaMask). 
        Any payments to this wallet would be immensely appreciated- and it would be quite validating 😅
        <br><br>
        I am not rich, but I am not hungry and I have only factored Botchi into my quest 
        for ✧financial freedom✧ in the same way I hope you can.
        
    `})
});





TrackersManager.selectTracker(null); //just to set the html properly

const isFirstStart = await window.bridge.isFirstStart();
ThemeEditor.setAppReady();//so it knows it can fade the ui shield away when it's ready
let userData;
if (isFirstStart){
    const password = await Prompt.showPasswordFrame({
        type: Prompt.PASSWORD_FRAME_TYPES.REQUIRE,
        title: "Welcome to Botchi!",
        infoHTML: `
            Botchi is developed by a hobbyist. There is no guarantee it
            works as expected in all cases (there is <i>very rarely</i> such a guarantee 🤷‍♂️). By continuing you agree that the developer
            is not liable for any damages that may result from its use, or misuse. The codebase is available 
            <a href="https://github.com/neauangle/botchi">here</a>. If you do make use of bot modules that trade on your behalf, please make use of the 
            <i>test</i> tracker type to simulate scenarios and start with small amounts. 
            <br><br>
    
            The password given below will be used to encrypt all sensitive data and will be required on start and 
            after Botchi is locked. Bot groups are saved in plain text, which means that module 
            parameters- including the <i>names</i> of authorisation objects- are
            saved in plaintext (of course, API keys and authorisation objects themselves are encrypted). 
            <br><br>
            It is assumed that anyone who has access to the main Botchi interface can change the password so if you're 
            AFK, lock Botchi to the system tray. Note that if someone has extended acccess to your machine while Botchi is
            <i>running</i>, you should NOT rely on Botchi's locking mechanism to have kept your data safe.
        `
    });
    userData = await window.bridge.getInitialUserData(password);
    await window.bridge.updateUserData(userData);
} else {
    while (!userData){
        const password = await Prompt.showPasswordFrame({
            type: Prompt.PASSWORD_FRAME_TYPES.REQUIRE,
            title: "Welcome to Botchi!",
            infoHTML: `Please enter your password to decrypt user files and begin.`
        });
        userData = await window.bridge.getInitialUserData(password);
    }
}



//these should not be reassigned to, but altered in place
// * I pass backendInfos to AddTracker who keeps references to each backendInfo.
const [backendInfos,scriptModuleDatabase] = await Promise.all([window.bridge.getBackendInfos(), window.bridge.getScriptModuleDatabase()]);
await Promise.all(backendInfos.map(async backendInfo =>  backendInfo.frontend = await import(backendInfo.pathToFrontendFile)));

ScriptModuleCommon.init(scriptModuleDatabase, backendInfos.map(backendInfo => backendInfo.name));

ResizeHandler.init(userData);
if (!userData.showingSwaps){
    ResizeHandler.toggleForceClosed('trackerTopFrameHeightProportion');
} 
ResizeHandler.emitter.addEventListener(ResizeHandler.EVENT.PROPORTION_SET, ev => {
    userData[ev.data.key] =  ev.data.p;
    window.bridge.updateUserData(userData);
});
 
AddTracker.init(backendInfos, userData.lastTrackerType);
AddTracker.emitter.addEventListener(AddTracker.EVENTS.TRACKER_TYPE_CHANGED, e => {
    userData.lastTrackerType = e.data.trackerType;
    window.bridge.updateUserData(userData);
});   

Globals.init(await window.bridge.loadGlobals());

Bots.init(await window.bridge.getPlugins(), userData.lastWorkspaceTag);
Bots.emitter.addEventListener(Bots.EVENTS.WORKSPACE_SELECTED, event => {
    userData.lastWorkspaceTag = event.data.workspaceTag;
    window.bridge.updateUserData(userData);
})
NetworkCheck.beginCheckingNetwork();


async function generalCallbackHandler(event, args){
    if (event === 'toolbar-action'){
        ContextMenu.forceResolve();//because mouse click won't be detected for toolbar clicks, it won't otherwise know to hide
        if (args.action === 'change-password'){
            if (Prompt.isPasswordFrameShowing()){
                return;
            }
            const newPassword = await Prompt.showPasswordFrame({
                type: Prompt.PASSWORD_FRAME_TYPES.RESET,
                title: "Change Password",
                infoHTML: "Please enter your new password."
            });
            if (newPassword !== null){
                try {
                    window.bridge.changePassword(newPassword, scriptModuleDatabase);
                    Prompt.showMessage({
                        title: "Password changed!",
                        message: "Your password has been successfully changed- files have been re-encrypted."
                    })
                } catch (error){
                    Prompt.showMessage({
                        title: "Error",
                        message: error
                    })
                }
            }
            return;
        } else if (args.action === 'toggle-swaps'){
            userData['showingSwaps'] = ResizeHandler.toggleForceClosed('trackerTopFrameHeightProportion');
            window.bridge.updateUserData(userData);
       
        } else if (args.action === 'theme-editor'){
            await ThemeEditor.show();
        
        } else if (args.action === 'globals'){
            Globals.show();
        }
    }
    TrackersManager.generalCallbackHandler(event, args);
} 
TrackersManager.emitter.addEventListener(TrackersManager.EVENTS.TRACKER_ORDER_UPDATED, event => {
    userData.trackerUriStringsInOrder = event.data.trackerUriStringsInOrder;
    console.log('writing out', userData)
    window.bridge.updateUserData(userData);
})
TrackersManager.init(backendInfos, userData.trackerUriStringsInOrder);

window.bridge.setGeneralCallback(generalCallbackHandler);



document.addEventListener('keydown', async event => {
    if (event.key === 'D' && event.shiftKey && event.ctrlKey){
        if (devToolsButton.style.display === 'none'){
            devToolsButton.style.display = 'block';
        } else {
            devToolsButton.style.display = 'none';
        }
    }
});


