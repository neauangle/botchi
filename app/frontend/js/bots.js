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

import * as Templates from './templates.js';
import * as Prompt from './prompt.js';
import * as ContextMenu from './context-menu.js';
import * as Util from './util.js';
import * as NetworkCheck from './network-check.js';
import * as TrackersManager from './trackers-manager.js';
import * as ScriptModules from './bot-script-modules/script-modules.js';
import * as ScriptModuleCommon from './bot-script-modules/script-module-common.js';
import * as Chart from './chart.js';
import * as Emitter from  './event-emitter.js'; const emitter = Emitter.instance(); export {emitter};
import * as Clock from './clock.js';
import * as ThemeEditor from './theme-editor.js';
import * as SpawnTree from './spawn-tree.js';
import * as Waiting from './waiting.js';

export const EVENTS = {
    WORKSPACE_SELECTED: "WORKSPACE_SELECTED"
}

const moduleGroupNames = [];
const moduleGroupNameToTypes = {};

window.addEventListener('beforeunload', e => {
    window.bridge.saveBotGroups([...botGroupIdToBotGroup.values()]);
});

export async function init(plugins, lastWorkspaceTag){
    clearSelections();
    const [botGroups, _] = await Promise.all([
        window.bridge.loadBotGroups(),
        ScriptModules.init(plugins)
    ]);

    //modules
    for (const type of Object.keys(ScriptModules.TYPES).sort()){
        let groupName = 'Misc'
        if (ScriptModules.modules[type].GROUP_NAME){
            groupName = ScriptModules.modules[type].GROUP_NAME;
        }
        if (!moduleGroupNames.includes(groupName)){
            moduleGroupNames.push(groupName);
            moduleGroupNameToTypes[groupName] = [];
        }
        moduleGroupNameToTypes[groupName].push(type);
    }
    moduleGroupNames.sort();
    for (const groupName of moduleGroupNames){
        const moduleGroupListing = Templates.getGroupListing(groupName);
        moduleGroupListings.appendChild(moduleGroupListing);
        const moduleListings = moduleGroupListing.getElementsByClassName('listings')[0];
        const groupListingShowHideIcon = moduleGroupListing.getElementsByClassName('group-show-hide')[0];
        moduleGroupListing.getElementsByClassName('group-name-row')[0].addEventListener('click', () => {
            if (moduleListings.style.display === 'none'){
                moduleListings.style.display = 'flex';
                groupListingShowHideIcon.classList.remove("closed");
            } else {
                moduleListings.style.display = 'none';
                groupListingShowHideIcon.classList.add("closed");
            }
        });
        for (const type of moduleGroupNameToTypes[groupName]){
            if (type === ScriptModules.TYPES.Start || type === ScriptModules.TYPES.End){
                continue;
            }
            const moduleListing = Templates.getModuleListing(type);
            moduleListings.appendChild(moduleListing);
            if (ScriptModules.isPlugin(type)){
                moduleListing.classList.add('plugin');
            }
            const moduleListingIndex = moduleListingIndexToScript.length;
            moduleListingIndexToScript.push(ScriptModules.modules[type]);
        
            moduleListing.addEventListener('click', event => {
                showModuleListingDescription(type);
            });

            moduleListing.addEventListener('dragstart', event => {
                showModuleListingDescription(type);

                const selectedBot = botListingToBotMap.get(selectedBotListing);
                if (!selectedBot){
                    return;
                }
                const botGroup = botGroupIdToBotGroup.get(selectedBot.botGroupId);
                if (!botGroup){
                    return;
                }
                for (const botOfGroup of botGroup.bots){
                    if (botIdToBotInstanceMap.get(botOfGroup.id)){
                        return;
                    }
                }

                draggedModuleListingIndex = moduleListingIndex;
                event.dataTransfer.effectAllowed = "move";
                if (ScriptModules.modules[type].getResultKeys().length === 2){
                    const logicRowsHTML = botIdToLogicRowsHTMLMap.get(selectedBot.id);
                    for (const botRow of logicRowsHTML.children){
                        const row1ModuleOutlines = botRow.getElementsByClassName('bot-module-outline row-1');
                        if (row1ModuleOutlines.length === 2 
                        &&  !row1ModuleOutlines[0].children.length
                        &&  !row1ModuleOutlines[1].children.length){
                            row1ModuleOutlines[1].style.display = 'none';
                        }
                    }
                }
            });

            moduleListing.addEventListener('dragend', event => {
                draggedModuleListingIndex = null;
                const selectedBot = botListingToBotMap.get(selectedBotListing);
                if (selectedBot && ScriptModules.modules[type].getResultKeys().length === 2){
                    const logicRowsHTML = botIdToLogicRowsHTMLMap.get(selectedBot.id);
                    for (const botRow of logicRowsHTML.children){
                        const row1ModuleOutlines = botRow.getElementsByClassName('bot-module-outline row-1');
                        if (row1ModuleOutlines.length === 2 
                        &&  !row1ModuleOutlines[0].children.length
                        &&  !row1ModuleOutlines[1].children.length){
                            row1ModuleOutlines[1].style.display = 'flex';
                        }
                    }
                }
            });
        }
    }


    //bot groups
    for (const botgroup of botGroups){
        try {
            await addBotGroup(botgroup);
        } catch (error) {
            console.log(error);
        }
    }
    updateBotButtons(); 
    NetworkCheck.emitter.addEventListener(NetworkCheck.EVENT.NETWORK_STATUS_CHANGED, event => {
        if (!event.data.isConnected){
            for (const botInstance of botIdToBotInstanceMap.values()){
                botInstance.halt({haltMessage: `Network connectivity lost on ${new Date()}`, isError: true});
            }
        }
    });
    gotoWorkspace(lastWorkspaceTag);
}


const botsTab = document.getElementById('bot-area-tab-bots');
const botsPane = document.getElementById('bot-area-bots-pane');
const modulesTab = document.getElementById('bot-area-tab-modules');
const modulesPane = document.getElementById('bot-area-modules-pane');
const moduleGroupListings = document.getElementById('bot-area-module-group-listings-container');
const botGroupListings = document.getElementById('bot-area-bot-group-listings-container');
const workspaceNameInput = document.getElementById('workspace-name-input');
const workspaceNameLabel = document.getElementById('workspace-name-label');
const workspaceSelectButton = document.getElementById("workspace-select-button");
const botGroupHamburger = document.getElementById('bot-group-hamburger');

const propertiesTitle = document.getElementById('bot-area-properties-title');
const showAdvancedPropertiesToggle = document.getElementById('bot-area-toggle-advance-properties');
const propertiesContainer = document.getElementById('bot-area-properties');

const logicPaneBotName = document.getElementById('bot-area-logic-bot-name')
const logicPaneBotTracker = document.getElementById('bot-area-logic-bot-tracker')

const botRowsandTracesContainer = document.getElementById('bot-rows-and-traces');
const logicsContainer = document.getElementById('bot-logics');
const tracesContainer = document.getElementById('bot-traces');
const showBotTraceButton = document.getElementById('show-bot-trace-button');

const botGroupIdToBotGroup = new Map();
const botGroupIdToBotGroupListingMap = new Map();
const botListingToBotMap = new Map();
const botIdToBotInstanceMap = new Map();
const botIdToTraceHTMLMap = new Map();
const botIdToLogicRowsHTMLMap = new Map();
const botIdToSpawnedBots = new Map();
const botIdToTimesRun = new Map();

const moduleListingIndexToScript = [];

let idCounter = 0;

let selectedBotGroupListingNameRow;
let selectedBotListing;
let selectedTracker;
let selectedBotModuleInfo;
let isShowingBotProperties;

let draggedModuleListingIndex = null;//must test !== null for empty
let draggedLogicModuleInfo;
let draggedLogicModuleElement;

let copiedModule;
let copiedOuterRow;

let selectedTab;
for (const tab of [botsTab, modulesTab]){
    tab.addEventListener('click', ev => {
        setTab(tab);
    })
}
setTab(botsTab);
function setTab(tab){
    if (selectedTab){
        selectedTab.classList.remove('selected');
    }
    tab.classList.add('selected');
    selectedTab = tab;
    if (selectedTab === botsTab) {
        botsPane.style.display = 'flex';
        modulesPane.style.display = 'none';
    } else {
        botsPane.style.display = 'none';
        modulesPane.style.display = 'flex';
    }
}

const [toggleShowAdvancedPropertiesOff, toggleShowAdvancedPropertiesOn] = (() => {
    const onToggle = showAdvancedPropertiesToggle.getElementsByClassName('on')[0];
    const offToggle = showAdvancedPropertiesToggle.getElementsByClassName('off')[0];
    const toggleOn = () => {
        onToggle.style.display = 'flex';
        offToggle.style.display = 'none';
        for (const element of propertiesContainer.getElementsByClassName('advanced')){
            if (!element.classList.contains('forceInvisible')){
                element.style.display = 'flex';
            }
            
        }
    }
    const toggleOff = () => {
        onToggle.style.display = 'none';
        offToggle.style.display = 'flex';
        for (const element of propertiesContainer.getElementsByClassName('advanced')){
            element.style.display = 'none';
        }
    }
    showAdvancedPropertiesToggle.addEventListener('click', event => {
        if (onToggle.style.display === 'none'){
            toggleOn()
        } else {
            toggleOff();
            
        }
    });
    return [toggleOff, toggleOn];
})();
toggleShowAdvancedPropertiesOff();


ThemeEditor.emitter.addEventListener(ThemeEditor.EVENT.THEME_VARIABLES_CHANGE_CONFIRMED, (event => {
    const changedThemeVariables = event.data;
    for (const botInstance of botIdToBotInstanceMap.values()){
        for (const activeModuleInfo of botInstance.activeModuleInfos){
            activeModuleInfo.module.updateChartcolours(changedThemeVariables);
        }
    }
}));



let workspaceSelectButtonClicked = false;
workspaceNameLabel.disabled = true;
workspaceSelectButton.addEventListener('mousedown', async e => {
    workspaceSelectButtonClicked = ContextMenu.getTag() === workspaceSelectButton;
});
workspaceSelectButton.addEventListener('click', async e => {
    if (workspaceSelectButtonClicked){
        return;
    }
    const options = Util.getGlobalBounds(workspaceSelectButton);
    options.forceLeft = true;
    options.tag = workspaceSelectButton;
    let workspaceTags = ['<ALL>'];
    for (const botGroup of botGroupIdToBotGroup.values()){
        if (botGroup.workspaceTag && !workspaceTags.includes(botGroup.workspaceTag)){
            workspaceTags.push(botGroup.workspaceTag)
        }
    }

    const result = await ContextMenu.show(workspaceTags, options);
    if (result){
        gotoWorkspace(result);
    }
})

workspaceNameLabel.addEventListener('click', event => {
    if (workspaceNameLabel.disabled){
        return;
    }
    workspaceNameLabel.style.display = 'none';
    workspaceNameInput.style.display = 'flex';
    workspaceNameInput.value = workspaceNameLabel.innerText;
    workspaceNameInput.focus();
    workspaceNameInput.setSelectionRange(0, workspaceNameInput.value.length);   
    workspaceNameInput.dispatchEvent(new Event('input'));  
});
workspaceNameInput.addEventListener('blur', event => {
    workspaceNameLabel.style.display = 'flex';
    workspaceNameInput.style.display = 'none';
});
workspaceNameInput.addEventListener('input', event => {
    let workspaceTags = [];
    for (const botGroup of botGroupIdToBotGroup.values()){
        if (botGroup.workspaceTag && !workspaceTags.includes(botGroup.workspaceTag)){
            workspaceTags.push(botGroup.workspaceTag)
        }
    }
    if (!workspaceNameInput.value
    || workspaceNameInput.value === '<ALL>'
    || workspaceNameInput.value !== workspaceNameLabel.innerText && workspaceTags.includes(workspaceNameInput.value)){
        workspaceNameInput.classList.add('input-invalid');
    } else {
        workspaceNameInput.classList.remove('input-invalid');
    }
});
workspaceNameInput.addEventListener('keyup', event => {
    if (event.key === 'Enter'){
        if (!workspaceNameInput.classList.contains('input-invalid')){
            const currentBotGroupListing = selectedBotGroupListingNameRow? selectedBotGroupListingNameRow.closest('.group-listing') : null;
            for (const botGroup of botGroupIdToBotGroup.values()){
                if (botGroup.workspaceTag === workspaceNameLabel.innerText){
                    botGroup.workspaceTag = workspaceNameInput.value;
                    if (currentBotGroupListing === botGroupIdToBotGroupListingMap.get(botGroup.id)){
                        showBotGroupProperties(botGroup);
                    }
                    (async () => {
                        botGroup.filename = await window.bridge.saveBotGroup(botGroup);
                    })()
                }
            }
            gotoWorkspace(workspaceNameInput.value);
        }
    } else if (event.key === 'Escape'){
        workspaceNameLabel.style.display = 'flex';
        workspaceNameInput.style.display = 'none';
    }
})



let hamburgerClicked = false;
botGroupHamburger.addEventListener('mousedown', async e => {
    hamburgerClicked = ContextMenu.getTag() === botGroupHamburger;
});
botGroupHamburger.addEventListener('click', async e => {
    if (hamburgerClicked){
        return;
    }
    const options = Util.getGlobalBounds(botGroupHamburger);
    options.forceLeft = true;
    options.tag = botGroupHamburger;
    const items =["New Bot Group", "Load Bot Group"];
    if (workspaceNameLabel.innerText){
        items.push("Save Workspace As");
    }
    items.push("Load Workspace");
    const result = await ContextMenu.show(items, options);
    try {
        if (result === "New Bot Group"){
            const result = await Prompt.showPrompt({
                title: `Create a New Bot Group`,
                okButtonText: "Create",
                cancelButtonText: "Cancel",
                inputInfos: [{placeholder: "Name", testFunction: t => t.trim() !== ""}]
            })
            if (result.okay){
                const botName = result.values[0];
                const botGroup = getBasicBotGroup(botName);
                await addBotGroup(botGroup);
                const {bot} = await addBot(botGroupIdToBotGroupListingMap.get(botGroup.id), botGroup);
                botGroup.bots.push(bot);
                botGroup.fileName = await window.bridge.saveBotGroup(botGroup);
                botGroup.workspaceTag = workspaceNameLabel.innerText;
                showBotGroupProperties(botGroup); 
            }


        } else if (result === "Load Bot Group"){
            Waiting.startWaiting();
            const filePaths = await  window.bridge.showFileDialogue({
                type: 'load',
                title: "Load Group From File",
                buttonLabel: "Load",
                defaultFilename: '',
                filters :[{name: 'Botchi Bot Group', extensions: ['chi']}],
            });
            if (filePaths){
                const filePath = filePaths[0];
                if (filePath){
                    const botGroup = await window.bridge.loadBotGroup(filePath);
                    await addBotGroup(botGroup);
                    botGroup.workspaceTag = workspaceNameLabel.innerText;
                    let firstBot = botGroup.bots[0];
                    //pretty heavy but we do this to get first error-check on all the modules
                    for (const bot of botGroup.bots){
                        displayBot(bot);
                        performFunctionOnAllModuleInfos(bot, (moduleInfo) => {
                            if (moduleInfo){
                                showModuleProperties(getExistingModuleElement(bot, moduleInfo), moduleInfo);
                            }
                        });
                    }
                    if (firstBot){
                        displayBot(firstBot);
                    }
                    botGroup.fileName = await window.bridge.saveBotGroup(botGroup);
                    Prompt.showMessage({title: "Bot Group Loaded!", message: `All bots have been loaded from ${filePath}`});
                }
            }
        
        
        } else if (result === "Load Workspace"){
            Waiting.startWaiting();
            const filePaths = await  window.bridge.showFileDialogue({
                type: 'load',
                title: "Load Workspace From File",
                buttonLabel: "Load",
                defaultFilename: '',
                filters :[{name: 'Botchi Workspace', extensions: ['chiX']}],
            });
            if (filePaths){
                const filePath = filePaths[0];
                const botGroups = await window.bridge.loadWorkspace(filePath);
                let workspaceTag;
                await Promise.all(botGroups.map(async botGroup => {
                    await addBotGroup(botGroup);
                    workspaceTag = botGroup.workspaceTag;
                    let firstBot = botGroup.bots[0];
                    //pretty heavy but we do this to get first error-check on all the modules
                    for (const bot of botGroup.bots){
                        displayBot(bot);
                        performFunctionOnAllModuleInfos(bot, (moduleInfo) => {
                            if (moduleInfo){
                                showModuleProperties(getExistingModuleElement(bot, moduleInfo), moduleInfo);
                            }
                        });
                    }
                    if (firstBot){
                        displayBot(firstBot);
                    }
                    botGroup.fileName = await window.bridge.saveBotGroup(botGroup);
                }));
                if (workspaceTag){
                    gotoWorkspace(workspaceTag);
                }
                Prompt.showMessage({title: "Workspace Loaded!", message: `All bot groups have been loaded from ${filePath}`}); 
            }


        } else if (result === "Save Workspace As"){
            const filePath = await window.bridge.showFileDialogue({
                type: 'save',
                title: "Save Workspace As...",
                buttonLabel: "Save",
                defaultFilename: Util.replaceIllegalCharsInFilename(workspaceNameLabel.innerText, '-') + '.chiX',
                filters :[{name: 'Botchi Workspace', extensions: ['chiX']}],
            });
            if (filePath){
                let botGroupsToSaveInWorkspace = [];
                for (const botGroup of botGroupIdToBotGroup.values()){
                    if (botGroup.workspaceTag === workspaceNameLabel.innerText){
                        botGroupsToSaveInWorkspace.push(botGroup);
                    }
                }
                await window.bridge.saveWorkspaceAs(botGroupsToSaveInWorkspace, filePath);
                Prompt.showMessage({title: "Saved!", message: `Saved to ${filePath}`});
            }
        }
    } catch (error){
        Prompt.showMessage({title: "Error!", message: `${error}`});
    } finally {
        Waiting.stopWaiting();
    }
});


