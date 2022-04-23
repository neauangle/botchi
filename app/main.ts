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

const {app, ipcMain, Menu, Tray, nativeTheme, shell, ipcRenderer, dialog} = require("electron");
import Electron, { BrowserWindow} from "electron";//gives us Electron types apparently
const fs = require('fs');
const { resolve } = require('path');
const { readdir } = require('fs').promises;
const { exec, execSync, spawn } = require('child_process');
const dns = require('dns');
const path = require("path");
const cryptoHelper = require("./cryptohelper");
const util = require("./util");
const net = require('net');
const nodemailer = require("nodemailer");
const trackerModuleSpec = require('./tracker-module-spec');

const IS_DEBUG = true;
//https://drive.google.com/drive/folders/1QCj_6_cuFMSFrsRthG8b3tOX-8nI38Z5?usp=sharing
//zip -er mac.zip Mac
//npx tsc --project ./ | npm run-script pack
//automatically refresh electron windows when files change (are saved)
if (IS_DEBUG){
    require('electron-reload')(__dirname);
}


const BOT_GROUPS_FOLDER_PATH = path.join(app.getPath("userData"), "/default_user/bot_groups");
const SCRIPT_MODULES_DATA_FILE_PATH = path.join(app.getPath("userData"), "/default_user/script-modules.json");
const USER_DATA_FILE_PATH = path.join(app.getPath("userData"), "/default_user/config.json");
const PLUGINS_FOLDER_PATH = path.join(app.getPath("userData"), "/default_user/plugins");
const PLUGIN_HASHES_PATH = path.join(app.getPath("userData"), "/default_user/plugin-hashes.json");
const THEMES_PATH = path.join(app.getPath("userData"), "/default_user/themes");
const GLOBALS_PATH = path.join(app.getPath("userData"), "/default_user/globals.json");
const LOGS_FOLDER_PATH = path.join(app.getPath("userData"), "/default_user/logs");


const DEFAULT_USER_DATA : any = {
    trackerTopFrameHeightProportion: 0.7,
    trackerChartWidthProportion: 0.4,
    trackerUriStringsInOrder: [],
    lastTrackerType: null,
    showingSwaps: true,
    lastWorkspaceTag: ''
}


const backends: Array<any>  = [];
for (const moduleName of ['binance', 'ethers', 'test']){
    backends.push({
        module: require(`./tracker_modules/${moduleName}-backend`).create(),
        name: `${moduleName}`,
        pathToFrontendFile: `../../tracker_modules/${moduleName}-frontend.js`
    });
}

let dateFolderName: string;
let sessionFolderName: string;
{
    const pad = util.prePadNumber;
    const date = new Date();
    dateFolderName = `${date.getFullYear()}-${pad(date.getMonth()+1, 2)}-${pad(date.getDate(), 2)}`;
    let i = 0;
    while (fs.existsSync(path.join(LOGS_FOLDER_PATH, dateFolderName, `session_${pad(i, 3)}`))){
        i += 1;
    }
    sessionFolderName = `session_${pad(i, 3)}`;
}

// If you don't keep references to windows, they are garbage collected.
let mainWindow : BrowserWindow;
let passwordWindow : BrowserWindow | null;
let isQuitting = false;
let tray: Electron.Tray | null;
let masterKey : Buffer | null;
let mainWindowInterfaceOpen = false;





/*   

    todo
    ----
    editabe modules at runtime
        * add a button to module props inspector
            if active, show it, else hide it
        * on bot start, show button
        * on bot end, hide it
        * if pressed:
            * copy over module infos into instance module infos
            * for each active module info of that type, call the updater with the new custom params
        * what if changes are made and then the button ISN'T pressed? What if you press to show info after that incongruity forms?
    

    add a special character to get the unix epoch seconds
        seconds rather than ms so it can be placed in timer module
        make timer module timer field an expression
    

    note: trace pages are stored as plain html. If a mal actor got his hands on, can inject whatever he wants to be loaded in.
        trace pages are only used in that one session so botchi wuld need ot be live and if someone has access to the user's temp folder
        they're done for anyway... 
    
    * is there a way to add full filtering capabilities to ethers wait? 

    * get history is broken for defi
        there is sometimes a time gap between the most recent candle given and the last we have
        I think maybe just for defi? That's way too complicated anyway- need to simplify with a clear head


    * bridge module: https://docs.multichain.org/developer-guide/how-to-integrate-front-end-bridges
    

    * add secure (oauth) email block   
            https://dev.to/chandrapantachhetri/sending-emails-securely-using-node-js-nodemailer-smtp-gmail-and-oauth2-g3a


    * JSON API module that returns te reuslt of a url call
        * URL and css selector module? 
            * (scrape website for certain data)


*/




























