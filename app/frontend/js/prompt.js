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
import * as Util from './util.js';
import * as ContextMenu from './context-menu.js';

const promptFrame = document.getElementById("prompt-frame");
const promptModal = document.getElementById('prompt-modal');
const promptMessage = document.getElementById("prompt-message");
const promptTitle = document.getElementById("prompt-title");
const promptBigTextareaContainer = document.getElementById("prompt-big-textarea-container");
const promptBigTextarea = document.getElementById("prompt-big-textarea");
const promptInputsContainer = document.getElementById("prompt-inputs-container");
const promptOKButton = document.getElementById("prompt-ok-button");
const promptCancelButton = document.getElementById("prompt-cancel-button");



let _inputs;


export async function showPrompt({title, inputInfos, message, okButtonText, cancelButtonText, textAlign, forceCapitals}){
    _inputs = [];
    
    promptInputsContainer.innerHTML = "";
    if (inputInfos){
        for (const inputInfo of inputInfos){
            const placeholder = inputInfo.placeholder;
            const testFunction = inputInfo.testFunction;
            const input = Templates.getPromptInput(placeholder);
            _inputs.push({placeholder, testFunction, input, allowEmpty: inputInfo.allowEmpty});
            promptInputsContainer.appendChild(input);
            if (inputInfo.initialValue){
                input.value = inputInfo.initialValue;
            }
            input.addEventListener('input', () => {if (forceCapitals){input.value = input.value.toUpperCase();} runCheck();});
        }
    }

    promptBigTextareaContainer.style.display = 'none';
    promptInputsContainer.style.display = 'flex';
    
    promptTitle.innerText = title || "Input Requested";
    promptMessage.innerText = message || "";
    promptMessage.style.display = message ? 'flex' : 'none';
    promptMessage.style.textAlign = textAlign ? textAlign : "left";
    promptMessage.style.justifyContent = textAlign ? textAlign : "center";
    promptOKButton.style.display = 'block';
    promptOKButton.innerText = okButtonText || "OK";
    promptCancelButton.style.display = 'block';
    promptCancelButton.innerText = cancelButtonText || "Cancel";
    

    runCheck();
    promptFrame.style.display = 'flex';
    if (promptInputsContainer.children.length){
        promptInputsContainer.children[0].focus();
    }
   
    return makePromise();
}


function runCheck() {
    let failed = false;
    for (const inputInfo of _inputs){
        if (!inputInfo.allowEmpty && !inputInfo.input.value){
            failed = true;
        } else if (inputInfo.testFunction && !inputInfo.testFunction(inputInfo.input.value)){
            failed = true;
            inputInfo.input.classList.add('input-invalid');
        } else {
            inputInfo.input.classList.remove('input-invalid');
        }
    }
    
    promptOKButton.disabled = failed;
}


export async function showMessage({title, message, okButtonText, textAlign, messageIsHTML}){
    promptBigTextareaContainer.style.display = 'none';
    promptInputsContainer.style.display = 'flex';

    promptOKButton.disabled = false;
    promptFrame.style.display = 'flex';
    promptInputsContainer.innerHTML = "";
    promptTitle.innerText = title || "Alert";
    if (messageIsHTML){
        promptMessage.innerHTML = message || "";
    } else {
        promptMessage.innerHTML = Util.htmlEncode(message) || "";
    }
    
    for (const anchor of promptMessage.getElementsByTagName('a')){
        anchor.addEventListener('click', event => {
            window.bridge.openURL(anchor.getAttribute('href'));
        })
    }
    promptMessage.style.display = message ? 'block' : 'none';
    promptMessage.style.textAlign = textAlign ? textAlign : "center";
    promptMessage.style.justifyContent = textAlign ? textAlign : "center";
    promptOKButton.style.display = 'block';
    promptOKButton.innerText = okButtonText || "OK";
    promptCancelButton.style.display = 'none';
    
    
    promptOKButton.focus();

    return makePromise();
}