function gotoWorkspace(workspaceTag){
    if (!workspaceTag){
        workspaceTag = '<ALL>';
    }
    let currentDisplayedBotInWorkspace = false;
    const currentDisplayedBot = botListingToBotMap.get(selectedBotListing);
    workspaceNameLabel.style.display = 'flex';
    workspaceNameInput.style.display = 'none';
    for (const botGroup of botGroupIdToBotGroup.values()){
        if (workspaceTag === "<ALL>" || botGroup.workspaceTag === workspaceTag){
            botGroupIdToBotGroupListingMap.get(botGroup.id).style.display = 'flex';
            if (currentDisplayedBot && !currentDisplayedBotInWorkspace && botGroup.bots.includes(currentDisplayedBot)){
                currentDisplayedBotInWorkspace = true;
            }
        } else {
            botGroupIdToBotGroupListingMap.get(botGroup.id).style.display = 'none';
        }
    }
    if (workspaceTag === "<ALL>"){
        workspaceNameLabel.innerText = "";
        workspaceNameLabel.disabled = true;
    } else {
        workspaceNameLabel.innerText = workspaceTag;
        workspaceNameLabel.disabled = false;
    }
    if (!currentDisplayedBotInWorkspace){
        displayBot(null);
    }
    emitter.emitEvent(EVENTS.WORKSPACE_SELECTED, {workspaceTag});
}


function shiftBotGroupListingToAlphabeticalPosition(botGroup, botGroupListing){
    let previousChild
    for (const child of botGroupListings.children){
        if (child === botGroupListing){
            if (child === botGroupListings.lastChild){
                previousChild = null;
            }
            continue;
        }
        previousChild = child;
        const botGroupOfChild = botGroupIdToBotGroup.get(child.getAttribute('groupId'));
        if (botGroup.name.toUpperCase() <= botGroupOfChild.name.toUpperCase()){
            break;
        } else {
            if (child === botGroupListings.lastChild){
                previousChild = null;
            }
        }
    }
    botGroupListings.insertBefore(botGroupListing, previousChild);
}

async function addBotGroup(botGroup){
    botGroup.id = (idCounter++).toString();
    botGroupIdToBotGroup.set(botGroup.id, botGroup);
    const botGroupListing = Templates.getGroupListing(botGroup.name);
    botGroupListing.setAttribute('groupId', botGroup.id);
    const botGroupListingNameRow = botGroupListing.getElementsByClassName('group-name-row')[0];
    const botGroupListingNameElement = botGroupListingNameRow.getElementsByClassName('group-name')[0];
    const botGroupListingShowHideIcon = botGroupListingNameRow.getElementsByClassName('group-show-hide')[0];
    
    botGroupIdToBotGroupListingMap.set(botGroup.id, botGroupListing);
    shiftBotGroupListingToAlphabeticalPosition(botGroup, botGroupListing);
    
    for (const bot of botGroup.bots){
        await addBot(botGroupListing, botGroup, bot.name, bot);
    }
    const botListings = botGroupListing.getElementsByClassName('listings')[0];
    botGroupListingShowHideIcon.addEventListener('click', () => {
        if (botListings.style.display === 'none'){
            botListings.style.display = 'flex';
            botGroupListingShowHideIcon.classList.remove("closed");
        } else {
            botListings.style.display = 'none';
            botGroupListingShowHideIcon.classList.add("closed");
        }
        showBotGroupProperties(botGroup);
    });
    botGroupListingNameElement.addEventListener('click', () => {
        showBotGroupProperties(botGroup);

    });
    botGroupListingNameElement.addEventListener('contextmenu', async (event) => {
        event.preventDefault();
        const result = await ContextMenu.show(["Add Bot", "Duplicate Group", "Save Group As", "Remove Group"]);
        if (result == "Add Bot"){
            const promptResult = await Prompt.showPrompt({
                title: `Create a New Bot`,
                okButtonText: "Create",
                cancelButtonText: "Cancel",
                inputInfos: [{placeholder: "Name", testFunction: t => t.trim() !== ""}]
            })
            if (promptResult.okay){
                const botName = promptResult.values[0];
                const {bot} = await addBot(botGroupListing, botGroup, botName);
                botGroup.bots.push(bot);
                botGroup.fileName = await window.bridge.saveBotGroup(botGroup);
                displayBot(bot);
            }

        } else if (result === "Duplicate Group"){
            const promptResult = await Prompt.showPrompt({
                title: `Duplicate Bot Group`,
                okButtonText: "Create",
                cancelButtonText: "Cancel",
                inputInfos: [{placeholder: "Name", testFunction: t => t.trim() !== ""}]
            });
            if (promptResult.okay){
                const botGroupName = promptResult.values[0];
                let copiedBotGroup = JSON.parse(JSON.stringify(botGroup));
                copiedBotGroup.name = botGroupName;
                await addBotGroup(copiedBotGroup);
                delete copiedBotGroup.fileName;
                copiedBotGroup.fileName = await window.bridge.saveBotGroup(copiedBotGroup);
                showBotGroupProperties(copiedBotGroup)
            }

        } else if (result === "Save Group As"){
            const filePath = await window.bridge.showFileDialogue({
                type: 'save',
                title: "Save Group As...",
                buttonLabel: "Save",
                defaultFilename: Util.replaceIllegalCharsInFilename(botGroup.name, '-') + '.chi',
                filters :[{name: 'Botchi Bot Group', extensions: ['chi']}],
            });
            if (filePath){
                const botGroupToSave = JSON.parse(JSON.stringify(botGroup)); 
                for (const botOfGroup of botGroupToSave.bots){
                    botOfGroup.defaultTrackerURI = {backendIndex: null, trackerId: null};
                    performFunctionOnAllModuleInfos(botOfGroup, (moduleInfo => {
                        if (moduleInfo){
                            if (moduleInfo.trackerURI !== 'CUSTOM' && moduleInfo.trackerURI !== 'DEFAULT'){
                                moduleInfo.trackerURI = {backendIndex: null, trackerId: null};
                            }
                            for (const customParameter of moduleInfo.customParameters){
                                if (customParameter.type === 'select' && typeof customParameter.key === 'string'){
                                    customParameter.value = null;
                                }
                            }
                        }
                    }))
                }
                
                botGroupToSave.name = filePath.split('\\').pop().split('/').pop();
                const lastDotIndex = botGroupToSave.name.lastIndexOf('.');
                if (lastDotIndex > 0){
                    botGroupToSave.name = botGroupToSave.name.slice(0, lastDotIndex);
                }
                await window.bridge.saveBotGroupAs(botGroupToSave, filePath);
                Prompt.showMessage({title: "Saved!", message: `Saved to ${filePath}`});
            }
        } else if (result === "Remove Group"){
            const result = await Prompt.showPrompt({
                title: `Remove Group "${botGroup.name}"?`,
                message: "This will stop and remove all bots in the group.",
                okButtonText: "Remove",
                cancelButtonText: "Cancel",
                textAlign: 'center'
            });
            if (result.okay){
                for (const bot of botGroup.bots){
                    removeBot(bot);
                }
                window.bridge.removeBotGroup(botGroup);
                botGroupIdToBotGroup.delete(botGroup.id);
                if (selectedBotGroupListingNameRow === botGroupListingNameRow){
                    clearSelections();
                }
                Util.removeElementSafe(botGroupListing);
                botGroupIdToBotGroupListingMap.delete(botGroup.id);
            }
        }

    });
}


function clearSelections(clearSelectedBotListing=true){
    showAdvancedPropertiesToggle.style.display = 'none';
    isShowingBotProperties = false;
    if (selectedBotGroupListingNameRow){
        selectedBotGroupListingNameRow.classList.remove('selected');
        selectedBotGroupListingNameRow = null;
    }

    if (selectedBotListing){
        const selectedBot = botListingToBotMap.get(selectedBotListing);
        if (clearSelectedBotListing){
            selectedBotListing.classList.remove('selected');
            if (botIdToTraceHTMLMap.get(selectedBot.id)){
                botIdToTraceHTMLMap.get(selectedBot.id).style.display = 'none';
            }
            if (botIdToLogicRowsHTMLMap.get(selectedBot.id)){
                botIdToLogicRowsHTMLMap.get(selectedBot.id).style.display = 'none';
            }
            logicPaneBotName.innerText = 'Logic';
            logicPaneBotTracker.innerText = '';
            selectedBotListing = null;
        }

        if (selectedBotModuleInfo){
            getExistingModuleElement(selectedBot, selectedBotModuleInfo).classList.remove('showing-properties');
            
            for (const botInstance of botIdToBotInstanceMap.values()){
                for (const activeModuleInfo of botInstance.activeModuleInfos){
                    if (activeModuleInfo.module.isShowingChartOverlays()){
                        activeModuleInfo.module.hideChartOverlays(); 
                    }
                }
            }
            
            selectedBotModuleInfo = null;
        }
    }

    propertiesContainer.innerHTML = '';
    propertiesTitle.innerHTML = "";
}


function showBotGroupProperties(botGroup){
    clearSelections();
    const botGroupListing = botGroupIdToBotGroupListingMap.get(botGroup.id);
    const botGroupListingNameRow = botGroupListing.getElementsByClassName('group-name-row')[0];
    const botGroupListingNameElement = botGroupListing.getElementsByClassName('group-name')[0];
    selectedBotGroupListingNameRow = botGroupListingNameRow;
    selectedBotGroupListingNameRow.classList.add('selected');
    propertiesContainer.append(Templates.getPropertiesParametersGrid(
        null, null, [
            {name: 'groupName', label: 'Group Name', value: botGroup.name, type: 'text'},
            {name: 'workspaceTag', label: 'Workspace Tag', value: botGroup.workspaceTag ? botGroup.workspaceTag : '', type: 'text'}
        ])
    );
    const nameInput = propertiesContainer.getElementsByClassName('groupName input')[0];
    nameInput.addEventListener('change', async e => {
        nameInput.value = nameInput.value.trim();
        if (nameInput.value && nameInput.value !== botGroup.name){
            botGroup.name = nameInput.value;
            botGroupListingNameElement.innerText = botGroup.name;
            shiftBotGroupListingToAlphabeticalPosition(botGroup, botGroupListing);
            botGroup.fileName = await window.bridge.saveBotGroup(botGroup);
        } else {
            nameInput.value = botGroup.name;
        }
    });

    const workgroupTagInput = propertiesContainer.getElementsByClassName('workspaceTag input')[0];
    workgroupTagInput.addEventListener('change', async e => {
        workgroupTagInput.value.trim();
        if (workgroupTagInput.value !== botGroup.workspaceTag){
            botGroup.workspaceTag = workgroupTagInput.value;
            const botGroupListing = botGroupIdToBotGroupListingMap.get(botGroup.id);
            if (workspaceNameLabel.innerText){
                botGroupListing.style.display = 'none';
                if (selectedBotGroupListingNameRow === botGroupListing.getElementsByClassName('group-name-row')[0]){
                    clearSelections(true);
                }
            }
        }
    });

    updateBotButtons();

}




function getBasicBotGroup(botGroupName){
    const botGroup = {
        id: null,
        fileName: null,
        name: botGroupName,
        bots: []

    };
    return botGroup;
}



function shiftBotListingToAlphabeticalPosition(bot, botListing, botsContainer){
    let previousChild
    for (const child of botsContainer.children){
        if (child === botListing){
            if (child === botsContainer.lastChild){
                previousChild = null;
            }
            continue;
        }
        previousChild = child;
        const botOfChild = botListingToBotMap.get(child);
        if (bot.name.toUpperCase() <= botOfChild.name.toUpperCase()){
            break;
        } else {
            if (child === botsContainer.lastChild){
                previousChild = null;
            }
        }
    }
    botsContainer.insertBefore(botListing, previousChild);
}


//Does NOT add to botGroup.bots - do that yourself
//if you give a bot (ie reading in botgroups), I assume it is complies with the group's logic
//you can give null for botGroupListing and botGroup if you don't want to add the bot to any group, but then you 
//must supply botName and bot
async function addBot(botGroupListing, botGroup, botName=null, bot=null){
    if (!bot){
        if (botGroup.bots.length){
            bot = JSON.parse(JSON.stringify(botGroup.bots[0]));
           // bot.name = botName ? botName : "Bot";
            performFunctionOnAllModuleInfos(bot, moduleInfo => {
                if (moduleInfo){
                    moduleInfo.customParameters = ScriptModules.modules[moduleInfo.type].getDefaultParameters();
                    moduleInfo.trackerURI = 'DEFAULT';
                    moduleInfo.gotoRowOnError = 'DEFAULT';
                }
            })
        } else {
            bot = getBasicBot(botName ? botName : "Bot");
        }
        if (selectedTracker){
            bot.defaultTrackerURI = {backendIndex: selectedTracker.backendIndex, trackerId: selectedTracker.id};
        }
    }
    bot.name = botName ? botName : "Bot";
    bot.botGroupId = botGroup ? botGroup.id : -1;
    bot.id = (idCounter++).toString();

    const botListing = Templates.getBotListing(bot.name);
    botListing.setAttribute('botID', bot.id);
    botListingToBotMap.set(botListing, bot);

    if (botGroupListing){
        shiftBotListingToAlphabeticalPosition(bot, botListing, botGroupListing.getElementsByClassName('listings')[0]);
    }
   

    const logic = Templates.getLogic();
    botIdToLogicRowsHTMLMap.set(bot.id, logic);
    botIdToTimesRun.set(bot.id, 0);
    logicsContainer.appendChild(logic);
    logic.style.display = 'none';
    
    for (let i = 0; i < bot.outerRows.length; ++i){
        const outerRow = bot.outerRows[i];
        //i-1 because it's usually a click on the higher up (lower index) row that spawns the new one 
        const htmlBotRow = insertLogicRow(bot, i-1, outerRow.innerRows.length > 1 ? 'raceBlock' : 'single');
        for (let j = 0; j < outerRow.innerRows.length; ++j){
            const innerRow = outerRow.innerRows[j];
            for (let k = 0; k < innerRow.length; ++k){
                const row = j == 0 ? 1 : 3;//classes are 1-indexed because css stuff usually is. Row 2 is for links
                const column = k + 1;
                const moduleOutline = htmlBotRow.getElementsByClassName(`bot-module-outline row-${row} column-${column}`)[0];
                const moduleInfo = innerRow[k];
                try {
                    if (moduleInfo){
                        const script = ScriptModules.modules[moduleInfo.type];
                        if (!script){
                            throw "Invalid/missing module type: " + moduleInfo.type
                        }
                        if (script.VERSION !== moduleInfo.version){
                            const [i,j,k] = [moduleInfo.outerRowIndex, moduleInfo.innerRowIndex, moduleInfo.innerColumnIndex];
                            const message = (`"${bot.name}" of bot group "${botGroup.name}" contains an outdated module`
                                + ` at position (${i}, ${j}, ${k})`
                                + ` (type "${moduleInfo.type}", version "${moduleInfo.version}" vs "${script.VERSION}").`
                                + ` If you choose to try and add this `
                                + ` module anyway, you may encounter errors or unexpected behaviours.`
                            )
                            const result = await Prompt.showPrompt({
                                title: `Outdated Module"`,
                                message,
                                okButtonText: "Add Anyway",
                                cancelButtonText: "Remove Module",
                                textAlign: 'center'
                            });
                            if (result.okay){
                                moduleInfo.version = script.VERSION;
                            } else {
                                innerRow[k] = null;
                                moduleOutline.innerHTML = '';
                                continue;
                            } 
                        }
                        if (moduleInfo.trackerURI !== 'CUSTOM' && moduleInfo.trackerURI !== 'DEFAULT'){
                            const trackers = TrackersManager.getTrackers(script.RESTRICT_TO_TRACKER_TYPES);
                            let matched = false;
                            for (const tracker of trackers) {
                                if (moduleInfo.trackerURI.backendIndex === tracker.backendIndex 
                                && moduleInfo.trackerURI.trackerId === tracker.id){
                                    matched = true;
                                    break;
                                }
                            }
                            if (!matched){
                                moduleInfo.trackerURI.backendIndex = null;
                                moduleInfo.trackerURI.trackerId = null;
                            }
                        }
                        placeAndFillModuleInfo(bot, htmlBotRow, moduleOutline, moduleInfo);
                    }
                } catch (error){
                    const groupClone = JSON.parse(JSON.stringify(botGroup));
                    groupClone.fileName += '.broken';
                    window.bridge.saveBotGroup(groupClone);
                    console.log(`Error initialising "${bot.name}" of group "${groupClone.name}": module at position (${i}, ${j}, ${k})": ${error}
                        \nA copy of this bot group has been saved as ${groupClone.fileName}.
                    `);
                    
                    innerRow[k] = null;
                    moduleOutline.innerHTML = '';
                }
            }
        }
    }  
    updateBotRowNumbers(logic);     
    
    botListing.addEventListener('click', e => {
        displayBot(bot);
        if (!botGroup){
            showBotTrace();
        }
    });

    if (botGroupListing){
        botListing.addEventListener('contextmenu', async event => {
            event.preventDefault();
            const options = ["Show Tree", "Duplicate Bot", "Remove Bot"];
            const result = await ContextMenu.show(options);

        if (result === "Show Tree"){
            botsInSpawnTree = [];
            SpawnTree.show(getSpawnTree(bot));

        } else if (result === 'Remove Bot'){
                const botInstance = botIdToBotInstanceMap.get(bot.id);
                let message = botInstance ? "Bot will be stopped. This action is permanent." : "This action is permanent.";
                const result = await Prompt.showPrompt({
                    title: `Remove "${bot.name}"?`,
                    message: message,
                    okButtonText: "Remove",
                    cancelButtonText: "Cancel",
                    textAlign: 'center'
                });
                if (result.okay){
                    removeBot(bot);
                    botGroup.fileName = await window.bridge.saveBotGroup(botGroup);
                }
            } else if (result === "Duplicate Bot"){
                const promptResult = await Prompt.showPrompt({
                    title: `Duplicate Bot`,
                    okButtonText: "Create",
                    cancelButtonText: "Cancel",
                    inputInfos: [{placeholder: "Name", testFunction: t => t.trim() !== ""}]
                });
                if (promptResult.okay){
                    const botName = promptResult.values[0];
                    let copiedBot = JSON.parse(JSON.stringify(bot));
                    {//shadow the previous bot variable name
                        const {bot} = await addBot(botGroupListing, botGroup, botName, copiedBot);
                        botGroup.bots.push(bot);
                        botGroup.fileName = await window.bridge.saveBotGroup(botGroup);
                        displayBot(bot);
                    }
                }
            }
        });
    }

    return {bot, botListing};
}