ipcMain.handle('password-window-result', (event, password: string) => {
    if (passwordWindow){
        if (checkPassword(password)){
            passwordWindow.destroy();
            passwordWindow = null;
            mainWindow.show();
            mainWindowInterfaceOpen = true;
        } 
    }
});

async function createPasswordWindow(){
    if (passwordWindow){ //ie password window itself was exited to system tray
        passwordWindow.maximize();
        passwordWindow.show();
        destroyTray();
        return; 
    }
    passwordWindow = new BrowserWindow({
        backgroundColor: "#fff",
        width: 1400,
        height: 800,
        show: false,
        webPreferences: {
            nativeWindowOpen: true,
            sandbox: true,
            //Context isolation is an Electron feature that allows developers to run code in preload scripts 
            //and in Electron APIs in a dedicated JavaScript context. In practice, that means that global objects 
            //like Array.prototype.push or JSON.parse cannot be modified by scripts running in the renderer process.
            contextIsolation: true,
            nodeIntegration: false,
            
            preload: path.join(__dirname, 'password-bridge.js'),
        }
    });
    passwordWindow.on('close', (event: Electron.Event) => {
        if (!isQuitting){
            if (process.platform === 'win32'){
                event.preventDefault();
                if (passwordWindow){
                    passwordWindow.hide();
                    createTray();
                }
                event.returnValue = false;
            } else {
                event.preventDefault();
                event.returnValue = false;
                passwordWindow?.minimize();
            }
        }
    });
    passwordWindow.loadFile(path.join(__dirname, "frontend/password-window.html"));
    passwordWindow.once('ready-to-show', () => {
        if (passwordWindow){
            let currentTheme = null;
            try {
                currentTheme = JSON.parse(readFromFile(THEMES_PATH + '/_current_theme.json'));
            } catch {}
            passwordWindow.webContents.send('ipc', 'theme-ready', currentTheme);
            passwordWindow.maximize();
            passwordWindow.show();
            //passwordWindow.webContents.openDevTools();
        }
    });
}





