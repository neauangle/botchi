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

const crypto = require('crypto');
const util = require('util');

const STRING_ENCODING = 'base64'; //I dont know why, but deciphering utf8 doesnt work...

const SALT_WHEN_NO_SALT = Buffer.from([]);
const IV_WHEN_NO_IV = Buffer.from("00000000000000000000000000000000", 'hex');// IV is always 16-bytes

//inclusive
function nonCryptoRandomIntInclusive(min : number, max : number) {  
    return Math.floor(
        Math.random() * (max - min + 1) + min
    )
}

function randomBase64String(length: number) {  
    return crypto.randomBytes(length).toString('base64').slice(0, length);
}


//generates a set of random keys
async function generateRSAKeys() : Promise<{publicKey: string, privateKey: string}> {
    const options = {
        modulusLength: 1024 * 2,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
        }
    }
    
    return util.promisify(crypto.generateKeyPair)('rsa', options);    
}

async function getHash(cleartext: string){
    return crypto.createHash('sha256').update(cleartext).digest('hex');
} 

async function encryptStringRSA(cleartext: string, publicKeyString: string, asBytes=false) : Promise<Buffer | string> {
    const options = { 
        key: publicKeyString,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
    }
    const result = await crypto.publicEncrypt(options, Buffer.from(cleartext, STRING_ENCODING));
    if (!asBytes){
        return result.toString(STRING_ENCODING); 
    }
    return result;
}


async function decryptStringRSA(encryptedJsonString: string, privateKeyString: string) : Promise<string> {
    const encryptedJsonBytes = Buffer.from(encryptedJsonString, STRING_ENCODING);
    const options = {
        key: privateKeyString,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
    }
    const bytes = await crypto.privateDecrypt(options, encryptedJsonBytes);
    console.log('resultin: ', bytes);
    return bytes.toString(STRING_ENCODING);
}



async function encryptJSONObjectRSA(jsonObject: object, publicKeyString: string, asBytes=false) : Promise<Buffer | string> {
    const jsonString = JSON.stringify(jsonObject);
    return encryptStringRSA(jsonString, publicKeyString, asBytes);
}
    
async function decryptJSONObjectRSA(encryptedJsonString: string, privateKeyString: string) : Promise<object> {
    const jsonString = await decryptStringRSA(encryptedJsonString, privateKeyString);
    let jsonObject = JSON.parse(jsonString);
    //https://stackoverflow.com/questions/42494823/json-parse-returns-string-instead-of-object
    while (typeof jsonObject === 'string'){
        jsonObject = JSON.parse(jsonObject);
    }
    return jsonObject;
}





//generates a symmetric key from a password
//if not salted, it will be salted with SALT_WHEN_NO_SALT which is, at least, a constant
function generateAESKey(password: string, salted=false, asBytes=false) : {key: Buffer | string, salt: Buffer | string} {
    let salt = salted? crypto.randomBytes(8): SALT_WHEN_NO_SALT;
    let key = crypto.pbkdf2Sync(password, salt, 1000, 256/8, 'sha256');
    if (!asBytes){
        key = key.toString(STRING_ENCODING); 
        salt = salt.toString(STRING_ENCODING); 
    }
    return {key: key, salt: salt};
}


function generateRandomAESKey(salted=true, asBytes=false){
    const password = crypto.randomBytes(256).toString('ascii');
    return generateAESKey(password, salted, asBytes);
}

//if not ived, it will be salted with IV_WHEN_NO_IV which is, at least, a constant
function encryptStringAES(plaintext: string, keyBytes: Buffer, ived=false, returnBytes=false): {iv: Buffer | string, cipher: Buffer | string} {
    const initializationVectorBytes = ived? crypto.randomBytes(16) : IV_WHEN_NO_IV; 

    const cipher = crypto.createCipheriv('aes-256-cbc', keyBytes, initializationVectorBytes);
    let ciphered = cipher.update(plaintext, 'utf8', STRING_ENCODING);
    ciphered += cipher.final(STRING_ENCODING);
    return {
        iv: returnBytes ? initializationVectorBytes : initializationVectorBytes.toString(STRING_ENCODING),
        'cipher': returnBytes ? Buffer.from(ciphered, STRING_ENCODING) : ciphered,
    }
}

function decryptStringAES(cipher: string, keyBytes: Buffer, initializationVectorBytes=IV_WHEN_NO_IV) : string{
    const cipheredBytes = Buffer.from(cipher, STRING_ENCODING);
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBytes, initializationVectorBytes);
    let deciphered = decipher.update(cipheredBytes, STRING_ENCODING, 'utf-8');
    deciphered += decipher.final('utf8');
    return deciphered
}


function encryptJSONObjectAES(jsonObject: object, keyBytes: Buffer, ived=false, returnBytes=false): {iv: Buffer | string, cipher: Buffer | string} {
    const jsonString = JSON.stringify(jsonObject);
    return encryptStringAES(jsonString, keyBytes, ived, returnBytes);
}

function decryptJSONObjectAES(cipher: string, keyBytes: Buffer, initializationVectorBytes=IV_WHEN_NO_IV) : object {
    const decryptedString = decryptStringAES(cipher, keyBytes, initializationVectorBytes); 
    let json = JSON.parse(decryptedString);
    //https://stackoverflow.com/questions/42494823/json-parse-returns-string-instead-of-object
    while (typeof json === 'string'){
        json = JSON.parse(json);
    }
    return json;
}

function isValidPublicKey(keyString: string) : boolean {
    try {
        crypto.createPublicKey(keyString);
    } catch {
        return false;
    }
    return true;
}

function isValidPrivateKey(keyString: string) : boolean {
    try {
        crypto.createPrivateKey(keyString);
    } catch {
        return false;
    }
    return true;
}



function signRSA(dataString: string, rsaPrivateKey: string, returnBytes=false){
    const options = {
        key: rsaPrivateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    }
    let signature = crypto.sign("sha256", Buffer.from(dataString), options);
    if (!returnBytes){
        signature = signature.toString(STRING_ENCODING);
    }
    return signature;
}

function isRSASignatureOkay(dataString: string, publicKeyString: string, signatureString: string){
    const options = {
        key: publicKeyString,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    };
    return crypto.verify("sha256", Buffer.from(dataString), options, Buffer.from(signatureString, STRING_ENCODING));
}




export {
    nonCryptoRandomIntInclusive, randomBase64String,
    isValidPublicKey, isValidPrivateKey, getHash, 
    STRING_ENCODING, 
    generateRSAKeys, 
    encryptStringRSA, decryptStringRSA, 
    encryptJSONObjectRSA, decryptJSONObjectRSA,
    generateAESKey, generateRandomAESKey, 
    encryptStringAES, decryptStringAES,
    encryptJSONObjectAES, decryptJSONObjectAES, 
    signRSA, isRSASignatureOkay
};