function makePromise(){
    const isBigTextEditor = promptBigTextareaContainer.style.display !== 'none';
    return new Promise(function (resolve, reject) {
        const cancel = function(ev){
            if (!ev.key || ev.key === 'Escape'){
                promptFrame.style.display = 'none';
                if (isBigTextEditor){
                    resolve({okay: false, text: ''});
                } else {
                    resolve({okay: false, values: ''});
                }
                document.removeEventListener('keyup', cancel);
                document.removeEventListener('keyup', ok);
            } 
        }
        document.addEventListener('keyup', cancel);
        promptFrame.addEventListener("mousedown", event => {
            if (!promptCancelButton.disabled && !event.target.closest('.shaded-panel')){
                cancel({ev: {key:'Escape'}});
            }
        }); 

        const ok = function(ev){
            if (promptOKButton.disabled){
                return;
            }
            if (!ev.key || (!isBigTextEditor && ev.key === 'Enter')){
                promptFrame.style.display = 'none';
                if (isBigTextEditor){
                    resolve({okay: true, text: promptBigTextarea.value});
                } else {
                    const values = [];
                    for (const child of promptInputsContainer.children){
                        values.push(child.value);
                    }
                    resolve({okay: true, values});
                }
                document.removeEventListener('keyup', cancel);
                document.removeEventListener('keyup', ok);

            }
        }
        document.addEventListener('keyup', ok);

        promptOKButton.addEventListener("click", ok, {once: true});
        promptCancelButton.addEventListener("click", cancel, {once: true});
    });
}



export async function showBigTextArea({title, message, textAlign, text, noCancel, okButtonText, cancelButtonText, readonly}){
    promptBigTextareaContainer.style.display = 'flex';
    promptInputsContainer.style.display = 'none';

    promptOKButton.innerText = okButtonText || "OK";
    promptCancelButton.innerText = cancelButtonText || "Cancel";

    promptOKButton.style.display = 'block';
    promptCancelButton.style.display = noCancel ? 'none' :'block';

    promptTitle.innerText = title || "Big Text Editor";
    promptMessage.style.display = message ? 'flex' : 'none';
    promptMessage.innerText = message || "";
    promptMessage.style.textAlign = textAlign ? textAlign : "center";
    promptMessage.style.justifyContent = textAlign ? textAlign : "center";

    promptBigTextarea.value = text; 
    if (readonly){   
        promptBigTextarea.setAttribute("readonly", true);
    } else {
        promptBigTextarea.removeAttribute("readonly");
    }
    
    promptFrame.style.display = 'flex';
    promptBigTextarea.focus();
    promptBigTextarea.scrollTop = 0;

    return makePromise();
}






























const selectManagerFrame = document.getElementById("select-manager-frame");
const selectManagerModal = document.getElementById("select-manager-modal");
const selectManagerTitleBar = document.getElementById("select-manager-title-bar");

const selectManagerItemSelect = document.getElementById("select-manager-item-select");
const selectManagerItemNameInput = document.getElementById("select-manager-item-name-input");

const selectManagerFieldsSection = document.getElementById('select-manager-fields-section');

const selectManagerDoneButton = document.getElementById('select-manager-done-button');
const selectManagerCancelButton = document.getElementById('select-manager-cancel-button');
const selectManagerRemoveButton = document.getElementById('select-manager-remove-button');
const selectManagerSaveAddButton = document.getElementById('select-manager-save-button');
let selectManagerInputInfos;
let selectManagerCurrentDatabase;
let selectManagerInfoToSave;
let selectManagerPromiseResolver;
let selectManagerSelectedItem;
let selectManagerNonEditableItems;
let atLeastOneCreated;
    
selectManagerItemSelect.addEventListener('change', selectManagerItemSelected);
function selectManagerItemSelected(){
    selectManagerItemNameInput.value = selectManagerItemSelect.value.trim();
    if (selectManagerItemNameInput.value){
        for (const key of Object.keys(selectManagerCurrentDatabase[selectManagerItemNameInput.value])){
            const matchingElement = document.getElementById(`select-manager-input-${key}`);
            if (matchingElement){
                if (matchingElement.getAttribute('type') === 'checkbox'){
                    matchingElement.checked = selectManagerCurrentDatabase[selectManagerItemNameInput.value][key];
                } else {

                }matchingElement.value = selectManagerCurrentDatabase[selectManagerItemNameInput.value][key];
                
            }
        }
    }
    selectManagerItemNameChanged();
}