async function createMainWindow() {
    Menu.setApplicationMenu(null);
    mainWindow = new BrowserWindow({
    backgroundColor: "#fff",
    width: 1400,
    height: 800,
    show: false,
    webPreferences: {
        nativeWindowOpen: true,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'main-bridge.js'),
        backgroundThrottling: false
      }
    });
    /*
    Because we throw for unregistered callback tickets, backend funcs called from bot modules just need to give regular outputs
    (particularly before doing something important) to make sure the module is still active- if it's not, there's no ticket
    */
    const callbackTicketToDataCapsules : any = {};
    (mainWindow as any).send = (data:any, callbackTicket:string) => {
        if (!callbackTicketToDataCapsules[callbackTicket]){
            throw 'unregistered callbackTicket ' + callbackTicket;
        }
        const capsule = {data, id: callbackTicketToDataCapsules[callbackTicket].length};
        callbackTicketToDataCapsules[callbackTicket].push(capsule);
        return mainWindow.webContents.send('ipc', 'backend-ipc', capsule, callbackTicket);
    }
    (mainWindow as any).isCallbackTicketOpen = (callbackTicket:string) => {
        return !!callbackTicketToDataCapsules[callbackTicket];
    }

    const getSentDataCapsules = (callbackTicket:string) => {
        const ret = callbackTicketToDataCapsules[callbackTicket];
        delete callbackTicketToDataCapsules[callbackTicket];
        return ret;
    }

  

    ipcMain.handle('is-first-start', (event) => !fs.existsSync(USER_DATA_FILE_PATH));
    ipcMain.handle('check-password', (event, password: string) => checkPassword(password));

    //toolbar - we route all toolbar buttons through the backend to add a layer of security- frontend is more easly editable
    ipcMain.handle("main-toolbar-pressed", (event, action) => {
        if (!mainWindowInterfaceOpen){
            return;
        }
        if (action === 'dev-tools'){
            mainWindow.webContents.openDevTools();
        } else if (action === 'add-tracker'){
            mainWindow.webContents.send('ipc', 'toolbar-action', {action});
        } else if (action === 'change-password'){
            mainWindow.webContents.send('ipc', 'toolbar-action', {action});
        } else if (action === 'lock'){
            if (process.platform === 'win32'){
                mainWindow.hide();
                mainWindowInterfaceOpen = false;
                createTray();
            } else {
                if (masterKey !== undefined){
                    mainWindow.hide();
                    mainWindowInterfaceOpen = false;
                    Menu.setApplicationMenu(null);
                    createPasswordWindow();
                }
            }
        } else if (action === 'toggle-swaps'){
            mainWindow.webContents.send('ipc', 'toolbar-action', {action});
        } else if (action === 'theme-editor'){
            mainWindow.webContents.send('ipc', 'toolbar-action', {action});
        } else if (action === 'globals'){
            mainWindow.webContents.send('ipc', 'toolbar-action', {action});
        } 
    });
   
   
    
    /*
    Note, we assume if the user has access to Botchi and can add tokens etc. then they are the valid user. Otherwise,
    there are many attack vectors involving temporarily moving files, etc. because we don't store passwords on a server anywhere.
    So make sure they know to at least lock Botchi down to the system tray when they're afk.
    */
    ipcMain.handle('change-password', async (event, password: string, scriptModuleDatabase: any) => {
        const newMasterKey = password === '' ? null : cryptoHelper.generateAESKey(password, false, true).key;
        const userData = getUserDataPrivileged();
        //todo we don't do any error recovery here
        await Promise.all(backends.map(backend => backend.module.changePassword(newMasterKey)));
        masterKey = newMasterKey
        writeConfidentialData(userData, USER_DATA_FILE_PATH);
        writeConfidentialData(scriptModuleDatabase, SCRIPT_MODULES_DATA_FILE_PATH);
    });

    ipcMain.handle('get-init-user-data', (event, password: string) => getUserDataInitially(password));//also initialises backends

    ipcMain.handle('update-accepted-plugins', async (event, plugins: any) => {
        writeConfidentialData(plugins.map((plugin: any) => plugin.hash), PLUGIN_HASHES_PATH);
    });
    ipcMain.handle('get-plugins', async (event) => {
        const hashes = readConfidentialData(PLUGIN_HASHES_PATH, []);
        const pluginInfos: Array<any> = [];
        if (!fs.existsSync(PLUGINS_FOLDER_PATH)){
                fs.mkdirSync(PLUGINS_FOLDER_PATH, {recursive: true});
            }
        for (const filePath of getFilesSync(PLUGINS_FOLDER_PATH)) {
            const sourceCode = fs.readFileSync(filePath, {'encoding': 'utf-8'});
            const hash = await cryptoHelper.getHash(sourceCode);
            const info = {filePath, hash, sourceCode, basename: path.basename(filePath), newHash: !hashes.includes(hash)};
            pluginInfos.push(info);
        }
        return pluginInfos;

    });
    ipcMain.handle('update-user-data', (event, args) => writeConfidentialData(args, USER_DATA_FILE_PATH));
    ipcMain.handle('get-script-module-database', (event, args) => readConfidentialData(SCRIPT_MODULES_DATA_FILE_PATH, {}));
    ipcMain.handle('update-script-module-database', (event, args) => writeConfidentialData(args, SCRIPT_MODULES_DATA_FILE_PATH));

    ipcMain.handle('check-network-connectivity', (event, args) => checkNetworkConnectivity(args));
    
    ipcMain.handle('open-url', (event, url) => {shell.openExternal(url);});
    ipcMain.handle('set-full-screen', (event, val) => {mainWindow.setFullScreen(val);});
    ipcMain.handle('get-backend-infos', (event, val) => {
        const info = [];
        for (const backend of backends){
            info.push({
                trackers: (backend.module as any).call('getTrackersMap'),
                name: backend.name, 
                pathToFrontendFile: backend.pathToFrontendFile
            })
        }
        return info;
    });

    ipcMain.handle('get-backend-ipc-data-capsules', async (event, callbackTicket) => getSentDataCapsules(callbackTicket));
    ipcMain.handle('call-backend-function', async (event, backendIndex, funcName, args, callbackTicket) => {
        if (args && args.callbackTicket){
            callbackTicketToDataCapsules[args.callbackTicket] = [];
        }
        return backends[backendIndex].module.call(funcName, args);
    });
    for (const event of Object.keys(trackerModuleSpec.BACKEND_API.functions.create.return.emitter.events)){
        for (const backend of backends){
            const backendIndex = backends.indexOf(backend);
            backend.module.emitter.on(event, (data : any) => {
                mainWindow.webContents.send('ipc', 'backend-event', {backendIndex, event, data});
            });
        }
    }
    
    ipcMain.handle('get-directory-path', (event, key) => {
        if (key === 'BOT_GROUPS_FOLDER_PATH'){
            return BOT_GROUPS_FOLDER_PATH;
        } else if (key === 'PLUGINS_FOLDER_PATH'){
            return PLUGINS_FOLDER_PATH;
        } else if (key === 'THEMES_PATH'){
            return THEMES_PATH;
        }
    });
    ipcMain.handle('show-file-dialogue', (event, options) => showFileDialogue(options));
    ipcMain.handle('load-bot-group', (event, filePath) => loadBotGroup(filePath));
    ipcMain.handle('load-bot-groups', (event) => loadBotGroups());
    ipcMain.handle('save-bot-group', (event, botGroup) => saveBotGroup(botGroup));
    ipcMain.handle('save-bot-group-as', (event, botGroup, filePath) => saveBotGroupAs(botGroup, filePath));
    ipcMain.handle('save-bot-groups', (event, botGroups) => {
        for (const botGroup of botGroups){
            saveBotGroup(botGroup);
        }
    });
    ipcMain.handle('remove-bot-group', (event, botGroup) => removeBotGroup(botGroup));

    ipcMain.handle( 'save-workspace-as', (event, botGroups, filePath) => saveWorkspaceAs(botGroups, filePath));
    ipcMain.handle( 'load-workspace', (event, filePath) => loadWorkspace(filePath));
   
    ipcMain.handle('log-bot-instance', (event, botInstance,botFullId,runNumberAsString) => logBotInstance(botInstance,botFullId,runNumberAsString));

    ipcMain.handle('log-page-trace', (event, botFullId, runNumberAsString, pageIndex, innerHTML) => logPageTrace(botFullId, runNumberAsString, pageIndex, innerHTML));
    ipcMain.handle('get-page-trace', (event, botFullId, runNumberAsString, pageIndex) => getPageTrace(botFullId, runNumberAsString, pageIndex));

    ipcMain.handle('load-globals', (event) => readConfidentialData(GLOBALS_PATH, {}));
    ipcMain.handle('save-globals', (event, globals: any) => writeConfidentialData(globals, GLOBALS_PATH));

    ipcMain.handle('execute-command', (event, args) => executeCommand(args));
   
    ipcMain.handle('send-email', (event, auth, to, subject, text) => sendEmail(auth, to, subject, text));
    ipcMain.handle('write-to-file', (event, filePath, text, isAppend) => writeToFile(filePath, text, isAppend));
    ipcMain.handle('read-from-file', (event, filePath) => readFromFile(filePath));

    mainWindow.loadFile(path.join(__dirname, "frontend/app.html"));
    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
        if (IS_DEBUG){
            mainWindow.webContents.openDevTools();
        }
        //mainWindow.webContents.setBackgroundThrottling(false);
        //Electron.powerSaveBlocker.start('prevent-app-suspension');
    })
    
}