SpawnTree.stopAllButton.addEventListener('click', event => {
    if (botsInSpawnTree.length){
        for (const bot of botsInSpawnTree){
            if (botIdToBotInstanceMap.has(bot.id)){
                botIdToBotInstanceMap.get(bot.id).halt({haltMessage: "Bot Halted"});
            }
        }
        const root = botsInSpawnTree[0];
        botsInSpawnTree = [];
        SpawnTree.show(getSpawnTree(root));
    }
});

let botsInSpawnTree = [];
function getSpawnTree(rootBot, _isRoot=true){//don't pass _isRoot just let me handle it
    SpawnTree.stopAllButton.disabled = _isRoot && !botIdToBotInstanceMap.has(rootBot.id);
    const listingCopy = getListingForBot(rootBot).cloneNode(true);
    listingCopy.addEventListener('click', event => {
        SpawnTree.hide();
        getListingForBot(rootBot).click();

    })
    botsInSpawnTree.push(rootBot);
    const treeNode = Templates.getTreeNode();
    treeNode.getElementsByClassName('spawn-tree-node-listing-container')[0].append(listingCopy)
    const spawnedBots = botIdToSpawnedBots.get(rootBot.id);
    if (spawnedBots){
        const childListingsContainer = treeNode.getElementsByClassName('spawn-tree-node-child-listings')[0];
        for (const spawnedBot of spawnedBots){
            childListingsContainer.append(getSpawnTree(spawnedBot, false));
            if (SpawnTree.stopAllButton.disabled && botIdToBotInstanceMap.has(spawnedBot.id)){
                SpawnTree.stopAllButton.disabled = false;
            }
        }
    }
    return treeNode;
}












showBotTraceButton.addEventListener('click', e => {
    if (showBotTraceButton.classList.contains('disabled')){
        return;
    }
    if (tracesContainer.style.display === 'none'){
        showBotTrace();
    } else {
        hideBotTrace();
    }
});

function showBotTrace(){
    tracesContainer.style.display = 'flex';
    logicsContainer.style.display = 'none';
    showBotTraceButton.classList.add("flipped");
}
function hideBotTrace(){
    tracesContainer.style.display = 'none';
    logicsContainer.style.display = 'flex';
    showBotTraceButton.classList.remove("flipped");
}


const stopBotButton = document.getElementById('stop-bot-button');
stopBotButton.addEventListener('click', async e => {
    const selectedBot = botListingToBotMap.get(selectedBotListing);
    if (botIdToBotInstanceMap.has(selectedBot.id)){
        botIdToBotInstanceMap.get(selectedBot.id).halt({haltMessage: "Bot Halted"});
    }
});


function botHasRunningSpawnedBots(bot){
    const spawnedBots = botIdToSpawnedBots.get(bot.id);
    if (spawnedBots){
        for (const spawnedBot of spawnedBots){
            if (botIdToBotInstanceMap.get(spawnedBot.id)){
                return true;
            } else if (botHasRunningSpawnedBots(spawnedBot)){
                return true;
            }
        }
    }
    return false;
}



const runPauseBotButton = document.getElementById('run-pause-bot-button');
runPauseBotButton.addEventListener('click', async e => {
    const selectedBot = botListingToBotMap.get(selectedBotListing);
    for (const botInstance of botIdToBotInstanceMap.values()){
        if (botInstance.botId === selectedBot.id){
            const isBotPaused = botInstance.togglePause();
            runPauseBotButton.innerText = isBotPaused ? 'Resume' : 'Pause Next';
            return;
        }
    }

    const someSpawnsRunning = botHasRunningSpawnedBots(selectedBot);
    if (someSpawnsRunning){
        const result = await Prompt.showPrompt({
            title: "Stop Spawned Bots?",
            message: "Starting this bot will stop and remove any bots spawned in the previous run.",
            textAlign: 'center'
        });
        if (!result.okay){
            return;
        } 
    }

    if (someSpawnsRunning){
        for (const spawnedBot of botIdToSpawnedBots.get(selectedBot.id)){
            removeBot(spawnedBot);
        }
    }

    botIdToSpawnedBots.delete(selectedBot.id);

    setAllowEditingSelectedBotParameters(false);
    setAllowEditingSelectedBotStructure(false);
    const botGroup = botGroupIdToBotGroup.get(selectedBot.botGroupId);
    //send this off in async func so we don't have any awaits (otherwise we have to fuck around with disabling start/stop button)
    (async () => { 
        botGroup.fileName = await window.bridge.saveBotGroup(botGroup);
    })();
    selectedBotListing.classList.add('active');
    runPauseBotButton.innerText = 'Pause Next';
    stopBotButton.disabled = false;
    //runPauseBotButton.innerText = 'Stop';
    
    startBot(selectedBot);
    botIdToTraceHTMLMap.get(selectedBot.id).style.display = 'flex'; //no need to hide others because this is the selected bot anyway
    if (tracesContainer.style.display === 'none'){
        showBotTraceButton.click();
    }
});

//botInstance, moduleInfo are of caller
async function duplicateStartBotFromModule({progenitorBot, moduleInfo, botGroupName, botName, startFromRow, initialVariables}){
    let rootBot = progenitorBot;
    while (rootBot.progenitorBot){
        rootBot = rootBot.progenitorBot;
    }
    const rootWorkspaceTag = botGroupIdToBotGroup.get(rootBot.botGroupId).workspaceTag;
    const botGroupAndWorkspaceMatches = [];
    const botGroupMatchesFromDifferentWorkspace = [];
    for (const botGroupCandidate of botGroupIdToBotGroup.values()){
        if (botGroupName === botGroupCandidate.name){
            if (botGroupCandidate.workspaceTag === rootWorkspaceTag){
                botGroupAndWorkspaceMatches.push(botGroupCandidate);
            } else {
                //uncomment this to allow bos to spawn bots from other workspaces
                //botGroupMatchesFromDifferentWorkspace.push(botGroupCandidate); 
            }   
        }
    }
    const botGroupMatches = botGroupAndWorkspaceMatches.concat(botGroupMatchesFromDifferentWorkspace);
    if (!botGroupMatches.length){
        throw `Error: Bot group "${botGroupName}" does not exist in root bot's workspace`;
    }

    let botTemplate;
    for (const botGroup of botGroupMatches){
        for (const botCandidate of botGroup.bots){
            if (botName === botCandidate.name){
                botTemplate = botCandidate;
                break;
            }
        }
        if (botTemplate){
            break;
        }
    }
    if (!botTemplate){
        throw `Error: Bot "${botName}" does not exist under any bot group "${botGroupName}" in root bot's workspace`;
    }

    //addBot will make bot.groupId -1, so that and the fact that spawned bots have a progenitorBot property are
    //the ways you can tell them from normal bots. They have no associated group but in other respects they are normal
    //bots (including entries in the various bot-related Maps)- with the difference being their botListing is kept 
    //within the progenitor's trace. They are killed and removed when their progenitor is either removed or run (the 
    //progenitor can be stopped and its spawned bots will keep going until the trace is rremoved for the new run)
    const copiedBot = JSON.parse(JSON.stringify(botTemplate));
    const {bot, botListing} = await addBot(null, null, `@${botGroupName}.${botName}`, copiedBot);
    //adding shit to the bot obj like is okay because these bots will not be written out- they belong to no group
    bot.progenitorBot = progenitorBot; 
    moduleInfo.spawnedBotId = bot.id;
    if (!botIdToSpawnedBots.get(progenitorBot.id)){
        botIdToSpawnedBots.set(progenitorBot.id, []);
    }
    botIdToSpawnedBots.get(progenitorBot.id).push(bot);
    botListing.classList.add('active');
    const botPromise = startBot(bot, startFromRow, initialVariables);
    let botToUpdateListingOf = progenitorBot;
    while (botToUpdateListingOf){
        getListingForBot(botToUpdateListingOf).classList.add('spawned-running');
        botToUpdateListingOf = botToUpdateListingOf.progenitorBot;
    }
    const botLinkRow = Templates.createBotLinkRow(botListing);//appends botListing
    moduleInfo.outputLinesContainerElement.closest('.bot-row-template-container').append(botLinkRow);
    if (SpawnTree.isShown() && botsInSpawnTree.includes(progenitorBot)){
        const root = botsInSpawnTree[0];
        botsInSpawnTree = [];
        SpawnTree.show(getSpawnTree(root));
    }
    return botPromise;
}

function getListingForBot(bot){
    for (const botListing of botListingToBotMap.keys()){
        if (botListingToBotMap.get(botListing) === bot){
            return botListing;
        }
    }
}



async function waitForInputInModuleTrace({botInstance, moduleInfo, message, inputVariables, okayButtonText, cancelButtonText}){
    let okayButton;
    let cancelButton;
    let inputs = [];
    let rejectFunc;
    let promise = new Promise((resolve, reject) => {
        rejectFunc = reject;
        botInstance.outstandingPromiseRejects.push(reject);
        const container = moduleInfo.outputLinesContainerElement.closest('.bot-row-template-container');
        const inputBlock = Templates.getInputBlock(message, inputVariables, okayButtonText, cancelButtonText);
        container.append(inputBlock);

        for (const input of inputBlock.getElementsByClassName('input-block-input')){
            inputs.push(input);
            input.addEventListener('change', event => {
                inputVariables[input.getAttribute('variable')] = input.value;
            });
        }

        okayButton = inputBlock.getElementsByClassName('input-block-button ok-button')[0];
        cancelButton = inputBlock.getElementsByClassName('input-block-button cancel-button')[0];
        okayButton.addEventListener('click', event => {
            okayButton.disabled = true;
            if (cancelButton){
                cancelButton.disabled = true;
            }
            for (const input of inputs){
                input.disabled = true;
            }
            resolve({okayButtonClicked: true});
        });
        if (cancelButton){
            cancelButton.addEventListener('click', event => {
                okayButton.disabled = true;
                if (cancelButton){
                    cancelButton.disabled = true;
                }
                for (const input of inputs){
                    input.disabled = true;
                }
                resolve({okayButtonClicked: false});
            })
        }
    });

    try {
        return await promise;
    } finally {
        if (okayButton){
            okayButton.disabled = true;
        }
        if (cancelButton){
            cancelButton.disabled = true;
        }
        for (const input of inputs){
            input.disabled = true;
        }
        Util.removeArrayItemOnce(botInstance.outstandingPromiseRejects, rejectFunc);
    }
  
}



function getTraceOutputString(resultPrefix, outputArray){
    const niceOutputArray = [...outputArray];
    for (let i = 0; i < niceOutputArray.length; ++i){
        if (niceOutputArray[i].startsWith(resultPrefix)){
            const result = niceOutputArray[i].slice(resultPrefix.length);
            try {
                niceOutputArray[i] = resultPrefix + JSON.stringify(JSON.parse(result), null, "  ");
            } catch { }
        }
    }
    return niceOutputArray.join('\n');
}