selectManagerItemNameInput.addEventListener('input', selectManagerItemNameChanged);
function selectManagerItemNameChanged(){
    const value = selectManagerItemNameInput.value.trim();
    if (value && Array.from(selectManagerItemSelect.options).some(option => option.value === value)){
        selectManagerSaveAddButton.innerText = "Update";
        selectManagerItemSelect.value = value;
        selectManagerSelectedItem = value;
        if (!selectManagerNonEditableItems || !selectManagerNonEditableItems.includes(value)){
            for (const input of selectManagerFieldsSection.getElementsByClassName('select-manager-input-field')){
                input.disabled = false;
            }
            selectManagerRemoveButton.disabled = false;
        } else {
            for (const input of selectManagerFieldsSection.getElementsByClassName('select-manager-input-field')){
                input.disabled = true;
            }
            selectManagerRemoveButton.disabled = true;
        }
    } else {
        selectManagerSaveAddButton.innerText = "Add";
        selectManagerItemSelect.value = null;
        selectManagerSelectedItem = null;
        for (const input of selectManagerFieldsSection.getElementsByClassName('select-manager-input-field')){
            input.disabled = false;
        }
        selectManagerRemoveButton.disabled = true; 
    }
    selectManagerHandleInputChanged();
}

function selectManagerHandleInputChanged(){
    let okToSave = true;
    const itemNameValue = selectManagerItemNameInput.value.trim();
    if (!itemNameValue){
        okToSave = false;
    }

    const toSave = {};

    if (okToSave){
        for (const inputInfo of selectManagerInputInfos){
            const input = document.getElementById(`select-manager-input-${inputInfo.key}`);
            let value = input.getAttribute('type') === 'checkbox' ? input.checked : input.value;
            const testResult = inputInfo.test ?  inputInfo.test(value) : {valid: true, cleaned: value};
            if (!testResult.valid){
                okToSave = false;
            } else {
                toSave[inputInfo.key] = testResult.cleaned;
            }
        }
    }

    if (okToSave && selectManagerCurrentDatabase[itemNameValue]){
        if (!Object.keys(toSave).some(field => toSave[field] !== selectManagerCurrentDatabase[itemNameValue][field])){
            okToSave = false; //no need- they're all the same
        } else {
            console.log('here', toSave, selectManagerCurrentDatabase[itemNameValue]);
        }
    }

    if (okToSave){
        selectManagerSaveAddButton.disabled = false;
        selectManagerInfoToSave = toSave;
    } else {
        selectManagerInfoToSave = null;
        selectManagerSaveAddButton.disabled = true;
    }
}


selectManagerSaveAddButton.addEventListener('click', () => {
    selectManagerSelectedItem = selectManagerItemNameInput.value.trim();
    selectManagerCurrentDatabase[selectManagerSelectedItem] = selectManagerInfoToSave;
    selectManagerSaveAddButton.disabled = true;
    atLeastOneCreated = true;
    //selectManagerItemNameChanged();
    refreshItemKeys();
});


selectManagerRemoveButton.addEventListener('click', async () => {
    const currentItem = selectManagerItemNameInput.value.trim();
    if (selectManagerCurrentDatabase[currentItem]){
        const result = await showPrompt({
            title: `Are you sure?`,
            message: `Remove ${currentItem}?`,
            okButtonText: "Remove",
            cancelButtonText: "Cancel",
            textAlign: 'center'
        });
        if (result.okay){
            delete selectManagerCurrentDatabase[currentItem];
            selectManagerSelectedItem = null;
            refreshItemKeys();
            if (!selectManagerSelectedItem){
                selectManagerItemNameInput.value = currentItem;
                selectManagerHandleInputChanged();
            }
        }
    }
});



function refreshItemKeys(){
    selectManagerItemSelect.innerHTML = '';
    const keys = Object.keys(selectManagerCurrentDatabase);
    keys.sort();
    for (const item of keys){
        const option = Templates.getOption(item, item);
        selectManagerItemSelect.appendChild(option);
        if (selectManagerSelectedItem && item === selectManagerSelectedItem){
            option.selected = true;
        }
    }
    selectManagerItemSelected();
}