function createTray(){
    tray = new Tray(app.isPackaged ? path.join(process.resourcesPath, 'icon.ico') : './icon.ico');
    tray.addListener('click', event => {
        if (masterKey === undefined){
            mainWindow.show()
        } else {
            Menu.setApplicationMenu(null);
            createPasswordWindow();
        }
        destroyTray();
    });
}


function destroyTray(){
    if (tray){
        tray.destroy();
        tray = null;
    }
    
}

  
app.on("ready", () => {
    Menu.setApplicationMenu(null);
    createMainWindow();
});

app.on('before-quit', function () {
    isQuitting = true;
  });


app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    //if (process.platform !== 'darwin') {
      app.quit();
    //}
  })


/*
https://www.electronjs.org/docs/tutorial/security#12-disable-or-limit-navigation
If your app has no need to navigate or only needs to navigate to known pages, it is a good idea to 
limit navigation outright to that known scope, disallowing any other kinds of navigation.
*/
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        event.preventDefault()
    });
});




/*
https://www.electronjs.org/docs/tutorial/security#14-do-not-use-openexternal-with-untrusted-content
Shell's openExternal allows opening a given protocol URI with the desktop's native utilities. 
On macOS, for instance, this function is similar to the open terminal command utility and will open 
the specific application based on the URI and filetype association.
*/
app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(info => {
        if (isSafeForExternalOpen(info)) {
            setImmediate(() => {
                shell.openExternal(info.url)
            })
        }
        return { action: 'deny' };
    })
});
function isSafeForExternalOpen(info: Electron.HandlerDetails) {
    return false;
}