async function startBot(bot, startingAtOuterRow = 0, initialVariables={}){
    let resolveFunction;
    let botRunPromise = new Promise((resolve, reject) => {
        resolveFunction = resolve;
    });

    const botInstance = {
        botId: bot.id, 
        id: (idCounter++).toString(),
        outerRows: JSON.parse(JSON.stringify(bot.outerRows)),
        defaultTrackerURI: JSON.parse(JSON.stringify(bot.defaultTrackerURI)),
        initialVariables: JSON.parse(JSON.stringify(initialVariables)),
        localVariables: initialVariables,
        activeModuleInfos: [],
        outstandingPromiseRejects: [],
        runId: (() => {botIdToTimesRun.set(bot.id, botIdToTimesRun.get(bot.id) + 1); return botIdToTimesRun.get(bot.id) - 1})(),
        halted: false,
        haltMessage: null,
    };
    const botInstanceToLog = JSON.parse(JSON.stringify(botInstance));
    delete botInstanceToLog.halted;
    delete botInstanceToLog.activeModuleInfos;
    delete botInstanceToLog.outstandingPromiseRejects;

    botIdToBotInstanceMap.set(bot.id, botInstance);

    let botFullId
    if (bot.botGroupId !== -1){
        botFullId = `${botGroupIdToBotGroup.get(bot.botGroupId).name}.${bot.name}(${Util.prePadNumber(bot.id, 3)})`;
    } else {
        botFullId = `SPAWNED.${bot.name}(${Util.prePadNumber(bot.id, 3)})`;
    }
    botFullId = Util.replaceIllegalCharsInFilename(botFullId, '-');
    const runNumberAsString = Util.prePadNumber(botInstanceToLog.runId, 3);

    const rowLabels = bot.outerRows.map(outerRow => outerRow.rowLabel);//undefined for rows with no labels

    let infiniteLoopCheckerDoneModulesCount = 0;
    let msAtLastCheck = Date.now();

    const logicRowsHTML = botIdToLogicRowsHTMLMap.get(bot.id);
    let moduleRoundNumber = 0;
    let traceRowCounter = 0;
    
    //renewed for every run, but stays after instance is done running so user can check history
    if (botIdToTraceHTMLMap.get(bot.id)){
        Util.removeElementSafe(botIdToTraceHTMLMap.get(bot.id));
    }
    botIdToTraceHTMLMap.set(bot.id, Templates.getTrace());
    const tracePageInfosCache = [];

    let currentRunningTracePage = Templates.getTracePage();
    let highestPageIndex = 0;
    currentRunningTracePage.setAttribute('pageIndex', highestPageIndex);
    let currentDisplayedTracePage = currentRunningTracePage;
    const tracePagesContainer = botIdToTraceHTMLMap.get(bot.id).getElementsByClassName('trace-pages')[0];
    tracePagesContainer.append(currentDisplayedTracePage);
    tracesContainer.appendChild(botIdToTraceHTMLMap.get(bot.id));
    botIdToTraceHTMLMap.get(bot.id).style.display = 'none';

    const [tracePageLinkFirst, tracePageLinkPrevious, tracePageLinkInput, tracePageLinkNext, tracePageLinkLast] = (
            botIdToTraceHTMLMap.get(bot.id).getElementsByClassName('trace-pagination')[0].children
    )
    const dummyTracePage = Templates.getTracePage();
    tracePageLinkFirst.addEventListener('click', e => goToTracePage(0));
    tracePageLinkPrevious.addEventListener('click', e => goToTracePage(Number(currentDisplayedTracePage.getAttribute('pageIndex'))-1));
    tracePageLinkNext.addEventListener('click', e => goToTracePage(Number(currentDisplayedTracePage.getAttribute('pageIndex'))+1));
    tracePageLinkLast.addEventListener('click', e => goToTracePage(highestPageIndex));
    tracePageLinkInput.addEventListener('keyup', e => {
        if (e.key === 'Enter'){
            goToTracePage(tracePageLinkInput.value);
        } else if (event.key === 'Escape'){
            goToTracePage(Number(currentDisplayedTracePage.getAttribute('pageIndex')));
        }
            
    });
    updateTracePageToCache(currentDisplayedTracePage);

    const botUplinkButton = botIdToTraceHTMLMap.get(bot.id).getElementsByClassName('bot-uplink-button')[0];
    if(bot.progenitorBot){
        botUplinkButton.addEventListener('click', e=> {
            displayBot(bot.progenitorBot);
            showBotTrace();
        })
    } else {
        botUplinkButton.classList.add('disabled');
    }
    

    //it is important you return botRunPromise after if calling from startBot itself
    //(we must always return botRunPromise to caller so they can await it)
    botInstance.halt = halt;
    function halt({haltMessage, isError}){
        if (botInstance.halted){
            return;
        }
        botInstance.halted = true;
        delete botInstance.halt;
        delete botInstance.togglePause;
        delete botInstance.isPaused;
        for (const promiseReject of botInstance.outstandingPromiseRejects){
            promiseReject('Bot halted before promise fulfilled');
        }
        delete botInstance.outstandingPromiseRejects;
        for (const activeModuleInfo of botInstance.activeModuleInfos){
            deactivateModuleInfo(activeModuleInfo);
        }
        botInstance.activeModuleInfos.splice(0, botInstance.activeModuleInfos.length);

        for (const botListing of botListingToBotMap.keys()){
            if (botListingToBotMap.get(botListing).id === botInstance.botId){
                botListing.classList.remove('active');
                break;
            }
        }

        if (Object.keys(botInstance.localVariables).length){
            currentRunningTracePage.appendChild(Templates.getJSONElement(botInstance.localVariables));
        }

        
        if (haltMessage){
            currentRunningTracePage.appendChild(Templates.getTraceHaltRow(haltMessage));
            botInstanceToLog.haltMessage = haltMessage;
        }

        if (bot.logToDisk){
            window.bridge.logTracePage(
                botFullId, runNumberAsString,
                currentRunningTracePage.getAttribute('pageIndex'),
                currentRunningTracePage.innerHTML, 
            );
            window.bridge.logBotInstance(botInstanceToLog, botFullId, runNumberAsString);
        }
        
        performFunctionOnAllModuleInfos(botInstance, moduleInfo => {
            if (moduleInfo && moduleInfo.module){
                if (moduleInfo.module.emitter){
                    moduleInfo.module.emitter.removeEventListener('outputUpdated', outputUpdated);
                }
            }
        });
        botIdToBotInstanceMap.delete(bot.id);
        
        let botToUpdateListingOf = bot.progenitorBot;
        while (botToUpdateListingOf){
            if (!botHasRunningSpawnedBots(botToUpdateListingOf)){
                getListingForBot(botToUpdateListingOf).classList.remove('spawned-running');
            } else {
                break;
            }
            botToUpdateListingOf = botToUpdateListingOf.progenitorBot;
        }

        if (SpawnTree.isShown() && botsInSpawnTree.includes(bot)){
            const root = botsInSpawnTree[0];
            botsInSpawnTree = [];
            SpawnTree.show(getSpawnTree(root));
        }
        
        const selectedBot = botListingToBotMap.get(selectedBotListing);
        

        if (selectedBot){
            if (bot === selectedBot){
                runPauseBotButton.innerText = 'Run';
                stopBotButton.disabled = true;
                if (bot.botGroupId === -1){
                    runPauseBotButton.disabled = true;
                } else {
                    setAllowEditingSelectedBotParameters(true);
                }
            } 
            
            if (bot.botGroupId !== -1){
                let canEditBotStructure = true;
                let selectedBotIsPartOfBotGroup = false;
                for (const botOfGroup of botGroupIdToBotGroup.get(bot.botGroupId).bots){
                    if (selectedBot === botOfGroup){
                        selectedBotIsPartOfBotGroup = true;
                    }
                    const botInstance = botIdToBotInstanceMap.get(botOfGroup.id);
                    if (botInstance){
                        canEditBotStructure = false;
                        break;
                    }
                }
                if (canEditBotStructure && selectedBotIsPartOfBotGroup){
                    setAllowEditingSelectedBotStructure(true);
                }
            }
        }

        if (isError && bot.botGroupId === -1){
            resolveFunction({error: haltMessage, variables: botInstance.localVariables});
        } else {
            resolveFunction({variables: botInstance.localVariables});
        }
    }
    
    
    const rowResults = [];
    const moduleInfos = [];
    const moduleIdToModuleInfo = {};
    for (let i = 0; i < botInstance.outerRows.length; ++i){
        const outerRow = botInstance.outerRows[i];
        rowResults.push({ //these rows must not be replaced- references are kept in module instances
            entryPrice: 0,
            exitPrice: 0,
            entryPriceFiat: 0,
            exitPriceFiat: 0,
            result: {},
            error: false
        });
        for (let j = 0; j < outerRow.innerRows.length; ++j){
            const innerRow = outerRow.innerRows[j];
            for (let k = 0; k < innerRow.length; ++k){
                const moduleInfo = innerRow[k];
                if (!moduleInfo){
                    if (j === 0 && k === 1 && bot.outerRows[i].innerRows[j][0]?.expandedAcrossRaceBlockRow){
                        continue;
                    } else {
                        halt({haltMessage: `Missing module: Outer row ${i}, inner row ${j}, column ${k}`, isError: true});
                        return botRunPromise;
                    }
                }
                moduleInfos.push(moduleInfo);
                moduleInfo.id = `${i}-${j}-${k}`;
                moduleIdToModuleInfo[moduleInfo.id] = moduleInfo;
                moduleInfo.outputLinesContainerElement = null;//set on activate
                const row = j == 0 ? 1 : 3;//classes are 1-indexed because css stuff usually is. Row 2 is for links
                const column = k + 1;
                moduleInfo.moduleElement = logicRowsHTML.children[i].getElementsByClassName(`bot-module-outline row-${row} column-${column}`)[0].firstChild;
                let trackerURI = moduleInfo.trackerURI;
                let tracker = null;
                if (moduleInfo.trackerURI === 'CUSTOM'){
                    trackerURI = 'CUSTOM';
                } else {

                    if (!moduleInfo.trackerURI || moduleInfo.trackerURI === 'DEFAULT'){
                        trackerURI = botInstance.defaultTrackerURI;
                    } 
                    tracker = TrackersManager.getTracker(trackerURI.backendIndex, trackerURI.trackerId);
                    const uriString = `${trackerURI.backendIndex}-${trackerURI.trackerId}`;
                    if (!tracker){ 
                        halt({haltMessage: `Could not retrieve tracker ${uriString}`, isError: true});
                        return botRunPromise; //its okay- you can await completed promises
                    }
                    moduleInfo.tracker = tracker;
                    moduleInfo.trackerURIString = uriString;
                }
                moduleInfo.module =  ScriptModules.modules[moduleInfo.type].getInstance(moduleInfo.customParameters);
                moduleInfo.module.id = moduleInfo.id;
                moduleIdToModuleInfo[moduleInfo.id] = moduleInfo
                try {
                    moduleInfo.module.init(
                        moduleInfo.module.id, botInstance.localVariables, rowLabels, 
                        moduleInfo.outerRowIndex, rowResults
                    );
                } catch (error) {
                    halt({haltMessage: `Row ${i}: Error on init: ${error}`, isError: true});
                    return botRunPromise;
                }
                moduleInfo.module.emitter.addEventListener(ScriptModuleCommon.EVENTS.OUTPUT_LINES_UPDATED, outputUpdated);
                const restrictedTotypes = moduleInfo.module.RESTRICT_TO_TRACKER_TYPES;
                if (tracker && restrictedTotypes && !restrictedTotypes.some(trackerType => tracker.backendIndex === ScriptModuleCommon.getBackendIndex(trackerType))){
                    halt({haltMessage: `Row ${i}: Invalid tracker type "${ ScriptModuleCommon.getBackendName(tracker.backendIndex)}" (requires one of ${restrictedTotypes}`, isError: true});
                    return botRunPromise;
                }
            }
        }
    }
    
    if (Object.keys(initialVariables).length){
        const traceRow = Templates.getTraceRow();
        currentRunningTracePage.appendChild(traceRow);
        traceRow.getElementsByClassName('bot-row-number')[0].innerText =  '*';
        traceRow.getElementsByClassName('bot-row-index')[0].innerText = traceRowCounter++;
        const moduleTemplateHTML = getModuleTemplate(traceRow, 'single');
        traceRow.getElementsByClassName('bot-row-template-container')[0].appendChild(moduleTemplateHTML);
        const traceModuleElement = Templates.getTraceModule(Clock.getCurrentTimeString(), "INIT VARS");
        moduleTemplateHTML.getElementsByClassName(`bot-module-outline row-${1} column-${1}`)[0].appendChild(traceModuleElement);
        const outputLinesContainerElement = traceModuleElement.getElementsByClassName(`module-output-lines`)[0];
        for (const variable of Object.keys(initialVariables)){
            const line = `${variable} = ${initialVariables[variable]}`;
            outputLinesContainerElement.appendChild(Templates.getModuleOutputLine(line));
        }
    }
    if (startingAtOuterRow){
        try {
            const {resolveString, outerRowIndex} = resolveRowLabelToOuterRowIndex(bot, null, startingAtOuterRow);
            if (outerRowIndex < 0 || outerRowIndex >= botInstance.outerRows.length){
                throw null;
            }
            startingAtOuterRow = outerRowIndex;
        } catch {
            halt({haltMessage: `Invalid initial row: ${startingAtOuterRow}`, isError: true});
            return botRunPromise;
        }
    }
    

    function deactivateModuleInfo(moduleInfo){
        moduleInfo.moduleElement.closest('.bot-module-outline').classList.remove("active");
        if (moduleInfo.traceModuleElement){ //test
            moduleInfo.traceModuleElement.closest('.bot-module-outline').classList.remove("active");
        }
        
        moduleInfo.module.deactivate();
        if (moduleInfo.type === ScriptModules.TYPES.SpawnBot){
            if (moduleInfo.customParameters[ScriptModules.modules[ScriptModules.TYPES.SpawnBot].IS_BLOCKING_PARAM_INDEX].value){
                console.log('moduleInfo.spawnedBotId', moduleInfo.spawnedBotId)
                if (botIdToBotInstanceMap.has(moduleInfo.spawnedBotId)){
                    botIdToBotInstanceMap.get(moduleInfo.spawnedBotId).halt({haltMessage: "BotSpawn Module Deactivated"});
                }
            }
        }
        if (moduleInfo.module.isShowingChartOverlays()){
            moduleInfo.module.hideChartOverlays();
        }
    }


    function outputUpdated(event){
        const {moduleId, outputArray} = event.data;
        const moduleInfo = moduleIdToModuleInfo[moduleId];
        if (moduleInfo.outputLinesContainerElement){
            moduleInfo.outputLinesContainerElement.innerHTML = '';
            for (const outputText of outputArray){
                moduleInfo.outputLinesContainerElement.appendChild(Templates.getModuleOutputLine(outputText));
            }
        }
    }

    
    function updateTracePageToCache(tracePage){
        const pageIndex = tracePage.getAttribute('pageIndex');
        if (!tracePageInfosCache[pageIndex]){
            tracePageInfosCache[pageIndex] = {}
        }
        tracePageInfosCache[pageIndex].msLastVisited = Date.now();
        tracePageInfosCache[pageIndex].pageIndex = tracePage.getAttribute('pageIndex');
        tracePageInfosCache[pageIndex].tracePage = tracePage;
        if (bot.logToDisk && Object.keys(tracePageInfosCache).length > 25){
            let mostDistantlyVisitedCache;
            for (const cachedPageIndex of Object.keys(tracePageInfosCache)){
                const cachedTracePageInfo = tracePageInfosCache[cachedPageIndex];
                if (cachedTracePageInfo.pageIndex !== '0' && //I think it just makes sense to keep the first page ready
                cachedTracePageInfo.tracePage !== currentDisplayedTracePage 
                && cachedTracePageInfo.tracePage !== currentRunningTracePage
                && (!mostDistantlyVisitedCache || mostDistantlyVisitedCache.msLastVisited > cachedTracePageInfo.msLastVisited)){
                    mostDistantlyVisitedCache = cachedTracePageInfo;
                }
            }
            delete tracePageInfosCache[mostDistantlyVisitedCache.pageIndex];
            Util.removeElementSafe(mostDistantlyVisitedCache.tracePage);
        }
    }

    let tracePageNavigationCounter = 0;
    async function goToTracePage(pageIndex){
        const thisTracePageNavigationCounter = ++tracePageNavigationCounter;
        if (pageIndex === '' || isNaN(pageIndex) || pageIndex < 0 || pageIndex > highestPageIndex){
            tracePageLinkInput.value = currentDisplayedTracePage.getAttribute('pageIndex');
            return;
        }
        pageIndex = `${pageIndex}`;
        let tracePage;
        if (currentRunningTracePage.getAttribute('pageIndex') === pageIndex){
            tracePage = currentRunningTracePage;
        } else if (tracePageInfosCache[pageIndex]){
            tracePage = tracePageInfosCache[pageIndex].tracePage;
        } else {
            const innerHtml = await window.bridge.getTracePage(botFullId, runNumberAsString, pageIndex);
            if (innerHtml){
                tracePage = Templates.getTracePage();
                tracePage.setAttribute('pageIndex', pageIndex); //technically redundant but it makes me feel better
                tracePage.innerHTML = innerHtml;
                updateTracePageToCache(tracePage);
            } 
            if (thisTracePageNavigationCounter !== tracePageNavigationCounter){
                return;
            }
            if (!innerHtml){
                tracePage = dummyTracePage;
                tracePage.setAttribute('pageIndex', pageIndex);
            }
        }
        //we don't just compare pageIndex because we want to be able to hot-update 
        if (tracePage !== currentDisplayedTracePage || tracePage === dummyTracePage){
            if (currentDisplayedTracePage !== dummyTracePage){
                updateTracePageToCache(currentDisplayedTracePage);
            }
            currentDisplayedTracePage.remove();
            currentDisplayedTracePage = tracePage;
            tracePagesContainer.append(currentDisplayedTracePage);
            tracePageLinkInput.value = pageIndex;
            tracePageLinkInput.setAttribute('placeholder', pageIndex);
            
        }
    }

    //event is null on first call (wherein we start the START module and there is no previous row)
    async function moduleDone(args){
        console.log('module done', args);
        moduleRoundNumber += 1;
        let moduleInfosToActivate;
        let nextOuterRowIndex;
        let previousOuterRowIndex;
        if (!args){
            nextOuterRowIndex = startingAtOuterRow;
            moduleInfosToActivate = botInstance.outerRows[nextOuterRowIndex].innerRows[0];
        } else {
            const {result, resultKey, moduleId} = args;
            let error = args.error;
            const doneModuleInfo = moduleIdToModuleInfo[moduleId];
            previousOuterRowIndex = doneModuleInfo.outerRowIndex;
            const doneTracker = doneModuleInfo.tracker;

            for (const activeModuleInfo of botInstance.activeModuleInfos){
                deactivateModuleInfo(activeModuleInfo);
            }
            botInstance.activeModuleInfos.splice(0, botInstance.activeModuleInfos.length);

            //ensure reference for each rowResult remains valid over the life of the module (modules store a ref to them on init)
            rowResults[doneModuleInfo.outerRowIndex].entryPrice = doneModuleInfo.entryPrice;
            rowResults[doneModuleInfo.outerRowIndex].entryPriceFiat = doneModuleInfo.entryPriceFiat;
            rowResults[doneModuleInfo.outerRowIndex].exitPrice = doneTracker.mostRecentPrice && doneTracker.mostRecentPrice.comparator ? Number(doneTracker.mostRecentPrice.comparator) : 0;
            rowResults[doneModuleInfo.outerRowIndex].exitPriceFiat = doneTracker.mostRecentPrice && doneTracker.mostRecentPrice.fiat ? Number(doneTracker.mostRecentPrice.fiat) : 0;
            rowResults[doneModuleInfo.outerRowIndex].error = error;
            rowResults[doneModuleInfo.outerRowIndex].traceOutput = getTraceOutputString('Result: ', doneModuleInfo.module.getOutputArray());
            rowResults[doneModuleInfo.outerRowIndex].result =  result;
            
            let gotoOuterRowIndex;
            const resultPrefix = 'Result: ';
            
            if (!error){
                const result = rowResults[doneModuleInfo.outerRowIndex].result;
                let resultString = result; //could also be boolean, etc.
                if (typeof result !== 'string'){
                    try {
                        resultString = JSON.stringify(rowResults[doneModuleInfo.outerRowIndex].result);
                    } catch { }
                }
                if (doneModuleInfo.type === ScriptModules.TYPES.GoTo){
                    const {resolveString, outerRowIndex} = resolveRowLabelToOuterRowIndex(bot, doneModuleInfo, doneModuleInfo.customParameters[0].value);
                    gotoOuterRowIndex = outerRowIndex;
                    doneModuleInfo.module.addOutputLineSilently("GOTO Row " + resolveString);
                }
                doneModuleInfo.module.addOutputLineSilently(`${resultPrefix}${resultString}`); 
                
                //this needs to come after row results have been sorted (who cares about the summary, that's fine to come later
                //as it needs to include any errors from here too)
                //statementsBefore is handled by the module itself in activation- I know, it lacks symmetry but it does make sense.
                if (doneModuleInfo.statementsAfter.value){
                    doneModuleInfo.module.addOutputLineSilently(`   ---------------------------------`);
                    const resultInfo = doneModuleInfo.module.processStatements(doneModuleInfo.statementsAfter.value, null, '   |');
                    if (resultInfo.error){
                        error = resultInfo.error;
                    } else {
                        doneModuleInfo.module.addOutputLineSilently(`   ---------------------------------`);
                    }
                }
            }


            if (error){
                const {resolveString, outerRowIndex} = resolveRowLabelToOuterRowIndex(bot, doneModuleInfo, doneModuleInfo.gotoRowOnError);
                gotoOuterRowIndex = outerRowIndex;
                let outputError = error;
                if (typeof outputError !== 'string'){
                    outputError = `${outputError}`;
                } 
                if (!outputError.startsWith('Error: ')){
                    outputError = 'Error: ' + outputError;
                } 
                doneModuleInfo.module.addOutputLineSilently(outputError);
                if (doneModuleInfo.type === ScriptModules.TYPES.End && gotoOuterRowIndex === doneModuleInfo.outerRowIndex){
                    doneModuleInfo.module.addOutputLineSilently(`Error goto resolves to End...`);
                    halt({haltMessage: "Error in End module", isError: true});
                    return;
                } else {
                    doneModuleInfo.module.addOutputLineSilently(`Jumping to row: ${resolveString}`);
                }
            } 
    
            doneModuleInfo.module.emitOutputLines();

            const finalOutputArray = doneModuleInfo.module.getOutputArray();
            doneModuleInfo.traceModuleElement.removeEventListener('contextmenu', doneModuleInfo.contextMenuListener);
            doneModuleInfo.contextMenuListener = event => {
                const traceOutputString = getTraceOutputString('Result: ', finalOutputArray)
                Prompt.showBigTextArea({title: "Trace Output", text: traceOutputString, readonly: true, noCancel: true});
            };
            doneModuleInfo.traceModuleElement.addEventListener('contextmenu', doneModuleInfo.contextMenuListener);

            infiniteLoopCheckerDoneModulesCount += 1;
            if (infiniteLoopCheckerDoneModulesCount > 25){
                const msNow = Date.now();
                if (msNow - msAtLastCheck < 600){
                    halt({haltMessage: "Detected Infinite Loop", isError: true});
                    return;
                }
                infiniteLoopCheckerDoneModulesCount = 0;
                msAtLastCheck = msNow;
            }

            
            let nextInnerRowIndex;
            let nextInnerColumnIndex;

            if (error){
                nextOuterRowIndex = gotoOuterRowIndex;
                nextInnerRowIndex = 0;
            } else if (doneModuleInfo.type === ScriptModules.TYPES.End){
                halt({haltMessage: "Bot Completed Normally"});
                return; 
            } else if (doneModuleInfo.type === ScriptModules.TYPES.GoTo){
                if (doneModuleInfo.isInRaceBlock && doneModuleInfo.innerRowIndex === 0 
                && doneModuleInfo.customParameters[0].value === "NEXT"){
                    nextOuterRowIndex = doneModuleInfo.outerRowIndex;
                    nextInnerRowIndex = 1;
                    nextInnerColumnIndex = doneModuleInfo.innerColumnIndex;
                } else {
                    nextOuterRowIndex = gotoOuterRowIndex;
                    nextInnerRowIndex = 0;
                    if (nextOuterRowIndex > bot.outerRows.length){
                        halt({haltMessage: "GOTO jumped past End", isError: true});
                        return;
                    }
                }
            } else if (doneModuleInfo.isInRaceBlock && doneModuleInfo.innerRowIndex === 0){
                nextOuterRowIndex = doneModuleInfo.outerRowIndex;
                nextInnerRowIndex = doneModuleInfo.innerRowIndex + 1;
                if (doneModuleInfo.expandedAcrossRaceBlockRow){
                    nextInnerColumnIndex = ScriptModules.modules[doneModuleInfo.type].getResultKeys().indexOf(resultKey);
                } else {
                    nextInnerColumnIndex = doneModuleInfo.innerColumnIndex;
                }
            } else {
                nextOuterRowIndex = doneModuleInfo.outerRowIndex + 1;
                nextInnerRowIndex = 0;
            }
            
            if (nextInnerColumnIndex !== undefined){
                moduleInfosToActivate = [botInstance.outerRows[nextOuterRowIndex].innerRows[nextInnerRowIndex][nextInnerColumnIndex]];
            } else {
                moduleInfosToActivate = [];
                for (const moduleInfo of botInstance.outerRows[nextOuterRowIndex].innerRows[nextInnerRowIndex]){
                    if (moduleInfo !== null){
                        moduleInfosToActivate.push(moduleInfo);
                    }
                }
            }
        }

        let moduleTemplateHTML;
        if (moduleInfosToActivate[0].innerRowIndex === 0){
            if (currentRunningTracePage.children.length >=  50){
                let wasOnMostRecentPage = currentDisplayedTracePage === currentRunningTracePage;
                if (bot.logToDisk){
                    window.bridge.logTracePage(
                        botFullId, runNumberAsString,
                        currentRunningTracePage.getAttribute('pageIndex'),
                        currentRunningTracePage.innerHTML, 
                    );
                }
                currentRunningTracePage = Templates.getTracePage();
                currentRunningTracePage.setAttribute('pageIndex', ++highestPageIndex);
                tracePageLinkLast.innerText = highestPageIndex;
                if (wasOnMostRecentPage
                && Math.abs(currentDisplayedTracePage.clientHeight + currentDisplayedTracePage.scrollTop - currentDisplayedTracePage.scrollHeight) < 150){
                    goToTracePage(highestPageIndex);
                }
            }


            const traceRow = Templates.getTraceRow();
            traceRow.getElementsByClassName('bot-row-index')[0].innerText = traceRowCounter++;
            if (botInstance.outerRows[nextOuterRowIndex].rowLabel){
                traceRow.getElementsByClassName('bot-row-template-container')[0].style.paddingTop = '5px';
                const rowLabel = traceRow.getElementsByClassName('bot-row-label')[0];
                rowLabel.style.display = 'block';
                rowLabel.innerText = botInstance.outerRows[nextOuterRowIndex].rowLabel + ':';
            } else if (traceRowCounter >= 999){
                traceRow.getElementsByClassName('bot-row-template-container')[0].style.paddingTop = '20px';
            }
            currentRunningTracePage.appendChild(traceRow);
            traceRow.getElementsByClassName('bot-row-number')[0].innerText =  moduleInfosToActivate[0].outerRowIndex;
            moduleTemplateHTML = getModuleTemplate(traceRow, moduleInfosToActivate[0].isInRaceBlock ? 'raceBlock': 'single');
            traceRow.getElementsByClassName('bot-row-template-container')[0].appendChild(moduleTemplateHTML);
            if (Math.abs(currentDisplayedTracePage.clientHeight + currentDisplayedTracePage.scrollTop - currentDisplayedTracePage.scrollHeight) < 150){
                (async () => {
                    await Util.wait(0);
                    currentDisplayedTracePage.scrollTop = currentDisplayedTracePage.scrollHeight;
                })();
            }

            if (moduleInfosToActivate[0].isInRaceBlock && moduleInfosToActivate[0].expandedAcrossRaceBlockRow){
                moduleTemplateHTML.getElementsByClassName(`bot-module-outline row-1`)[1].style.display = 'none';
            }
        } else {
            const traceRows = currentRunningTracePage.getElementsByClassName('bot-row');
            moduleTemplateHTML = traceRows[traceRows.length-1].getElementsByClassName('module-template')[0];
        }

        const thisRoundNumber = moduleRoundNumber;
        try {
            let isFirstInternalColumn = true;
            const args = await Promise.race(moduleInfosToActivate.map(async moduleInfo => {
                
                if (isFirstInternalColumn){
                    isFirstInternalColumn = false;
                } else {
                    await Util.wait(0);
                }
                if (thisRoundNumber !== moduleRoundNumber){
                    return;
                }

                const correspondingBotModuleInfo = bot.outerRows[moduleInfo.outerRowIndex].innerRows[moduleInfo.innerRowIndex][moduleInfo.innerColumnIndex];

                const title = ScriptModules.modules[moduleInfo.type].getTitle(moduleInfo.customParameters);
                const traceModuleElement = Templates.getTraceModule(Clock.getCurrentTimeString(), title);
                if (moduleInfo.innerRowIndex === 0 && moduleInfo.isInRaceBlock && moduleInfo.expandedAcrossRaceBlockRow){
                    const outputLayer = Templates.getModuleMultiOutputLayer(ScriptModules.modules[moduleInfo.type].getResultKeys());
                    traceModuleElement.appendChild(outputLayer);
                }

                const row = moduleInfo.innerRowIndex === 0 ? 1 : 3;//classes are 1-indexed because css stuff usually is. Row 2 is for links
                const column = moduleInfo.innerColumnIndex + 1;
                moduleTemplateHTML.getElementsByClassName(`bot-module-outline row-${row} column-${column}`)[0].appendChild(traceModuleElement);
            

                moduleInfo.moduleElement.closest('.bot-module-outline').classList.add('active');
                traceModuleElement.closest('.bot-module-outline').classList.add("active");

                traceModuleElement.addEventListener('click', event => {
                    if (event.target.closest(".listing")){
                        return; //clicked on a bot-listing in a start-bot module
                    }
                    const botModuleInfo = bot.outerRows[moduleInfo.outerRowIndex].innerRows[moduleInfo.innerRowIndex][moduleInfo.innerColumnIndex];
                    if ((botModuleInfo !== selectedBotModuleInfo || moduleInfo.tracker !== selectedTracker)
                    && logicRowsHTML.contains(moduleInfo.moduleElement)){
                        showModuleProperties(moduleInfo.moduleElement, botModuleInfo);
                        TrackersManager.selectTracker(moduleInfo.tracker);
                        const script = ScriptModules.modules[moduleInfo.type];
                        if (script.PARAM_INDEX_FOR_CHART_DURATION_KEY !== undefined){
                            const durationKey = moduleInfo.customParameters[script.PARAM_INDEX_FOR_CHART_DURATION_KEY].value;
                            Chart.setBarDuration(durationKey);
                        } 
                    }
                });
                
                moduleInfo.traceModuleElement = traceModuleElement;
                moduleInfo.contextMenuListener = event => {
                    const traceOutputString = getTraceOutputString('Result: ', moduleInfo.module.getOutputArray())
                    Prompt.showBigTextArea({title: "Trace Output", text: traceOutputString, readonly: true, noCancel: true});
                };
                traceModuleElement.addEventListener('contextmenu', moduleInfo.contextMenuListener)
                moduleInfo.outputLinesContainerElement = traceModuleElement.getElementsByClassName(`module-output-lines`)[0];

                botInstance.activeModuleInfos.push(moduleInfo);

                const auxillaryFunctions = {
                    duplicateStartBotFromModule: async ({ botGroupName, botName, startFromRow, initialVariables}) => {
                        try {
                            return await duplicateStartBotFromModule({progenitorBot: bot, moduleInfo, botGroupName, botName, startFromRow, initialVariables})
                        } catch (error){
                            moduleInfo.module.finishWithError(`Error spawning @${botGroupName}.${botName}: ${error}`);
                        }
                    },

                    waitForInputInModuleTrace: async (message, inputVariables, okayButtonText, cancelButtonText) => {
                        try {
                            return await waitForInputInModuleTrace({botInstance, moduleInfo, message, inputVariables, okayButtonText, cancelButtonText});
                        } catch (error){
                            moduleInfo.module.finishWithError(`Error: ${error}`);
                        }
                    }
                }
                
                if (selectedBotModuleInfo === correspondingBotModuleInfo 
                && selectedTracker && selectedTracker.uriString === moduleInfo.trackerURIString){
                    if (!moduleInfo.module.isShowingChartOverlays()){
                        moduleInfo.module.showChartOverlays();
                    }
                } else {
                    if (moduleInfo.module.isShowingChartOverlays()){
                        moduleInfo.module.hideChartOverlays();
                    }
                }

                let trackerDerivationLines = [];
                if (moduleInfo.trackerURI === 'CUSTOM'){
                    trackerDerivationLines.push(moduleInfo.customTrackerId);
                    const backendName = moduleInfo.customTrackerBackendName;
                    const trackerIdResult = moduleInfo.module.getEvaluation({expression: moduleInfo.customTrackerId});
                    
                    if (trackerIdResult.error){
                        halt({haltMessage: `Error evaluating custom tracker: ${trackerIdResult.error}`, isError: true});
                        return botRunPromise; //its okay- you can await completed promises 
                    }

                    const trackerId = trackerIdResult.stringValue;
                    const backendIndex = TrackersManager.getBackendIndex(backendName);
                    const tracker = TrackersManager.getTracker(backendIndex, trackerId);
                    if (!tracker){ 
                        const uriString = `${backendIndex}-${trackerId}`;
                        halt({haltMessage: `Could not retrieve tracker ${uriString}`, isError: true});
                        return botRunPromise; //its okay- you can await completed promises
                    }
                    moduleInfo.tracker = tracker
                    for (const derivationLine of trackerIdResult.derivationLines){
                        trackerDerivationLines.push(derivationLine);
                    }
                }

                moduleInfo.entryPrice = moduleInfo.tracker.mostRecentPrice && moduleInfo.tracker.mostRecentPrice.comparator ? Number(moduleInfo.tracker.mostRecentPrice.comparator) : 0;
                moduleInfo.entryPriceFiat = moduleInfo.tracker.mostRecentPrice && moduleInfo.tracker.mostRecentPrice.fiat ? Number(moduleInfo.tracker.mostRecentPrice.fiat) : 0;	
                rowResults[moduleInfo.outerRowIndex].entryPrice = moduleInfo.entryPrice;
                rowResults[moduleInfo.outerRowIndex].entryPriceFiat = moduleInfo.entryPriceFiat;
                return moduleInfo.module.activate(
                    trackerDerivationLines,
                    moduleInfo.tracker,
                    moduleInfo.statementsBefore.value, //moduleInfo.statementsAfter.value is handled by us
                    auxillaryFunctions,
                    previousOuterRowIndex
                );
            }));
            return args
        } catch (error){
            halt({haltMessage: `Uncaught error: ${error}`, isError: true});
            return;
        }

    }

    let isBotPaused = true;
    let args = null;
    let isProcessingModule = false;;
    function togglePause(){
        if (botInstance.halted){
            return;
        }
        if (!isBotPaused){
            isBotPaused = true;
        } else {
            isBotPaused = false;
            if (!isProcessingModule){
                (async () => {
                    while (!botInstance.halted && !isBotPaused){
                        isProcessingModule = true;
                        args = await moduleDone(args);
                        isProcessingModule = false;
                    }
                })();
            }
        }
        return isBotPaused;
    }
    botInstance.togglePause = togglePause;
    botInstance.isPaused = () => isBotPaused;
    
    togglePause();
    
    return botRunPromise;
}