selectManagerCancelButton.addEventListener('click', () => hideSelectManager(true))
selectManagerDoneButton.addEventListener('click', () => hideSelectManager(false));
selectManagerModal.addEventListener("mousedown", ev => ev.stopPropagation());
selectManagerFrame.addEventListener("mousedown", () => hideSelectManager(true));
export async function hideSelectManager(cancelled=false){
    if (selectManagerPromiseResolver && !cancelled && !selectManagerSaveAddButton.disabled){
        const action = selectManagerSelectedItem ? 'updating' : 'adding';
        const result = await showPrompt({
            title: `Are you sure?`,
            message: `Exit without ${action} ${selectManagerItemNameInput.value.trim()}?`,
            okButtonText: "Yes",
            cancelButtonText: "Go Back",
            textAlign: 'center'
        });
        if (!result.okay){
            return;
        }
    }

    selectManagerFrame.style.display = 'none';
    const currentSelected = selectManagerSelectedItem;
    selectManagerInputInfos = [];
    selectManagerCurrentDatabase = {};
    selectManagerInfoToSave = null;
    selectManagerSelectedItem = null;
    selectManagerNonEditableItems = null;
    
    if (selectManagerPromiseResolver){
        selectManagerPromiseResolver({lastSelectedItem:currentSelected, cancelled, atLeastOneCreated});
        selectManagerPromiseResolver = null;
    }
}







//inputInfos = [{label, placeholder, key, test},...]
//test is a function (string) => {valid: boolean, cleaned: string}
export async function showSelectManager({title, inputInfos, selectedItem, database, nonEditableItems}){
    selectManagerSelectedItem = database[selectedItem] ? selectedItem : null;
    selectManagerNonEditableItems = nonEditableItems;
    atLeastOneCreated = false;
    selectManagerFrame.style.display = 'flex';
    selectManagerTitleBar.innerText = title;

    selectManagerInputInfos = inputInfos;
    selectManagerCurrentDatabase = database;

    selectManagerFieldsSection.innerHTML = '';
    for (const inputInfo of selectManagerInputInfos){
        const {label, input, eyeIcon} = Templates.getInput({
            inputId: `select-manager-input-${inputInfo.key}`,
            labelString: inputInfo.label,
            inputPlaceholder: inputInfo.placeholder,
            inputType: inputInfo.type ? inputInfo.type : 'text'
        });
        selectManagerFieldsSection.appendChild(label);
        selectManagerFieldsSection.appendChild(input);
        input.classList.add('select-manager-input-field');
        input.addEventListener('input', selectManagerHandleInputChanged);
        input.addEventListener('change', selectManagerHandleInputChanged);
        if (eyeIcon){
            selectManagerFieldsSection.appendChild(eyeIcon);
            Util.wireEyeIconToDiv(eyeIcon, input);
        } else {
            const div = document.createElement('div');
            selectManagerFieldsSection.appendChild(div);
        }
    }

    refreshItemKeys();

    selectManagerItemNameInput.focus();

    if (!selectManagerPromiseResolver){
        return new Promise((resolve, reject) => {
            selectManagerPromiseResolver = resolve;
        });
    }

}






























const passwordFrame = document.getElementById("password-frame");
const passwordModal = document.getElementById("password-modal");
const passwordTitleBar = document.getElementById("password-title-bar");
const passwordInfoBox = document.getElementById("password-info-box");

const passwordInput1 = document.getElementById("password-input-1");
const passwordLabel2 = document.getElementById("password-label-2");
const passwordInput2 = document.getElementById("password-input-2");
const [passwordInput1EyeIcon, passwordInput2EyeIcon] = passwordModal.getElementsByClassName('eye-icon-container');
for (const eyeDiv of [passwordInput1EyeIcon, passwordInput2EyeIcon]){
    Util.wireEyeIconToDiv(eyeDiv, eyeDiv === passwordInput1EyeIcon ? passwordInput1 : passwordInput2);
}

const passwordDoneButton = document.getElementById('password-done-button');
const passwordcancelButton = document.getElementById('password-cancel-button');


let passwordPromiseResolver;
let passwordFrameType;