async function checkNetworkConnectivity(args: any){
    const addresses = args.addresses;
    let msAtStart = Date.now();
    let completed = false;
    let result = false;
    for (const address of addresses){
        dns.lookupService(address.ip, address.port, (error: any, hostname: string, service:string) => {
            if (!completed){
                if (error){
                    console.log(`Error with network check (DNS lookup): ${JSON.stringify(address)}: ${error.code}`);
                } else {
                    completed = true;
                    result = true;
                }
            }
        });
    }

    while (Date.now() - msAtStart < 3*1000){
        if (completed){
            return result;
        } else {
            await util.waitMs(1000);
        }
    }
    return result;
}



function showFileDialogue(options: any){
    if (options.defaultPath && !fs.existsSync(options.defaultPath)) {
        fs.mkdirSync(options.defaultPath, {recursive: true});
    }
    if (options.defaultFilename !== undefined){
        options.defaultPath = path.join(options.defaultPath ? options.defaultPath : app.getPath('documents'), options.defaultFilename);
    }
    if (options.type === 'load'){
        return dialog.showOpenDialogSync(mainWindow, options);
    } else {
        return dialog.showSaveDialogSync(mainWindow, options);
    }
}


//https://stackoverflow.com/a/45130990
async function* getFiles(dir: string, recursive: boolean) : any {
  const dirents = await readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name);
    if (dirent.isDirectory() && recursive) {
      yield* getFiles(res, recursive);
    } else {
      yield res;
    }
  }
}

//https://stackoverflow.com/a/45130990
function getFilesSync(dir: string) : any {
    const ret = [];
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        ret.push(resolve(dir, dirent.name));
    }   
    return ret;
}


async function loadBotGroups(){
    if (!fs.existsSync(BOT_GROUPS_FOLDER_PATH)) {
        fs.mkdirSync(BOT_GROUPS_FOLDER_PATH, {recursive: true});
    }
    const botGroups = [];
    for await (const filePath of getFiles(BOT_GROUPS_FOLDER_PATH, false)) {
        if (filePath.endsWith('.chi')){//so we don't load in .broken botgroups that once failed to load
            botGroups.push(loadBotGroup(filePath));
        }
       
    }
    return botGroups;
}