function resolveRowLabelToOuterRowIndex(bot, moduleInfo, label){
    let outerRowIndex;
    let resolveString = `${label}`;
    if (label === 'DEFAULT'){ //should only be used for error gotos
        label = bot.defaultGotoRowOnError
        resolveString += ` (${bot.defaultGotoRowOnError})`;
    }
    
    if (label === 'SELF'){
        outerRowIndex = moduleInfo.outerRowIndex;
    } else if (label === 'NEXT'){
        outerRowIndex = moduleInfo.outerRowIndex + 1;
    } else if (!isNaN(label)){
        outerRowIndex = Number(label);
    } else {
        outerRowIndex = bot.outerRows.map(outerRow => outerRow.rowLabel).indexOf(label);
    }

    if (`${outerRowIndex}` !== `${label}`){
        resolveString += ` (${outerRowIndex})`;
    }

    return {resolveString, outerRowIndex};
}










function getExistingModuleElement(bot, moduleInfo){
    const logicRowsHTML = botIdToLogicRowsHTMLMap.get(bot.id);
    const row = moduleInfo.innerRowIndex === 0 ? 1 : 3;//classes are 1-indexed because css stuff usually is. Row 2 is for links
    const column = moduleInfo.innerColumnIndex + 1;
    const selector = `bot-module-outline row-${row} column-${column}`;
    return logicRowsHTML.children[moduleInfo.outerRowIndex].getElementsByClassName(selector)[0].firstChild;
}


function showModuleListingDescription(type){
    clearSelections(false)
    propertiesTitle.innerText = Util.spacedAtCapitals(type);
}







function setAllowEditingSelectedBotParameters(allowed){
    if (document.getElementById('module-tracker-uri-input')){
        document.getElementById('module-tracker-uri-input').disabled = !allowed;
    }
    for (const input of propertiesContainer.getElementsByClassName("input")){
        input.disabled = !allowed;
    }
}

function setAllowEditingSelectedBotStructure(allowed){
    const selectedBot = botListingToBotMap.get(selectedBotListing);
    for (const removeButton of botIdToLogicRowsHTMLMap.get(selectedBot.id).getElementsByClassName('bot-module-remove-button')){
        if (allowed){
            removeButton.classList.remove('disabled');
        } else {
            removeButton.classList.add('disabled');
        }
        
    }
}






function getBasicBot(name){
    function getInitialModuleInfo(type, trackerURI, outerRowIndex, innerRowIndex, innerColumnIndex){
        return {
            type,
            outerRowIndex,
            innerRowIndex,
            innerColumnIndex,
            trackerURI,
            customTrackerBackendName: '', 
            customTrackerId: '',
            gotoRowOnError: 'DEFAULT',
            isInRaceBlock: false,
            expandedAcrossRaceBlockRow: false,
            customParameters: ScriptModules.modules[type].getDefaultParameters(),
            statementsBefore: {value: '', valid: true},
            statementsAfter: {value: '', valid: true},
            version: ScriptModules.modules[type].VERSION
        }
    }
    const bot = {
        name: name,
        defaultTrackerURI: {backendIndex: null, trackerId: null},
        defaultGotoRowOnError: 'END',
        logToDisk: true,
        id: (idCounter++).toString(), //Important to note: this is unique and stable PER SESSION
        outerRows: [
            {rowLabel: 'START', innerRows: [[getInitialModuleInfo(ScriptModules.TYPES.Start, 'DEFAULT', 0, 0, 0)]]},
            {rowLabel: 'END', innerRows: [[getInitialModuleInfo(ScriptModules.TYPES.End, 'DEFAULT', 1, 0, 0)]]},
        ],
    }
    return bot;
}





botGroupListings.addEventListener("contextmenu", async event => {
    event.preventDefault();
    if (event.target.closest(".listing")){
        //we return here because bot listings have their own context menus
        return;
    } /* else if(copiedBot){
        const result = await ContextMenu.show(["Paste"]);
        if (result === "Paste"){
            const bot = JSON.parse(JSON.stringify(copiedBot));
            addBot(bot)
            window.bridge.saveBot(bot);
            displayBot(bot);            
        }
        return;
    } */
});


function insertLogicRow(bot, outerRowIndex, type){
    const logic = botIdToLogicRowsHTMLMap.get(bot.id);
    const htmlBotRow = Templates.getBotRow();
    htmlBotRow.addEventListener('contextmenu', e => doBotRowContextMenu(e, bot, logic, htmlBotRow));
    const botRowLabel = htmlBotRow.getElementsByClassName('bot-row-label')[0];
    const botRowLabelButton = htmlBotRow.getElementsByClassName('bot-row-label-button')[0];
    if (bot.outerRows[outerRowIndex+1].rowLabel !== 'START' && bot.outerRows[outerRowIndex+1].rowLabel !== 'END') {
        botRowLabel.addEventListener('click', () => doEditRowLabel(bot, logic, htmlBotRow));
        botRowLabelButton.addEventListener('click', () => doEditRowLabel(bot, logic, htmlBotRow));
    }
    
    logic.insertBefore(htmlBotRow, logic.children[outerRowIndex+1]);
    const moduleTemplate = getModuleTemplate(htmlBotRow, type);
    htmlBotRow.getElementsByClassName('bot-row-template-container')[0].appendChild(moduleTemplate);
    if (bot.outerRows[outerRowIndex+1].rowLabel){
        botRowLabelButton.style.visibility = 'collapse';
        htmlBotRow.getElementsByClassName('bot-row-template-container')[0].style.paddingTop = '5px';
        botRowLabel.style.display = 'block';
        botRowLabel.innerText = bot.outerRows[outerRowIndex+1].rowLabel + ':';
    }
    return htmlBotRow;
}



function fixModuleInfosAfterRowInsertDelete(bot, delta, changedOuterRowIndex, deletedRowLabel){
    performFunctionOnAllModuleInfos(bot, (moduleInfo, outerIndex) => {
        if (moduleInfo){
            moduleInfo.outerRowIndex = outerIndex;
            if (moduleInfo.type === ScriptModules.TYPES.GoTo && moduleInfo.customParameters[0].value === deletedRowLabel){
                moduleInfo.customParameters[0].valid = false;
            } 
        }
    })
    
    updateBotRowNumbers(botIdToLogicRowsHTMLMap.get(bot.id));
}

function removeLogicRow(bot, htmlBotRow){
    if (selectedBotModuleInfo){
        const moduleElement = getExistingModuleElement(botListingToBotMap.get(selectedBotListing), selectedBotModuleInfo);
        if (moduleElement.closest('.bot-row') === htmlBotRow){
            clearSelections(false)
        }
    }
    Util.removeElementSafe(htmlBotRow);
}

//func takes moduleInfo, which could be null and returns true if you want the loop to break;
//returns true if cancelled early
function performFunctionOnAllModuleInfos(bot, func){
    for (let i = 0; i < bot.outerRows.length; ++i){
        const outerRow = bot.outerRows[i];
        for (let j = 0; j < outerRow.innerRows.length; ++j){
            const innerRow = outerRow.innerRows[j];
            for (let k = 0; k < innerRow.length; ++k){
                if (func(innerRow[k], i, j, k)){
                    return {moduleInfo: innerRow[k], i, j, k};
                }
            }
        }
    }
}