passwordInput1.addEventListener('input', event => {
    checkPasswordFields();
});
passwordInput2.addEventListener('input', event => {
    checkPasswordFields();
});
function checkPasswordFields(){
    passwordDoneButton.disabled = !(passwordInput2.style.display === 'none' || passwordInput1.value === passwordInput2.value);
}

passwordDoneButton.addEventListener('click', () => passwordDone(false));
passwordModal.addEventListener("mousedown", ev => ev.stopPropagation());
passwordFrame.addEventListener("mousedown", () => passwordDone(true));
passwordcancelButton.addEventListener("click", () => passwordDone(true));

export async function passwordDone(cancelled){
    if (passwordcancelButton.disabled && cancelled){
        return;
    }
    passwordcancelButton.disabled = true;
    passwordDoneButton.disabled = true;
    if (!cancelled && passwordFrameType === PASSWORD_FRAME_TYPES.REQUIRE){
        const passwordIsCorrect = await window.bridge.checkPassword(passwordInput1.value);
        if (!passwordIsCorrect){
            await showMessage({
                title: "Incorrect Password",
                message: "The password entered is incorrect."
            });
            passwordDoneButton.disabled = false;
            passwordcancelButton.disabled = passwordFrameType !== PASSWORD_FRAME_TYPES.RESET;
            passwordInput1.focus();
            passwordInput1.select()
            return null;
        }
    }
    passwordFrame.style.display = 'none';   
    const password = passwordInput1.value;
    passwordInput1.value = '';
    passwordInput2.value = ''; 
    if (passwordPromiseResolver){
        const resolver = passwordPromiseResolver;
        passwordPromiseResolver = null;
        resolver(cancelled ? null : password);
    }
} 


export const PASSWORD_FRAME_TYPES = {
    REQUIRE: "REQUIRE",
    RESET: "RESET"
}

export function isPasswordFrameShowing(){
    return passwordFrame.style.display === 'flex';
}

export async function showPasswordFrame({type, title, infoHTML}){
    passwordDoneButton.disabled = false;
    passwordFrameType = type;
    passwordTitleBar.innerText = title;
    passwordInfoBox.style.textAlign = 'center';
    if (infoHTML){
        passwordInfoBox.innerHTML = infoHTML;
        passwordInfoBox.style.display = 'box';
    } else {
        passwordInfoBox.style.display = 'none';
    }
    passwordcancelButton.disabled = type !== PASSWORD_FRAME_TYPES.RESET;
    passwordInput2.style.display = 'none';
    passwordLabel2.style.display = 'none';
    passwordInput2EyeIcon.style.display = 'none';
    if (type === PASSWORD_FRAME_TYPES.RESET){
        passwordInput2.style.display = 'flex';
        passwordLabel2.style.display = 'flex';
        passwordInput2EyeIcon.style.display = 'flex';
    }

    for (const input of [passwordInput1, passwordInput2]){
        if (input.type !== 'password'){
            (input === passwordInput1 ? passwordInput1EyeIcon : passwordInput2EyeIcon).click();
        }
    }

    passwordFrame.style.display = 'flex';
    passwordInput1.focus();
    
    if (!passwordPromiseResolver){
        return new Promise((resolve, reject) => {
            passwordPromiseResolver = resolve;
        });
    }

    
}






let passwordEnterPressed;
document.addEventListener('keydown', async event => {
    if (event.key === 'Enter'){
        if (passwordFrame.style.display !== 'none' 
        && !passwordDoneButton.disabled
         && document.activeElement === passwordInput1 || document.activeElement === passwordInput2){
            passwordEnterPressed = true;
            return;
        }
    }
    passwordEnterPressed = false;
})
document.addEventListener('keyup', async event => {
    if (event.key === 'Enter'){
        if (passwordEnterPressed 
        && passwordFrame.style.display !== 'none' && !passwordDoneButton.disabled
        && document.activeElement === passwordInput1 || document.activeElement === passwordInput2){
            passwordEnterPressed = false;
            passwordDone();
            return;
        }
        passwordEnterPressed = false;
    } else if (event.key === 'Escape' && passwordFrame.style.display !== 'none' && !passwordcancelButton.disabled){
        passwordDone(true);
    }
    
})