function saveBotGroup(botGroup: any){
    if (!fs.existsSync(BOT_GROUPS_FOLDER_PATH)) {
        fs.mkdirSync(BOT_GROUPS_FOLDER_PATH, {recursive: true});
    }
    let fileName : string;
    if (botGroup.fileName){
        fileName = botGroup.fileName;
        delete botGroup.fileName;
    } else {
        let i = 0;
        while (fs.existsSync(path.join(BOT_GROUPS_FOLDER_PATH, `${i}.chi`))){
            i += 1;
        }
        fileName = `${i}.chi`;
    }
    const filePath = path.join(BOT_GROUPS_FOLDER_PATH, fileName);
    fs.writeFileSync(filePath, JSON.stringify(botGroup));
    return fileName;
}
function removeBotGroup(botGroup: any){
    const filePath = path.join(BOT_GROUPS_FOLDER_PATH, botGroup.fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function saveBotGroupAs(botGroup: any, filePath:string){
    delete botGroup.fileName;
    fs.writeFileSync(filePath, JSON.stringify(botGroup));
}
function loadBotGroup(filePath:string){
    const botGroup = JSON.parse(fs.readFileSync(filePath, {'encoding': 'utf-8'}));
    botGroup.fileName = path.basename(filePath);
    return botGroup;
}
function getLogFolderPath(botFullId: string, runNumberAsString: string){
    const logFolderPath = path.join(
        LOGS_FOLDER_PATH, dateFolderName, sessionFolderName, botFullId,
        'run_'+runNumberAsString
    )
    if (!fs.existsSync(logFolderPath)) {
        fs.mkdirSync(logFolderPath, {recursive: true});
    }
    return logFolderPath
}
function logBotInstance(botInstance: any, botFullId: string, runNumberAsString: string){
    fs.writeFileSync(
        path.join(getLogFolderPath(botFullId, runNumberAsString), 'botInstance.json'), 
        JSON.stringify(botInstance, null, "   "), ()=>{}
    );
}


function logPageTrace(botFullId: string, runNumberAsString: string, pageIndex: string, innerHTML: string){
    fs.writeFileSync(
        path.join(getLogFolderPath(botFullId, runNumberAsString), pageIndex), 
        innerHTML
    );
}
function getPageTrace(botFullId: string, runNumberAsString: string, pageIndex: string){
    const filepath = path.join(getLogFolderPath(botFullId, runNumberAsString), pageIndex);
    if (!fs.existsSync(filepath)) {
        return null;
    }
    return readFromFile(filepath);
}



function saveWorkspaceAs(botGroups: any, filePath: string){
    for (const botGroup of botGroups){
        delete botGroup.fileName;
    }
    fs.writeFileSync(filePath, JSON.stringify(botGroups));
}

function loadWorkspace(filePath: string){
    const botGroups = JSON.parse(fs.readFileSync(filePath, {'encoding': 'utf-8'}));
    return botGroups;
}



function executeCommand(args: any){
    const {command, isBlocking, windowsHide} = args;
    const result = {stdOut: '', stdError: '', exitCode: 0};
    return new Promise((resolve:any, reject:any) => {
        //when not windowsHide, it is detached which means for .e.g ping command there will be be no stdOut or anything-
        //the user will instead see the command prompt do the command and show the results in its own window
        const process = spawn(command, [], {shell: true, detached: !windowsHide, windowsHide});

        if (!isBlocking){
            return resolve({});
        }
        process.stdout.on('data', (data: any) =>{
            result.stdOut += `${result.stdOut ? '\n' : ''}${data.toString("utf-8")}`;
        });
        process.stderr.on('data', (data: any) =>{
            result.stdError += `${result.stdError ? '\n' : ''}${data.toString("utf-8")}`;
        });
        process.on('close', (code: number) =>{
            result.exitCode = code
            if (code !== 0){
                reject(`Exit code ${code}: ${result.stdError}`);
            } 
            return resolve(result);
        });
    });
}




async function sendEmail(auth: any, to: string, subject: string, text: string){
    const transport = {
        host: auth.host,
        port: auth.port,
        secure: auth.secure,
        auth: {
            user: auth.username,
            pass: auth.password
        }
    };

    const transporter = nodemailer.createTransport(transport);
    const info = await transporter.sendMail({
        from: auth.username,
        to, // list of receivers
        subject, 
        text, // plain text body
        //html: "<b>Hello world?</b>", // html body
    });
    return "Success!";
}


function writeToFile(filePath: string, text: string, isAppend: boolean){
    if (!fs.existsSync(filePath)){
        fs.mkdirSync(path.dirname(filePath), {recursive: true});
    }
    const flag = isAppend ? 'a' : 'w';
    fs.writeFileSync(filePath, text, {flag});
}

function readFromFile(filePath: string){
    return fs.readFileSync(filePath, {'encoding': 'utf-8'});
}



function checkPassword(password: string){
    if (masterKey === null){
        return password === '';
    } else if (masterKey === undefined){
        if (fs.existsSync(USER_DATA_FILE_PATH)){
            let userDataString = fs.readFileSync(USER_DATA_FILE_PATH, {'encoding': 'utf-8'});
            try {
                if (password){
                    const key = cryptoHelper.generateAESKey(password, false, true).key;
                    userDataString = cryptoHelper.decryptStringAES(userDataString, key);
                }
                if (userDataString){
                    JSON.parse(userDataString);
                    return true;
                } 
            } catch (error) {
                console.log(error)
                return false;
            }
        }
        return true; //NOTE: attacker could e.g. delete the user data file and change password while Botchis running- hence, LOCK

    } else {
        const key = cryptoHelper.generateAESKey(password, false, true).key;
        if (key.length !== masterKey.length){
            return false;
        }
        for (let i = 0; i > masterKey.length; ++i){
            if (masterKey[i] !== key[i]){
                return false;
            } 
        }
       return true;
    } 
}




//also initialises backends
function getUserDataInitially(password: string) {
    if (password === ''){
        masterKey = null; //undefined before it's set
    } 
    if (password){
        masterKey = cryptoHelper.generateAESKey(password, false, true).key;
    }
    let userData = {...DEFAULT_USER_DATA};
    if (fs.existsSync(USER_DATA_FILE_PATH)){
        let userDataString = fs.readFileSync(USER_DATA_FILE_PATH, {'encoding': 'utf-8'});
        try {
            if (masterKey){
                userDataString = cryptoHelper.decryptStringAES(userDataString, masterKey);
            } 
            const userDataJSON = JSON.parse(userDataString);
            for (let key of Object.keys(userData)){
                if (userDataJSON.hasOwnProperty(key)){
                    userData[key] = userDataJSON[key];
                }
            }
        } catch (error) {
            return null;
        }
       
    }
    for (const backend of backends){
        backend.module.init(mainWindow, masterKey);
    }
    mainWindowInterfaceOpen = true;
    return userData;
}

function getUserDataPrivileged(){
    let userData = {...DEFAULT_USER_DATA};
    if (fs.existsSync(USER_DATA_FILE_PATH)){
        let userDataString = fs.readFileSync(USER_DATA_FILE_PATH, {'encoding': 'utf-8'});
        try {
            if (masterKey){
                userDataString = cryptoHelper.decryptStringAES(userDataString, masterKey);
            } 
            const userDataJSON = JSON.parse(userDataString);
            for (let key of Object.keys(userData)){
                if (userDataJSON.hasOwnProperty(key)){
                    userData[key] = userDataJSON[key];
                }
            }
        } catch (error) {
            return null;
        }
       
    }
    return userData;
}


function readConfidentialData(filePath: string, defaultValue: any){
    try {
        let jsonString = fs.readFileSync(filePath, {'encoding': 'utf-8'});
        if (masterKey){
            jsonString = cryptoHelper.decryptStringAES(jsonString, masterKey);
        } 
        return JSON.parse(jsonString);
    } catch (error){
        console.log("Error retreiving confidental data:", error);
        return defaultValue;
    }
}


function writeConfidentialData(json: any, filePath: string){
    if (!fs.existsSync(filePath)){
        fs.mkdirSync(path.dirname(filePath), {recursive: true});
    }
    let jsonString = JSON.stringify(json);
    if (masterKey){
        jsonString = cryptoHelper.encryptStringAES(jsonString, masterKey).cipher;
    }
    fs.writeFileSync(filePath, jsonString);

}





export {};