async function doEditRowLabel(bot, botLogic, htmlBotRow){
    const botGroup = botGroupIdToBotGroup.get(bot.botGroupId);
    for (const botOfGroup of botGroupIdToBotGroup.get(bot.botGroupId).bots){
       if (botIdToBotInstanceMap.get(botOfGroup.id)){
           return;
       }
    }

    const outerRowIndex = Array.prototype.indexOf.call(botLogic.children, htmlBotRow);
    const rowLabels = getRowLabels(bot);//any bot in thie group will do
    const currentValue = bot.outerRows[outerRowIndex].rowLabel;
    const labelResult = await Prompt.showPrompt({
        title: `Edit Row Label`,
        okButtonText: "OK",
        cancelButtonText: "Cancel",
        forceCapitals: true,
        inputInfos: [{
            placeholder: "Leave blank to remove label", 
            initialValue: currentValue ? currentValue : undefined, 
            allowEmpty: true,
            testFunction: t => !t || (isNaN(t) && t.indexOf(' ') < 0 
                                && t.indexOf('<') < 0 && t.indexOf('<') < 0
                                && (t === currentValue || !rowLabels.includes(t)))
        }]
    });
    if (labelResult.okay && labelResult.values[0] !== currentValue){
        const newvalue = labelResult.values[0];
        for (const botOfGroup of botGroup.bots){
            const botOfGroupHTMLRow = botIdToLogicRowsHTMLMap.get(botOfGroup.id).children[outerRowIndex];
            const label = botOfGroupHTMLRow.getElementsByClassName('bot-row-label')[0];
            performFunctionOnAllModuleInfos(botOfGroup, moduleInfo => {
                if (moduleInfo && moduleInfo.type === ScriptModules.TYPES.GoTo){
                    if (moduleInfo.customParameters[0].value === currentValue){
                        moduleInfo.customParameters[0].valid = false;
                    } else if (newvalue && moduleInfo.customParameters[0].value === newvalue){
                        moduleInfo.customParameters[0].valid = true;
                    }
                }
            });
            if (!newvalue){
                botOfGroupHTMLRow.getElementsByClassName('bot-row-label-button')[0].style.visibility = 'visible';
                botOfGroupHTMLRow.getElementsByClassName('bot-row-template-container')[0].style.paddingTop = '10px';
                label.style.display = 'none';
                botOfGroup.outerRows[outerRowIndex].rowLabel = undefined;
            } else {
                botOfGroupHTMLRow.getElementsByClassName('bot-row-label-button')[0].style.visibility = 'collapse';
                botOfGroupHTMLRow.getElementsByClassName('bot-row-template-container')[0].style.paddingTop = '5px';
                label.style.display = 'block';
                label.innerText = newvalue + ':';
                botOfGroup.outerRows[outerRowIndex].rowLabel = newvalue;
            }
        }

        updateBotButtons();
        
        const selectedBot = botListingToBotMap.get(selectedBotListing);
        if (selectedBot){
            if (isShowingBotProperties){
                clearSelections(false);
                showBotProperties(selectedBot);
            } else if (selectedBotModuleInfo){
                showModuleProperties(getExistingModuleElement(selectedBot, selectedBotModuleInfo), selectedBotModuleInfo);
            }
        }
    }
}

async function doBotRowContextMenu(event, bot, botLogic, htmlBotRow){
    event.preventDefault();
    const botGroup = botGroupIdToBotGroup.get(bot.botGroupId);
    if (!botGroup){
        return;
    }
    for (const botOfGroup of botGroup.bots){
        if (botIdToBotInstanceMap.get(botOfGroup.id)){
            return;
        }
    }
    const outerRowIndex = Array.prototype.indexOf.call(botLogic.children, htmlBotRow);

    if (event.target.closest(".bot-module")){//we return here because bot modules have their own context menus
        return;
    } else if (copiedModule && event.target.closest(".bot-module-outline")){
        const moduleOutline = event.target.closest(".bot-module-outline");
        const result = await ContextMenu.show(["Paste Module"]);
        if (result === "Paste Module"){
            /*const moduleInfo = {
                type: copiedModule.type, 
                trackerURI: copiedModule.trackerURI,//deep copied just below
                gotoRowOnError: copiedModule.gotoRowOnError,
                customParameters: copiedModule.customParameters,//deep copied just below
                statementsBefore: copiedModule.statementsBefore,
                statementsAfter: copiedModule.statementsAfter,
            };*/
            for (const botOfGroup of botGroupIdToBotGroup.get(bot.botGroupId).bots){
                const botOfGroupModuleInfo = JSON.parse(JSON.stringify(copiedModule));
                const botOfGroupHTMLRow = botIdToLogicRowsHTMLMap.get(botOfGroup.id).children[outerRowIndex];
                const botOfGroupModuleOutline = botOfGroupHTMLRow.getElementsByClassName(moduleOutline.className)[0];                
                placeAndFillModuleInfo(botOfGroup, botOfGroupHTMLRow, botOfGroupModuleOutline, botOfGroupModuleInfo);
            }
        }
        return;
    }
    
    const options = []; 
    if (outerRowIndex === 0){
        options.push("Insert Single");
        options.push("Insert Race Block");
        if (copiedOuterRow){
            options.push("Paste Row After");
        }
    } else if (outerRowIndex === botLogic.children.length - 1){
        
    } else {
        options.push("Insert Single");
        options.push("Insert Race Block");
        options.push("Copy Row");
        if (copiedOuterRow){
            options.push("Paste Row After");
        }
        options.push("Remove Row");
    }
    
    const result = await ContextMenu.show(options);
    if (result === 'Copy Row'){
        copiedOuterRow = JSON.parse(JSON.stringify(bot.outerRows[outerRowIndex]));
        copiedOuterRow.rowLabel = '';
    } else {
        const rowLabel = bot.outerRows[outerRowIndex].rowLabel;
        for (const botOfGroup of botGroup.bots){
            if (result === 'Insert Single'){
                botOfGroup.outerRows.splice(outerRowIndex+1, 0, {innerRows: [[null]]}); 
                insertLogicRow(botOfGroup, outerRowIndex, 'single');
                fixModuleInfosAfterRowInsertDelete(botOfGroup, +1, outerRowIndex);
            } else if (result === 'Insert Race Block'){
                botOfGroup.outerRows.splice(outerRowIndex+1, 0, {innerRows: [[null, null], [null, null]]}); 
                insertLogicRow(botOfGroup, outerRowIndex, 'raceBlock');
                fixModuleInfosAfterRowInsertDelete(botOfGroup, +1, outerRowIndex);                
            } else if (result === 'Paste Row After'){
                const botOfGroupNewOuterRow = JSON.parse(JSON.stringify(copiedOuterRow));
                
                botOfGroup.outerRows.splice(outerRowIndex+1, 0, botOfGroupNewOuterRow); //comes before insertLogicRow (rowLabels)
                const htmlBotofGroupRow = insertLogicRow(
                    botOfGroup, outerRowIndex, botOfGroupNewOuterRow.innerRows.length > 1 ? 'raceBlock' : 'single'
                );
                for (let j = 0; j < botOfGroupNewOuterRow.innerRows.length; ++j){
                    const innerRow = botOfGroupNewOuterRow.innerRows[j];
                    for (let k = 0; k < innerRow.length; ++k){
                        const row = j == 0 ? 1 : 3;//classes are 1-indexed because css stuff usually is. Row 2 is for links
                        const column = k + 1;
                        const moduleOutline = htmlBotofGroupRow.getElementsByClassName(`bot-module-outline row-${row} column-${column}`)[0];
                        const moduleInfo = innerRow[k];
                        if (moduleInfo){
                            placeAndFillModuleInfo(botOfGroup, htmlBotofGroupRow, moduleOutline, moduleInfo);
                        }
                    }
                }
                fixModuleInfosAfterRowInsertDelete(botOfGroup, +1, outerRowIndex);
            } else if (result === 'Remove Row'){
                botOfGroup.outerRows.splice(outerRowIndex, 1);
                const botOfGroupHTMLRow = botIdToLogicRowsHTMLMap.get(botOfGroup.id).children[outerRowIndex];
                removeLogicRow(botOfGroup, botOfGroupHTMLRow);
                fixModuleInfosAfterRowInsertDelete(botOfGroup, -1, outerRowIndex, rowLabel);
            }
        }
        if (result === 'Paste Row After'){
            copiedOuterRow = null; //yay or nay? Would users want to copy row multiple times? You just need to remove thisi
        }
    }
    if (selectedBotModuleInfo){
        const selectedBot = botListingToBotMap.get(selectedBotListing);
        const moduleElement = getExistingModuleElement(selectedBot, selectedBotModuleInfo);
        showModuleProperties(moduleElement, selectedBotModuleInfo);//calls updateBotButtons
    } else {
        updateBotButtons();
    }
    if (isShowingBotProperties){
        const selectedBot = botListingToBotMap.get(selectedBotListing);
        clearSelections(false);
        showBotProperties(selectedBot);
    }
    
}



function updateBotRowNumbers(logic){
    for (let i = 0; i < logic.children.length; ++i){
        const botRow = logic.children[i];
        botRow.getElementsByClassName('bot-row-number')[0].innerText = i;
    }
}

//does NOT save out the changes because when we remove an entire bot group we don't want to save out
//that bot group for each removed bot as each one is removed
function removeBot(bot){
    if (botIdToSpawnedBots.get(bot.id)){
        const spawnedBots = botIdToSpawnedBots.get(bot.id);
        for (const spawnedBot of spawnedBots){
            removeBot(spawnedBot);
        }
        botIdToSpawnedBots.delete(bot.id);
    }


    const botGroup = botGroupIdToBotGroup.get(bot.botGroupId);
    let botListing;
    for (botListing of botListingToBotMap.keys()){
        if (botListingToBotMap.get(botListing).id === bot.id){
            break;
        }
    }
    if (botListing === selectedBotListing){
        displayBot(null);
    }
    botListingToBotMap.delete(botListing);
    Util.removeElementSafe(botListing);
    if (botGroup){
        Util.removeArrayItemOnce(botGroup.bots, bot);
    }
    
    const botInstance = botIdToBotInstanceMap.get(bot.id);
    if (botInstance){
        botInstance.halt({haltMessage: "Bot Removed", isError: true});
    }
    if (botIdToTraceHTMLMap.get(bot.id)){
        Util.removeElementSafe(botIdToTraceHTMLMap.get(bot.id));
        botIdToTraceHTMLMap.delete(bot.id);
    }
    botIdToBotInstanceMap.delete(bot.id);
    botIdToTimesRun.delete(bot.id);

    Util.removeElementSafe(botIdToLogicRowsHTMLMap.get(bot.id));
    botIdToLogicRowsHTMLMap.delete(bot.id);
}





TrackersManager.emitter.addEventListener(TrackersManager.EVENTS.PRICE_UPDATED, event => {
    let prices = null;
    for (const botInstance of botIdToBotInstanceMap.values()){
        for (const activeModuleInfo of botInstance.activeModuleInfos){
            if (activeModuleInfo.trackerURIString === event.data.uriString){
                if (!prices){
                    prices = {comparator: Number(event.data.price.comparator), fiat: Number(event.data.price.fiat)}
                }
                activeModuleInfo.module.updatePrice(prices);
            }
        }
    }
});
TrackersManager.emitter.addEventListener(TrackersManager.EVENTS.CANDLES_CLOSED, event => {
    for (const botInstance of botIdToBotInstanceMap.values()){
        for (const activeModuleInfo of botInstance.activeModuleInfos){
            activeModuleInfo.module.candlesClosed(event.data);
        }
    }
});
TrackersManager.emitter.addEventListener(TrackersManager.EVENTS.TRACKER_HISTORY_UPDATED, event => {
    for (const botInstance of botIdToBotInstanceMap.values()){
        for (const activeModuleInfo of botInstance.activeModuleInfos){
            if (activeModuleInfo.trackerURIString === event.data.uriString){
                activeModuleInfo.module.historyUpdated();
            }
        }
    }
});

TrackersManager.emitter.addEventListener(TrackersManager.EVENTS.TRACKER_SELECTED, async event => {
    const backendIndex = event.data.backendIndex;
    const trackerId = event.data.trackerId;
    if (selectedTracker && backendIndex === selectedTracker.backendIndex && trackerId === selectedTracker.id){
        return;
    }
    selectedTracker = TrackersManager.getTracker(backendIndex, trackerId);

    if (selectedBotModuleInfo){ 
        const currentDisplayedBot = botListingToBotMap.get(selectedBotListing);
        showModuleProperties(getExistingModuleElement(currentDisplayedBot, selectedBotModuleInfo), selectedBotModuleInfo);
    }
}); 


TrackersManager.emitter.addEventListener(TrackersManager.EVENTS.TRACKER_REMOVED, event => {
    for (const bot of botListingToBotMap.values()){
        performFunctionOnAllModuleInfos(bot, moduleInfo => {
            if (moduleInfo && moduleInfo.trackerURI !== 'DEFAULT' 
            && moduleInfo.trackerURI.backendIndex === event.data.backendIndex 
            && moduleInfo.trackerURI.trackerId === event.data.trackerId){
                moduleInfo.trackerURI.backendIndex = null;
                moduleInfo.trackerURI.trackerId = null;
                const moduleElement = getExistingModuleElement(bot, moduleInfo);
                updateModuleElementTrackerURI(bot, moduleElement, moduleInfo);
            }
        });
    }

    //will show bot properties, so we dont need to deal with finagling any tracker selects. 
    //also updates bot buttons
    if (selectedBotListing){
        displayBot(botListingToBotMap.get(selectedBotListing));
    }
});
TrackersManager.emitter.addEventListener(TrackersManager.EVENTS.TRACKER_ADDED, event => {
    //will show bot properties, so we dont need to deal with finagling any tracker selects. 
    //also updates bot buttons
    if (selectedBotListing){
        displayBot(botListingToBotMap.get(selectedBotListing));
    }
});



function updateModuleElementTrackerURI(bot, moduleElement, moduleInfo){
    if (moduleInfo.trackerURI === 'CUSTOM'){
        moduleElement.getElementsByClassName('tracker-uri')[0].innerText = "CUSTOM";
    } else if (moduleInfo.trackerURI === 'DEFAULT'){
        moduleElement.getElementsByClassName('tracker-uri')[0].innerText = "DEFAULT";
    } else {
        const tracker = TrackersManager.getTracker(moduleInfo.trackerURI.backendIndex, moduleInfo.trackerURI.trackerId);
        if (tracker){
            moduleElement.getElementsByClassName('tracker-uri')[0].innerText = tracker.uriSignature;
        } else {
            moduleElement.getElementsByClassName('tracker-uri')[0].innerText = '---';
        }
    }
}



function displayBot(bot){
    clearSelections();
    if (!bot || !botIdToTraceHTMLMap.has(bot.id)){
        hideBotTrace();
    }

    runPauseBotButton.innerText = 'Run';
    stopBotButton.disabled = true;
    
    if (bot){
        if (botIdToTraceHTMLMap.has(bot.id)){
            botIdToTraceHTMLMap.get(bot.id).style.display = 'flex';
        }
        botIdToLogicRowsHTMLMap.get(bot.id).style.display = 'flex';

        showBotProperties(bot);
        
        let canEditBotStructure = true;
        if (bot.botGroupId === -1){
            canEditBotStructure = false;
        } else {
            for (const botOfGroup of botGroupIdToBotGroup.get(bot.botGroupId).bots){
                const botInstance = botIdToBotInstanceMap.get(botOfGroup.id);
                if (botInstance){
                    canEditBotStructure = false;
                    break;
                }
            }
        }
        setAllowEditingSelectedBotStructure(canEditBotStructure);
        setAllowEditingSelectedBotParameters(bot.botGroupId !== -1 && !botIdToBotInstanceMap.get(bot.id));
        if (botIdToBotInstanceMap.has(bot.id)){
            stopBotButton.disabled = false;
            const botInstance = botIdToBotInstanceMap.get(bot.id);
            if (botInstance.isPaused()){
                runPauseBotButton.innerText = 'Resume';
            } else {
                runPauseBotButton.innerText = 'Pause Next';
            }
        }       
    }
    updateBotButtons();
    emitter.emitEvent('botSelected');
}



