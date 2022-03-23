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

const promptFrame = document.getElementById("prompt-frame");
const promptMessage = document.getElementById("prompt-message");
const promptTitle = document.getElementById("prompt-title");
const promptInputsContainer = document.getElementById("prompt-inputs-container");
const promptOKButton = document.getElementById("prompt-ok-button");
const preambleBlocker = document.getElementById("pre-themed-blocker");

let _inputs;

let currentPromiseResolver;


async function generalCallbackHandler(event, args){
    if (event === 'theme-ready'){
        if (args){
            for (const variable of Object.keys(args)){
                const value = args[variable];
                document.documentElement.style.setProperty(variable, value);

                if (variable === '--line-colour-a'){
                    const threeQuarters =  value.slice(0, 7) + 'BE';
                    document.documentElement.style.setProperty('--line-colour-a-three-quarters', threeQuarters);
                    const half =  value.slice(0, 7) + '90';
                    document.documentElement.style.setProperty('--line-colour-a-half', half);
                    const oneQuarter =  value.slice(0, 7) + '60';
                    document.documentElement.style.setProperty('--line-colour-a-one-quarter', oneQuarter);
                } 
            }
        }

        preambleBlocker.classList.add('botchi-animate-opacity-out');
        preambleBlocker.classList.add('invisible-to-mouse')
    }
}
window.bridge.setGeneralCallback(generalCallbackHandler);








export async function showMessage({title, message, okButtonText, textAlign}){
    promptOKButton.disabled = false;
    promptFrame.style.display = 'flex';
    promptInputsContainer.innerHTML = "";
    promptTitle.innerText = title || "Alert";
    promptMessage.innerHTML = message || "";
    promptMessage.style.textAlign = textAlign ? textAlign : "center";
    promptOKButton.style.display = 'block';
    promptOKButton.innerText = okButtonText || "OK";
    
    
    promptOKButton.focus();

    return makePromise();
}


function makePromise(){
    return new Promise(function (resolve, reject) {
        const cancel = function(ev){
            if (!ev.key || ev.key === 'Escape'){
                promptFrame.style.display = 'none';
                currentPromiseResolver = null
                resolve({okay: false, values: null});
                document.removeEventListener('keyup', cancel);
                document.removeEventListener('keyup', ok);
            } 
        }
        document.addEventListener('keyup', cancel);

        const ok = function(ev){
            if (promptOKButton.disabled){
                return;
            }
            if (!ev.key || ev.key === 'Enter'){
                promptFrame.style.display = 'none';
                const values = [];
                for (const child of promptInputsContainer.children){
                    values.push(child.value);
                }
                currentPromiseResolver= null;
                resolve({okay: true, values});
                document.removeEventListener('keyup', cancel);
                document.removeEventListener('keyup', ok);

            }
        }
        document.addEventListener('keyup', ok);

        promptOKButton.addEventListener("click", ok, {once: true});
    });
}






































const passwordFrame = document.getElementById("password-frame");
const passwordModal = document.getElementById("password-modal");

const passwordTitleBar = document.getElementById("password-title-bar");
const passwordInfoBox = document.getElementById("password-info-box");

const passwordInput1 = document.getElementById("password-input-1");
const passwordDoneButton = document.getElementById('password-done-button');


passwordDoneButton.addEventListener('click', () => passwordDone());
passwordModal.addEventListener("mousedown", ev => ev.stopPropagation());
passwordFrame.addEventListener("mousedown", ev => ev.stopPropagation());

showPasswordFrame({
    title: "Password Required",
    infoHTML: "A password is required to bring back the main window."
});





export async function passwordDone(){
    passwordDoneButton.disabled = true;
    const passwordIsCorrect = await window.bridge.checkPassword(passwordInput1.value);
    if (!passwordIsCorrect){
        await showMessage({
            title: "Incorrect Password",
            message: "The password entered is incorrect."
        });
        passwordDoneButton.disabled = false;
        passwordInput1.focus();
        passwordInput1.select()
        return null;
    }
    const password = passwordInput1.value;
    passwordInput1.value = '';

    window.bridge.passwordWindowResult(password);
} 



export async function showPasswordFrame({title, infoHTML}){
    passwordDoneButton.disabled = false;
    passwordTitleBar.innerText = title;
    passwordInfoBox.style.textAlign = "center";
    if (infoHTML){
        passwordInfoBox.innerHTML = infoHTML;
        passwordInfoBox.style.display = 'box';
    } else {
        passwordInfoBox.style.display = 'none';
    }
    passwordFrame.style.display = 'flex';
    passwordInput1.focus();
 
}





let passwordEnterPressed;
document.addEventListener('keydown', async event => {
    if (event.key === 'Enter'){
        if (!passwordDoneButton.disabled && document.activeElement === passwordInput1){
            passwordEnterPressed = true;
            return;
        }
    }
    passwordEnterPressed = false;
})
document.addEventListener('keyup', async event => {
    if (event.key === 'Enter'){
        if (passwordEnterPressed && !passwordDoneButton.disabled && document.activeElement === passwordInput1){
            passwordEnterPressed = false;
            passwordDone();
            return;
        }
        passwordEnterPressed = false;
    }
})