//this shows the bot's name input in the properties window - not to be confused with displayBot (which actually calls this function)
//make sure you clear selections or at least clear the inspector elements before calling this
function showBotProperties(bot){
    let botListing;
    for (botListing of botListingToBotMap.keys()){
        if (botListingToBotMap.get(botListing).id === bot.id){
            break;
        }
    }
    selectedBotListing = botListing;
    isShowingBotProperties = true;
    botListing.classList.add('selected');

    const trackerURIStringToSignature = TrackersManager.getTrackerURIStringToTrackerURISignature(); 

    function updateTitle(){
        if (bot.botGroupId !== -1){
            let botGroup;
            for (const potentialBotGroup of botGroupIdToBotGroup.values()){
                if (potentialBotGroup.bots.includes(bot)){
                    botGroup = potentialBotGroup;
                    break;
                }
            }
            logicPaneBotName.innerText = `${botGroup.name}.${bot.name}`;
        } else {
            logicPaneBotName.innerText = bot.name;
        }
        
        logicPaneBotTracker.innerText = '';
        const uriString = `${bot.defaultTrackerURI.backendIndex}-${bot.defaultTrackerURI.trackerId}`;
        if (trackerURIStringToSignature[uriString]){
            logicPaneBotTracker.innerText = ` (${trackerURIStringToSignature[uriString]})`;
        }

    }
    updateTitle();
    
    const rowOptions = getRowLabels(bot);
    Util.removeArrayItemOnce(rowOptions, 'DEFAULT');
    Util.removeArrayItemOnce(rowOptions, 'SELF');
    
    propertiesContainer.append(Templates.getPropertiesParametersGrid(
        null, null, [
            {name: 'name', value: bot.name, type: 'text'},
            {name: 'defaultTracker', label: 'Default Tracker', value: bot.defaultTrackerURI, type: 'select', options: trackerURIStringToSignature},
            {name: 'defaultErrorGoto', label: 'Default Error Goto', value: bot.defaultGotoRowOnError, type: 'select', options: rowOptions},
            {name: 'logToDisk', label: 'Log To Disk', value: bot.logToDisk, type: 'boolean'},
        ])
    ); 


    const nameInput = propertiesContainer.getElementsByClassName('name input')[0];
    nameInput.addEventListener('change', e => {
        let botListing
        for (botListing of botListingToBotMap.keys()){
            if (botListingToBotMap.get(botListing) === bot){
                break;
            }
        }
        const newName = nameInput.value;
        if (newName.length){
            bot.name = newName;
            botListing.getElementsByClassName('bot-name')[0].innerText = bot.name;
            updateTitle();
            nameInput.blur();
            shiftBotListingToAlphabeticalPosition(bot, botListing, botListing.parentNode);
        } else {
            nameInput.value = bot.name
        }
    });

    const trackerInput = propertiesContainer.getElementsByClassName('defaultTracker input')[0];
    if (bot.defaultTrackerURI.backendIndex === null){
        trackerInput.value = null;
    } else {
        const uriString = `${bot.defaultTrackerURI.backendIndex}-${bot.defaultTrackerURI.trackerId}`;
        trackerInput.value = uriString;
    }
    trackerInput.addEventListener('change', event => {
        let [backendIndex, trackerId] = trackerInput.value ? trackerInput.value.split('-') : [null, null];
        if (backendIndex !== null){
            backendIndex = Number(backendIndex);
        }
        bot.defaultTrackerURI = {backendIndex, trackerId};
        updateTitle();
        updateBotButtons();
    });

    const gotoRowOnErrorInput = propertiesContainer.getElementsByClassName('defaultErrorGoto input')[0];
    if (!rowOptions.includes(bot.defaultGotoRowOnError)){
        bot.defaultGotoRowOnError = 'END';
        gotoRowOnErrorInput.value = bot.defaultGotoRowOnError;
    }
    gotoRowOnErrorInput.addEventListener('change', e => {
        bot.defaultGotoRowOnError = gotoRowOnErrorInput.value;
    });

    const logToDiskInput = propertiesContainer.getElementsByClassName('logToDisk input')[0];
    logToDiskInput.addEventListener('change', e => {
        bot.logToDisk = logToDiskInput.checked;
    });


    if (botIdToBotInstanceMap.get(bot.id)){
        for (const input of propertiesContainer.getElementsByClassName("input")){
            input.disabled = true;
        }
    }
}








function getModuleTemplate(htmlBotRow, type){
    const moduleTemplate = type === 'single' ? Templates.getSingleModuleTemplate() : Templates.getRaceBlockModuleTemplate();

    const moduleOutlines = moduleTemplate.getElementsByClassName('bot-module-outline');
    for (let moduleOutlineIndex = 0; moduleOutlineIndex < moduleOutlines.length; ++moduleOutlineIndex){
        const moduleOutline = moduleOutlines[moduleOutlineIndex];

        moduleOutline.addEventListener('dragenter', event => {
            if ((draggedLogicModuleInfo || draggedModuleListingIndex !== null) && !moduleOutline.children.length){
                event.preventDefault();
                moduleOutline.classList.add('drop-okay');
            }
        });
        moduleOutline.addEventListener('dragleave', event => {
            moduleOutline.classList.remove('drop-okay');
        });

        moduleOutline.addEventListener('dragover', event => {
            if ((draggedLogicModuleInfo || draggedModuleListingIndex !== null) && !moduleOutline.children.length){
                event.preventDefault();
            }
        });

        moduleOutline.addEventListener('drop', event => {
            moduleOutline.classList.remove('drop-okay');
            let moduleInfo;
            let script;
            if (draggedModuleListingIndex !== null){
                script = moduleListingIndexToScript[draggedModuleListingIndex];
                let type;
                for (type of Object.keys(ScriptModules.TYPES)){
                    if (ScriptModules.modules[type] === script){
                        break;
                    }
                }
                moduleInfo = {
                    type, trackerURI: 'DEFAULT', gotoRowOnError: 'DEFAULT', customParameters: script.getDefaultParameters(),
                    customTrackerBackendName: '', customTrackerId: '',
                    statementsBefore: {value: '', valid: true}, statementsAfter: {value: '', valid: true}, version: script.VERSION
                };
            } else {           
                moduleInfo = {...draggedLogicModuleInfo};
                script = ScriptModules.modules[moduleInfo.type];
            }
            const selectedBot = botListingToBotMap.get(selectedBotListing);

            for (const botOfGroup of botGroupIdToBotGroup.get(selectedBot.botGroupId).bots){
                let copyOfModuleInfo;
                if (moduleInfo.hasOwnProperty('outerRowIndex')){
                    const {outerRowIndex, innerRowIndex, innerColumnIndex} = moduleInfo;
                    const botOfGroupmoduleInfo = botOfGroup.outerRows[outerRowIndex].innerRows[innerRowIndex][innerColumnIndex];
                    copyOfModuleInfo = JSON.parse(JSON.stringify(botOfGroupmoduleInfo));
                } else {
                    copyOfModuleInfo = JSON.parse(JSON.stringify(moduleInfo));
                }
                const botOfGroupLogic = botIdToLogicRowsHTMLMap.get(botOfGroup.id);
                //get the index of the event's bot's htmlRow in the event's bot's logic
                const outerRowIndex = Array.prototype.indexOf.call(botIdToLogicRowsHTMLMap.get(selectedBot.id).children, htmlBotRow);
                const botOfGroupHTMLRow = botOfGroupLogic.children[outerRowIndex];
                const botOfGroupModuleOutlines = botOfGroupHTMLRow.getElementsByClassName('bot-module-outline');
                const botOfGroupModuleOutline = botOfGroupModuleOutlines[moduleOutlineIndex];
                placeAndFillModuleInfo(botOfGroup, botOfGroupHTMLRow, botOfGroupModuleOutline, copyOfModuleInfo);
            }

            if (draggedLogicModuleElement){
                removeModule(selectedBot, draggedLogicModuleElement, draggedLogicModuleInfo);
                draggedLogicModuleElement = null;
                draggedLogicModuleInfo = null;
            }
        });
    }
    return moduleTemplate;
}




//moduleInfo must have type, trackerURI and customParameters
function placeAndFillModuleInfo(bot, htmlBotRow, moduleOutline, moduleInfo){

    const script = ScriptModules.modules[moduleInfo.type];
    
    const moduleOutlines = moduleOutline.closest(".module-template").getElementsByClassName('bot-module-outline');
    let moduleOutlineIndex;
    for (moduleOutlineIndex = 0; moduleOutlineIndex < moduleOutlines.length; ++moduleOutlineIndex){
        if (moduleOutlines[moduleOutlineIndex] === moduleOutline){
            break;
        } 
    }

    let isInRaceBlock = moduleOutlines.length > 1;
    let expandedAcrossRaceBlockRow = false; //worked out below
    let outerRowIndex = Array.prototype.indexOf.call(botIdToLogicRowsHTMLMap.get(bot.id).children, htmlBotRow);
    let innerRowIndex = moduleOutline.classList.contains('row-1') ? 0 : 1; //class names are 1-indexed
    let innerColumnIndex = moduleOutline.classList.contains('column-1') ? 0 : 1; //class names are 1-indexed
    if (isInRaceBlock){
        if (moduleOutlineIndex === 0 && script.getResultKeys().length === 2 && !bot.outerRows[outerRowIndex].innerRows[innerRowIndex][1]){
            expandedAcrossRaceBlockRow = true;
             htmlBotRow.getElementsByClassName(`bot-module-outline row-1 column-2`)[0].style.display = 'none';
        }
    }
    moduleInfo.isInRaceBlock = isInRaceBlock;
    moduleInfo.expandedAcrossRaceBlockRow = expandedAcrossRaceBlockRow;
    moduleInfo.outerRowIndex = outerRowIndex;
    moduleInfo.innerRowIndex = innerRowIndex;
    moduleInfo.innerColumnIndex = innerColumnIndex;

    bot.outerRows[outerRowIndex].innerRows[innerRowIndex][innerColumnIndex] = moduleInfo;
    
    const moduleElement = Templates.getModule();
    moduleElement.setAttribute('module-type', moduleInfo.type);
    if (moduleInfo.type !== ScriptModules.TYPES.Start && moduleInfo.type !== ScriptModules.TYPES.End){
        moduleElement.addEventListener('contextmenu', async event => {
            event.preventDefault();
            const result = await ContextMenu.show(["Copy Module"]);
            if (result === 'Copy Module'){
                copiedModule = JSON.parse(JSON.stringify(moduleInfo));
            }
        });
    }

    if (expandedAcrossRaceBlockRow){
        const outputLayer = Templates.getModuleMultiOutputLayer(script.getResultKeys());
        moduleElement.appendChild(outputLayer);
    }
    moduleOutline.append(moduleElement)
    initModuleHTML(bot, moduleElement, moduleInfo);  
    if (bot === botListingToBotMap.get(selectedBotListing)){
        showModuleProperties(moduleElement, moduleInfo); //updates bot buttons
    }
}



function initModuleHTML(bot, moduleElement, moduleInfo){
    let removeButton = moduleElement.getElementsByClassName('bot-module-remove-button')[0];
    const script = ScriptModules.modules[moduleInfo.type];
    const parameters = moduleInfo.customParameters;
    const codedTitle = script.getTitle(parameters).split('<br>').map(titleLine => Util.htmlEncode(titleLine)).join('<br>');
    moduleElement.getElementsByClassName('bot-module-info-container')[0].firstElementChild.innerHTML = codedTitle;
    
    if (moduleInfo.type === ScriptModules.TYPES.Start || moduleInfo.type === ScriptModules.TYPES.End){
        Util.removeElementSafe(removeButton);
        removeButton = null;
    } 
    updateModuleElementTrackerURI(bot, moduleElement, moduleInfo);
    
    
    moduleElement.addEventListener('click', e => {
        let trackerURI = moduleInfo.trackerURI;
        if (moduleInfo.trackerURI === 'CUSTOM'){
            
        } else if (!moduleInfo.trackerURI || moduleInfo.trackerURI === 'DEFAULT'){
            trackerURI = bot.defaultTrackerURI;
        } 
        if (trackerURI){
            const uriString = `${trackerURI.backendIndex}-${trackerURI.trackerId}`;
            if (moduleInfo === selectedBotModuleInfo && selectedTracker && uriString === selectedTracker.uriString){
                return;
            }
        }
        showModuleProperties(moduleElement, moduleInfo);
        
        const tracker = TrackersManager.getTracker(trackerURI.backendIndex, trackerURI.trackerId);
        if (tracker !== selectedTracker){
            TrackersManager.selectTracker(tracker);
        }
        const script = ScriptModules.modules[moduleInfo.type];
        if (script.PARAM_INDEX_FOR_CHART_DURATION_KEY !== undefined){
            const durationKey = moduleInfo.customParameters[script.PARAM_INDEX_FOR_CHART_DURATION_KEY].value;
            if (Chart.getBarDuration() !== durationKey){
                Chart.setBarDuration(durationKey);
            }
        }
    })
    if (removeButton){
        removeButton.addEventListener('click', e=> {
            if (removeButton.classList.contains('disabled')){
                return;
            }
            const selectedBot = botListingToBotMap.get(selectedBotListing);
            removeModule(selectedBot, moduleElement, moduleInfo); 
            updateBotButtons();
            e.cancelBubble = true 
        });
    }

    if (moduleInfo.type !== ScriptModules.TYPES.Start && moduleInfo.type !== ScriptModules.TYPES.End){
        moduleElement.addEventListener('dragstart', event => {
            showModuleProperties(moduleElement, moduleInfo);

            const botGroup = botGroupIdToBotGroup.get(bot.botGroupId);
            if (!botGroup){
                return;
            }
            for (const botOfGroup of botGroup.bots){
                if (botIdToBotInstanceMap.get(botOfGroup.id)){
                    return;
                }
            }

            draggedLogicModuleElement = moduleElement;
            draggedLogicModuleInfo = moduleInfo;
            event.dataTransfer.effectAllowed = "move";

            const selectedBot = botListingToBotMap.get(selectedBotListing);
            if (ScriptModules.modules[moduleInfo.type].getResultKeys().length === 2){
                const logicRowsHTML = botIdToLogicRowsHTMLMap.get(selectedBot.id);
                for (const botRow of logicRowsHTML.children){
                    const row1ModuleOutlines = botRow.getElementsByClassName('row-1');
                    if (row1ModuleOutlines.length === 2 
                    &&  !row1ModuleOutlines[0].children.length
                    &&  !row1ModuleOutlines[1].children.length){
                        row1ModuleOutlines[1].style.display = 'none';
                    }
                }
            }
        });

        moduleElement.addEventListener('dragend', event => {
            draggedLogicModuleElement = null;
            draggedLogicModuleInfo = null;
            const selectedBot = botListingToBotMap.get(selectedBotListing);
            if (ScriptModules.modules[moduleInfo.type].getResultKeys().length === 2){
                const logicRowsHTML = botIdToLogicRowsHTMLMap.get(selectedBot.id);
                for (const botRow of logicRowsHTML.children){
                    const row1ModuleOutlines = botRow.getElementsByClassName('row-1');
                    if (row1ModuleOutlines.length === 2 
                    &&  !row1ModuleOutlines[0].children.length
                    &&  !row1ModuleOutlines[1].children.length){
                        row1ModuleOutlines[1].style.display = 'flex';
                    }
                }
            }
        });
    }
}




function getRowLabels(bot){
    const options =['DEFAULT', 'SELF', 'NEXT'];
    for (let i = 0; i < bot.outerRows.length; ++i){
        if (bot.outerRows[i].rowLabel){
            options.push(bot.outerRows[i].rowLabel)
        }
    }
    for (let i = 0; i < bot.outerRows.length; ++i){
        options.push(i.toString());
    }
    return options;
}


//assumes a bot is selected
//should always be passed the bot's module info, not a bot instance's.
let showModulePropertiesIndex = 0; //required because this function awaits
async function showModuleProperties(moduleElement, moduleInfo){
    clearSelections(false);
    const thisShowModulePropertiesIndex = ++showModulePropertiesIndex;
    const script = ScriptModules.modules[moduleInfo.type];
    const currentDisplayedBot = botListingToBotMap.get(selectedBotListing);
    const botInstance = botIdToBotInstanceMap.get(currentDisplayedBot.id);
    if (botInstance){
        for (const activeModuleInfo of botInstance.activeModuleInfos){
            if (selectedTracker && selectedTracker.uriString === activeModuleInfo.trackerURIString
            && activeModuleInfo.outerRowIndex === moduleInfo.outerRowIndex
            && activeModuleInfo.innerRowIndex === moduleInfo.innerRowIndex
            && activeModuleInfo.innerColumnIndex === moduleInfo.innerColumnIndex){
                activeModuleInfo.module.showChartOverlays();
            } 
        }
    }

    selectedBotModuleInfo = moduleInfo;
    getExistingModuleElement(currentDisplayedBot, selectedBotModuleInfo).classList.add('showing-properties')

    propertiesTitle.innerText = Util.spacedAtCapitals(moduleInfo.type);
    const parameters = moduleInfo.customParameters;
    
    let botRow = moduleElement.closest('.bot-row');
    const outerRowIndex = Array.prototype.indexOf.call(botRow.closest('.bot-logic').children, botRow);
    const numOuterRows = botRow.closest('.bot-logic').children.length;
    
    const trackerURIStringToSignature = {CUSTOM: 'CUSTOM', DEFAULT: 'DEFAULT'};
    const trackerURIStringToSignatures = TrackersManager.getTrackerURIStringToTrackerURISignature(script.RESTRICT_TO_TRACKER_TYPES);
    for (const key of Object.keys(trackerURIStringToSignatures)){
        trackerURIStringToSignature[key] = trackerURIStringToSignatures[key];
    }
    let trackerInputInitialValue;
    if (moduleInfo.trackerURI === 'CUSTOM'){
        trackerInputInitialValue = 'CUSTOM'
    } else if (moduleInfo.trackerURI === 'DEFAULT'){
        trackerInputInitialValue = 'DEFAULT'
    } else {
        trackerInputInitialValue = `${moduleInfo.trackerURI.backendIndex}-${moduleInfo.trackerURI.trackerId}`;
    }
    const errorGotoOptions = getRowLabels(currentDisplayedBot);
    const gotoOptions = getRowLabels(currentDisplayedBot);
    Util.removeArrayItemOnce(gotoOptions, 'DEFAULT');

    let backendNames;
    if (script.RESTRICT_TO_TRACKER_TYPES){
        backendNames = script.RESTRICT_TO_TRACKER_TYPES;
    } else {
        backendNames = TrackersManager.getBackendNames();
    }
    if (!backendNames.includes(moduleInfo.customTrackerBackendName)){
        moduleInfo.customTrackerBackendName = backendNames[0];
    }

    const advancedParameters = [
        {name: 'Tracker', value: trackerInputInitialValue, type: 'select', advanced: true, options: trackerURIStringToSignature},
        {name: 'customTrackerBackend', label: 'Backend', value: moduleInfo.customEndpointName, type: 'select', advanced: true, options: backendNames},
        {name: 'customTrackerID', label: 'Tracker ID', value: moduleInfo.customTrackerId, type: 'text', advanced: true},
        {name: 'Error Goto', value: 'DEFAULT', type: 'select', advanced: true, options: errorGotoOptions},
        {name: 'statementsBefore', value: moduleInfo.statementsBefore.value, type: 'textArea',  advanced: true, placeholder: ''},
        {name: 'statementsAfter',  value: moduleInfo.statementsAfter.value, type: 'textArea',  advanced: true, placeholder: ''}
    ];

    const staticOptions = {};
    for (const parameter of parameters){
        if (parameter.type === 'select' && typeof parameter.options === 'string'){
            if (moduleInfo.type === ScriptModules.TYPES.GoTo && parameter.name === 'goto'){
                staticOptions[parameter.options] = gotoOptions;
            } else {
                staticOptions[parameter.options] = script[parameter.options];
            }
        }
    }

    propertiesContainer.append(Templates.getPropertiesParametersGrid(
        script, ScriptModuleCommon.database, advancedParameters.concat(parameters), staticOptions
    ));
    setAllowEditingSelectedBotParameters(currentDisplayedBot.botGroupId !== -1 && !botIdToBotInstanceMap.get(currentDisplayedBot.id));
    
    const customTrackerBackendInput = propertiesContainer.getElementsByClassName('input customTrackerBackend')[0];
    const customTrackerIDInput = propertiesContainer.getElementsByClassName('input customTrackerID')[0];
    const setCustomTrackerIDVisibility = (visible) => {
        const elements = [...propertiesContainer.getElementsByClassName('customTrackerID')];
        elements.push(...propertiesContainer.getElementsByClassName('customTrackerBackend'))
        for (const element of elements){
            if (!visible){
                element.classList.add('forceInvisible');
                element.style.display = 'none';
            } else {
                element.classList.remove('forceInvisible');
                if (propertiesContainer.getElementsByClassName('Tracker input')[0].style.display !== 'none'){
                    element.style.display = 'flex';
                }
            }
            
        }
    }
    if (trackerInputInitialValue !== 'CUSTOM'){
        setCustomTrackerIDVisibility(false);
    }
    customTrackerBackendInput.addEventListener('change', () => moduleInfo.customTrackerBackendName = customTrackerBackendInput.value);
    customTrackerIDInput.addEventListener('change', () => {
        customTrackerIDInput.value = customTrackerIDInput.value.trim();
        moduleInfo.customTrackerId = customTrackerIDInput.value;
        if (ScriptModuleCommon.validateExpression({expression: customTrackerIDInput.value, allowEmpty: false})){
            customTrackerIDInput.classList.remove('input-invalid');
        } else {
            customTrackerIDInput.classList.add('input-invalid');
            updateBotButtons();
        }
    });

    let tracker;
    const trackerInput = propertiesContainer.getElementsByClassName('Tracker input')[0];
    if (botIdToBotInstanceMap.get(currentDisplayedBot.id)){
        trackerInput.disabled = true;
    }   
    trackerInput.value = null;
    if (moduleInfo.trackerURI === 'CUSTOM'){
        trackerInput.value = 'CUSTOM'
    } else if (moduleInfo.trackerURI === 'DEFAULT'){
        trackerInput.value = 'DEFAULT'
    } else {
        const uriString = `${moduleInfo.trackerURI.backendIndex}-${moduleInfo.trackerURI.trackerId}`;
        if (Object.keys(trackerURIStringToSignature).includes(uriString)){
            trackerInput.value = uriString;
        } 
    }
    trackerInput.addEventListener('change', () => {trackerInputChanged(); updateBotButtons()});
    function trackerInputChanged(){
        let trackerURI;
        if (trackerInput.value === 'CUSTOM'){
            moduleInfo.trackerURI = 'CUSTOM';
            trackerURI = 'CUSTOM';
            setCustomTrackerIDVisibility(true);
        } else if (trackerInput.value === 'DEFAULT'){
            setCustomTrackerIDVisibility(false);
            moduleInfo.trackerURI = 'DEFAULT';
            const defaultTracker = TrackersManager.getTracker(currentDisplayedBot.defaultTrackerURI.backendIndex, currentDisplayedBot.defaultTrackerURI.trackerId); 
            if (!defaultTracker || (script.RESTRICT_TO_TRACKER_TYPES 
            && !script.RESTRICT_TO_TRACKER_TYPES.includes(ScriptModuleCommon.getBackendName(defaultTracker.backendIndex)))){
                trackerURI = {backendIndex: null, trackerId: null};
            } else {
                trackerURI = currentDisplayedBot.defaultTrackerURI;
            }
        } else {
            setCustomTrackerIDVisibility(false);
            let [backendIndex, trackerId] = trackerInput.value ? trackerInput.value.split('-') : [null, null];
            if (backendIndex !== null){
                backendIndex = Number(backendIndex);
            }
            moduleInfo.trackerURI = {backendIndex, trackerId};
            trackerURI = moduleInfo.trackerURI;
        }
        
        updateModuleElementTrackerURI(currentDisplayedBot, moduleElement, moduleInfo);

        if (trackerURI === 'CUSTOM'){
            trackerInput.classList.remove('input-invalid');
            tracker = {
                id: 'CUSTOM',
                tokenSymbol: 'TOKEN',
                comparatorSymbol: 'COMPARATOR',
                tokenDecimals: 10,
                comparatorDecimals: 10
            }
        } else {
            tracker = TrackersManager.getTracker(trackerURI.backendIndex, trackerURI.trackerId);
        }

        
        if (tracker){
            trackerInput.classList.remove('input-invalid');
            //if no tracker, the params might not reflect NO tracker but it doesn't matter because the whole module's invalid
            script.handleTrackerChanged(parameters, {outerRowIndex, numOuterRows, tracker});
            const codedTitle = script.getTitle(parameters).split('<br>').map(titleLine => Util.htmlEncode(titleLine)).join('<br>');
            moduleElement.getElementsByClassName('bot-module-info-container')[0].firstElementChild.innerHTML = codedTitle;
            checkModuleParameters(parameters);
        } else {
            trackerInput.classList.add('input-invalid');
        } 
    }

    const errorGotoInput = propertiesContainer.getElementsByClassName('Error Goto input')[0];
    if (botIdToBotInstanceMap.get(currentDisplayedBot.id)){
        errorGotoInput.disabled = true;
    }   
    errorGotoInput.value = moduleInfo.gotoRowOnError;
    errorGotoInput.addEventListener('change', () => {
        moduleInfo.gotoRowOnError = errorGotoInput.value;
        if (!errorGotoOptions.includes(moduleInfo.gotoRowOnError)){
            errorGotoInput.classList.add('input-invalid');
        } else {
            errorGotoInput.classList.remove('input-invalid');
        }
        updateBotButtons();
    });
    if (!errorGotoOptions.includes(errorGotoInput.value)){
        errorGotoInput.classList.add('input-invalid');
    }

    
    function statementsChanged(parameterName, input, shouldUpdateBotButtons){
        moduleInfo[parameterName].value = input.value.trim();
        moduleInfo[parameterName].valid = ScriptModuleCommon.validateStatements(moduleInfo[parameterName].value, true);
        if (moduleInfo[parameterName].valid){
            input.classList.remove('input-invalid');
        } else {
            input.classList.add('input-invalid');
        }
        if (shouldUpdateBotButtons){
            updateBotButtons();
        }
    }
    let statementsNonEmpty = false;
    for (const parameterName of ['statementsBefore', 'statementsAfter']){
        const statementInput = propertiesContainer.getElementsByClassName(parameterName + ' input')[0];
        statementInput.addEventListener('change', e => statementsChanged(parameterName, statementInput, true));
        statementInput.addEventListener('contextmenu', async () => {
            const result = await Prompt.showBigTextArea({title: Util.spacedAtCapitals(parameterName, true), text: statementInput.value});
            if (result.okay){
                statementInput.value = result.text;
                statementsChanged(parameterName, statementInput, true);
            }
        })
        statementInput.addEventListener('change', e => statementsChanged(parameterName, statementInput, true));
        statementsChanged(parameterName, statementInput, false);
        statementsNonEmpty = statementsNonEmpty || statementInput.value.trim();
    }


    const changeHandler = async (changedInput, parameterIndex) => {
        if (parameters[parameterIndex].type === 'boolean'){
            parameters[parameterIndex].value = changedInput.checked;
        } else if (parameters[parameterIndex].type === 'select'){
            parameters[parameterIndex].value = changedInput.value ? changedInput.value : null;
        } else {
            parameters[parameterIndex].value = changedInput.value;
        }
        await script.updateParameterMetaSettings(parameters, parameterIndex, {outerRowIndex, numOuterRows, tracker, gotoOptions});
        
        const codedTitle = script.getTitle(parameters).split('<br>').map(titleLine => Util.htmlEncode(titleLine)).join('<br>');
        moduleElement.getElementsByClassName('bot-module-info-container')[0].firstElementChild.innerHTML = codedTitle;
        changedInput.blur();
        if (thisShowModulePropertiesIndex !== showModulePropertiesIndex){
            return;
        }
        checkModuleParameters(parameters);
         
    }

    for (const fileButton of propertiesContainer.getElementsByClassName('file-parameter-button')){
        const parameterName = fileButton.getAttribute('parameterName');
        const inputElement = propertiesContainer.getElementsByClassName(`${parameterName} input`)[0];
        let parameterIndex = 0;
        for (; parameterIndex < moduleInfo.customParameters.length; ++parameterIndex){
            if (moduleInfo.customParameters[parameterIndex].name === parameterName){
                break;
            }
        }
        fileButton.addEventListener('click', async () => {
            const filePath = await window.bridge.showFileDialogue({
                type: 'save',
                title: "Select file...",
                buttonLabel: "Select",
            });
            if (filePath){
                inputElement.value = filePath;
                changeHandler(inputElement, parameterIndex);
            }

        });
    }


    for (const manageButton of propertiesContainer.getElementsByClassName('manage-select-parameter-button')){
        manageButton.addEventListener('click', async e => {
            const parameterName = manageButton.getAttribute('parameterName');
            let parameterIndex = 0;
            for (; parameterIndex < moduleInfo.customParameters.length; ++parameterIndex){
                if (moduleInfo.customParameters[parameterIndex].name === parameterName){
                    break;
                }
            }
            const parameter = moduleInfo.customParameters[parameterIndex];
            const key = parameter.key;
            const currentValue =  parameter.value;
            const {lastSelectedItem, cancelled} = await ScriptModuleCommon.databaseFrontEnd.show(key, currentValue);
            const toSelectValue = (cancelled || !lastSelectedItem) ? parameter.value : lastSelectedItem;

            const selectElement = propertiesContainer.getElementsByClassName(`${parameterName} input`)[0];
            selectElement.innerHTML = '';
            let wasSelected = false;
            if (parameter.allowNull){
                const option = Templates.getOption(null, '<none>'); //html encoding happens in Templates
                selectElement.appendChild(option);
                if (toSelectValue === null){
                    selectElement.value = option.value;
                    wasSelected = true;
                }
            }
            for (const item of Object.keys(ScriptModuleCommon.database[key])){
                const option = Templates.getOption(item, item);
                selectElement.appendChild(option);
                if (item === toSelectValue){
                    selectElement.value = option.value;
                    wasSelected = true;
                }
            }
            if (!wasSelected){
                selectElement.value = null;
            }
            //could be '' and null which means the same thing: none chosen
            const changed = (parameter.value || selectElement.value) && parameter.value !==  selectElement.value;
            changeHandler(selectElement, parameterIndex);
            if (changed){
                const label = propertiesContainer.getElementsByClassName(`${parameterName} label`)[0].innerText.slice(0, -1);
                Prompt.showMessage({title: "Selection Updated", message:`${label} has been updated.`})
            }
        });
    }
    
    toggleShowAdvancedPropertiesOff();
    //we await to allow modules' updateParameterMetaSettings the option of calling backend (e.g. to fill select options)
    //hence we start with all input.value to null and advanced props off- it's better to start from blank slate for that frame or two
    trackerInputChanged();
    const promises = [];
    for (let parameterIndex = 0; parameterIndex < parameters.length; ++parameterIndex){
        const parameter = parameters[parameterIndex];
        const input = propertiesContainer.getElementsByClassName(`${parameter.name} input`)[0];
        input.value = null;
        promises.push(script.updateParameterMetaSettings(parameters, parameterIndex, {outerRowIndex, numOuterRows, tracker, gotoOptions}));
        
        input.addEventListener('change', e => changeHandler(input, parameterIndex));
        if (botIdToBotInstanceMap.get(currentDisplayedBot.id)){
            input.disabled = true;
        }

        if (input.type === 'textarea' || input.type === 'text'){
            input.addEventListener('contextmenu', async () => {
                const result = await Prompt.showBigTextArea({title: Util.spacedAtCapitals(parameter.name, true), text: input.value});
                if (result.okay){
                    input.value = result.text;
                    changeHandler(input, parameterIndex);
                }
            })
        }
    }
    
    await Promise.all(promises);
    if (thisShowModulePropertiesIndex !== showModulePropertiesIndex){
        return;
    }
    const codedTitle = script.getTitle(parameters).split('<br>').map(titleLine => Util.htmlEncode(titleLine)).join('<br>');
    moduleElement.getElementsByClassName('bot-module-info-container')[0].firstElementChild.innerHTML = codedTitle;
    checkModuleParameters(parameters);
    if ((trackerInput.value !== 'CUSTOM' && trackerInput.value !== 'DEFAULT') || errorGotoInput.value !== 'DEFAULT'
    || trackerInput.classList.contains('input-invalid') || errorGotoInput.classList.contains('input-invalid')
    || statementsNonEmpty){
        toggleShowAdvancedPropertiesOn();
    } else {
        toggleShowAdvancedPropertiesOff();
    }
    showAdvancedPropertiesToggle.style.display = 'flex';
}



function checkModuleParameters(parameters){
    for (let i = 0; i < parameters.length; ++i){
        const parameter = parameters[i];
        const input = propertiesContainer.getElementsByClassName(`${parameter.name} input`)[0];
        if (!input){
            console.trace();
        }
        if (parameter.type === 'boolean'){
            input.checked = parameter.value;
        } else if (parameter.type === 'select'){
            if (parameter.optionsHaveChanged){
                parameter.optionsHaveChanged = false;
                input.innerHTML = '';
                let selected = null;
                for (const item of parameter.options){
                    const option = document.createElement('option');
                    option.value = item;
                    option.innerText = item;
                    input.appendChild(option);
                    if (item === parameter.value){
                        selected = item;
                    }
                }
                input.value = selected;
            } else {
                input.value = parameter.value;
            }
        } else {
            input.value = parameter.value;
            if (typeof parameter.placeholder === 'string'){
                input.placeholder = parameter.placeholder;
            }
        }

        for (const element of propertiesContainer.getElementsByClassName(`${parameter.name}`)){
            if (!element.classList.contains('hidden-file-input')){
                element.style.display = parameter.visible ? 'flex' : 'none';
            }
            
        }

        if (parameter.valid){
            input.classList.remove('input-invalid');
        } else {
            input.classList.add('input-invalid');
        }
    }

    updateBotButtons();
}




//does not update bot buttons
function removeModule(bot, moduleElement, moduleInfo){
    for (const botOfGroup of botGroupIdToBotGroup.get(bot.botGroupId).bots){
        const botOfGroupmoduleInfo = botOfGroup.outerRows[moduleInfo.outerRowIndex].innerRows[moduleInfo.innerRowIndex][moduleInfo.innerColumnIndex];
        const botOfGroupmoduleElement = getExistingModuleElement(botOfGroup, botOfGroupmoduleInfo);
        
        const moduleOutline = botOfGroupmoduleElement.closest('.bot-module-outline');
    
        
        if (selectedBotModuleInfo && selectedBotModuleInfo === botOfGroupmoduleInfo){
            clearSelections(false);
        }
        Util.removeElementSafe(botOfGroupmoduleElement);
        for (const child of moduleOutline.closest('.bot-module-guide-cells').children){
            child.style.display = 'flex';
        }
        botOfGroup.outerRows[moduleInfo.outerRowIndex].innerRows[moduleInfo.innerRowIndex][moduleInfo.innerColumnIndex] = null;

    }
}
 




function updateBotButtons(){
    runPauseBotButton.disabled = true;
    stopBotButton.disabled = true;
    showBotTraceButton.classList.add('disabled');
    const selectedBot = botListingToBotMap.get(selectedBotListing);
    if (selectedBot){
        stopBotButton.disabled = !botIdToBotInstanceMap.has(selectedBot.id);
        showBotTraceButton.classList.remove('disabled');
        if (selectedBot.botGroupId === -1){
            runPauseBotButton.disabled = !botIdToBotInstanceMap.has(selectedBot.id);
            return;
        }
        const errorGotoOptions = getRowLabels(selectedBot);
        let atLeastOneError = false;
        const cancelledEarlyInfo = performFunctionOnAllModuleInfos(selectedBot, (moduleInfo, i, j, k) => {
            if (!moduleInfo){
                if (j === 0 && k === 1 && selectedBot.outerRows[i].innerRows[j][0]?.expandedAcrossRaceBlockRow){
                    return;
                } else {
                    atLeastOneError = true;
                    return;
                }
            }

            const moduleElement = getExistingModuleElement(selectedBot, moduleInfo);

            if (!errorGotoOptions.includes(moduleInfo.gotoRowOnError)){
                moduleElement.classList.add('input-invalid');
                atLeastOneError = true;
                return;
            }

            if (!moduleInfo.statementsBefore.valid || !moduleInfo.statementsAfter.valid){
                moduleElement.classList.add('input-invalid');
                atLeastOneError = true;
                return;
            }

            
            if (moduleInfo.trackerURI === 'CUSTOM'){

            } else {
                let trackerURI;
                if (moduleInfo.trackerURI === 'DEFAULT'){
                    const script = ScriptModules.modules[moduleInfo.type];
                    const defaultTracker = TrackersManager.getTracker(selectedBot.defaultTrackerURI.backendIndex, selectedBot.defaultTrackerURI.trackerId); 
                    if (script.RESTRICT_TO_TRACKER_TYPES 
                    && !script.RESTRICT_TO_TRACKER_TYPES.includes(ScriptModuleCommon.getBackendName(defaultTracker.backendIndex))){
                        trackerURI = {backendIndex: null, trackerId: null};
                    } else {
                        trackerURI = selectedBot.defaultTrackerURI;
                    }
                } else {
                    trackerURI =  moduleInfo.trackerURI
                }
                if (!TrackersManager.getTracker(trackerURI.backendIndex, trackerURI.trackerId)){
                    moduleElement.classList.add('input-invalid');
                    atLeastOneError = true;
                    return;
                }
            }

            if (moduleInfo.customParameters.some(parameter => !parameter.valid && parameter.visible)){
                moduleElement.classList.add('input-invalid');
                atLeastOneError = true;
                return;
            }
            
            moduleElement.classList.remove('input-invalid');

        });
        if (!atLeastOneError){
            runPauseBotButton.disabled = false;
        }
    }
}


