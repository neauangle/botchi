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

import * as Lexer from '../../third_party/lexer.js';
import * as XDate from '../../third_party/xdate.js'; //https://arshaw.com/xdate/
import * as bigRational from '../../third_party/big.mjs';
import * as Globals from '../../globals.js';

const Big = bigRational.Big;


//\/ \/ \/ \/ \/ https://gist.github.com/aaditmshah/6683499 \/ \/ \/ \/ \/ 
function Parser(table) {
    this.table = table;
}
Parser.prototype.parse = function (input) {
    var length = input.length,
        table = this.table,
        output = [],
        stack = [],
        index = 0;

    while (index < length) {
        var token = input[index++];

        switch (token) {
        case "(":
            stack.unshift(token);
            break;
        case ")":
            while (stack.length) {
                var token = stack.shift();
                if (token === "(") break;
                else output.push(token);
            }

            if (token !== "(")
                throw new Error("Mismatched parentheses.");
            break;
        default:
            if (table.hasOwnProperty(token)) {
                while (stack.length) {
                    var punctuator = stack[0];

                    if (punctuator === "(") break;

                    var operator = table[token],
                        precedence = operator.precedence,
                        antecedence = table[punctuator].precedence;

                    if (precedence > antecedence ||
                        precedence === antecedence &&
                        operator.associativity === "right") break;
                    else output.push(stack.shift());
                }

                stack.unshift(token);
            } else output.push(token);
        }
    }

    while (stack.length) {
        var token = stack.shift();
        if (token !== "(") output.push(token);
        else throw new Error("Mismatched parentheses.");
    }

    return output;
};
///\ /\ /\ /\ /\ https://gist.github.com/aaditmshah/6683499 /\ /\ /\ /\ /\



export const expressionParser = (() => {
     //https://stackoverflow.com/questions/23325832/parse-arithmetic-expression-with-javascript
    const generalRules = [
        [/(?:\+|-)?(?:\$P)/i, (lexeme) => lexeme.toUpperCase()],

        [/(\+|-)?(\$T|\$V|\$G)\.([a-zA-Z][_a-zA-Z0-9]*)/i, (lexeme, unary, specifier, parameter) => {
            specifier = specifier.toUpperCase();
            return (unary ? unary : '') + specifier + '.' + parameter;
        }],

        //for e.g. $R3.result, parameter is set to 'RESULT'
        [/(\+|-)?(?:\$R.)([0-9a-zA-Z_]+)\.(RESULT.)?(\w+)/i, (lexeme, unary, rowIndex, resultKeyword, parameter) => {
            return (unary ? unary : '') + "$R."+ rowIndex + '.' + (resultKeyword ? "RESULT." : '') + parameter;
        }]
    ]
    const expressionRules = [
        [/\s+/, (lexeme) => {/* skip whitespace */}],

        [/[-+*/^()]|<|>|<=|>=|==/, lexeme => lexeme],
        
        /*will fail for "+1" so... just use 1 - otherwise, with '+' added to the rule here, we had "1+1" => ['1', '+1'] parse array*/
        [/(?:-)?[0-9]+(?:\.[0-9]+)?/, lexeme => lexeme],

        [/\".*\"/, lexeme => lexeme], //strings
    ]
    const textRules = [
        [/(\$D)\{(.+)\}/i, (lexeme, specifier, dateString) => {
            return specifier.toUpperCase() + '.' + dateString;
        }],
    ]
    
    const expressionLexer = new Lexer.Lexer(char => {
        throw Error("Unexpected char " + char)
    })
    let defaultedText = false;
    const textLexer = new Lexer.Lexer(char => {defaultedText = true; return char})//we just let it pass, adding to the result
    for (const rule of generalRules){
        expressionLexer.addRule(rule[0], rule[1]);
        textLexer.addRule(rule[0], rule[1]);
    }
    for (const rule of expressionRules){
        expressionLexer.addRule(rule[0], rule[1]);
    }
    for (const rule of textRules){
        textLexer.addRule(rule[0], rule[1]);
    }
   

    const power = {
        precedence: 4,
        associativity: "left"
    };
    
    const factor = {
        precedence: 3,
        associativity: "left"
    };

    const term = {
        precedence: 2,
        associativity: "left"
    };

    const comparison = {
        precedence: 1,
        associativity: "left"
    };

    const parser = new Parser({
        "<": comparison,
        ">": comparison, 
        "<=": comparison, 
        ">=": comparison, 
        "!=": comparison, 
        "===": comparison,
        "==": comparison,

        "+": term,
        "-": term,

        "*": factor,
        "/": factor,

        "^": power
    });

    function isExpresionValid(expression, rowOutputs, localVariables, tracker, rowLabels, isText){
        if (!expression){
            return false;
        }
        try {
            parse(expression, rowOutputs, localVariables, tracker, rowLabels, isText);
        } catch {
            return false;
        }
        return true;
    }
    
    function parse(input, rowOutputs, localVariables, tracker, rowLabels, outerRowIndex, isText=false) {
        defaultedText = false;
        const lexer = isText ? textLexer : expressionLexer;

        const currentPrice = tracker && tracker.mostRecentPrice ? Number(tracker.mostRecentPrice.comparator) : 0;
        const isReturningSubstitutedString = currentPrice !== undefined && rowOutputs !== undefined && tracker !== undefined;
        if (!isReturningSubstitutedString && isText){
            throw "Error: !isReturningSubstitutedString && isText";
        }
        let substitutedString = '';
        const substitutions = [];
        lexer.setInput(input);
        var tokens = [], token;
        while (token = lexer.lex()) { 
            if (token.startsWith('"')){
                token = token.slice(1, -1);
            }
            tokens.push(token);
            let substitution;
            if (isReturningSubstitutedString){
                if (defaultedText){
                    substitutedString += token;
                    defaultedText = false;
                } else if (token.startsWith('$R') || token.startsWith('+$R') || token.startsWith('-$R')){
                    const parts = token.split('.');
                    parts[1] = parts[1].toUpperCase();
                    let rowIndex = -1;
                    if (isNaN(parts[1])){
                        if (parts[1] === 'SELF'){
                            rowIndex = outerRowIndex;
                        } else if (parts[1] === 'NEXT'){
                            rowIndex = outerRowIndex + 1; //out of bounds caught later
                        } else {
                            rowIndex = rowLabels.indexOf(parts[1]);
                        }
                    } else {
                        rowIndex = Number(parts[1]);
                    }
                    if (rowIndex < 0){
                        throw "Invalid row label: " + parts[1];
                    }
                    
                    const resultKeyword = parts.length === 3 ? '' : parts[2];
                    const parameter = parts.length === 3 ? parts[2] : parts[3];

                    let result;
                    if (rowIndex < rowOutputs.length && resultKeyword && rowOutputs[rowIndex].result.hasOwnProperty(parameter) 
                    || rowOutputs[rowIndex].hasOwnProperty(parameter)){
                        if (resultKeyword){
                            result = rowOutputs[rowIndex].result[parameter];
                        } else {
                            result = rowOutputs[rowIndex][parameter];
                        }
                        if (typeof result === 'object'){
                            result = JSON.stringify(result);
                        }
                        result = token.split("$R")[0] + result;
                    }
                    if (result === undefined){
                        throw "Invalid row index or parameter in " + token;
                    } else {
                        substitution = result;
                    }
                } else if (token.startsWith('$T') || token.startsWith('+$T') || token.startsWith('-$T')
                || token.startsWith('$V') || token.startsWith('+$V') || token.startsWith('-$V')){
                    const [prefix, parameter] = token.split('.');
                    let info;
                    if (token.startsWith('$T') || token.startsWith('+$T') || token.startsWith('-$T')){
                        info = tracker;
                    } else {
                        info = localVariables;
                    }
                    const letterAndDollar = prefix[prefix.length-2];
                    if (info.hasOwnProperty(parameter)){
                        substitution = token.split(letterAndDollar)[0] + info[parameter];
                    } else {
                        throw "Invalid parameter in " + token;
                    }
                } else if (token.startsWith('$G') || token.startsWith('+$G') || token.startsWith('-$G')){
                    const [prefix, parameter] = token.split('.');
                    const letterAndDollar = prefix[prefix.length-2];
                    substitution = token.split(letterAndDollar)[0] + Globals.getGlobal(parameter); //throws if global doesn't exist

                } else if (token === '$P' || token === '+$P' || token === '-$P'){
                    substitution = token.split("$P")[0] + currentPrice;
                } else if (token.startsWith("$D")){
                    const formatString = token.slice(token.indexOf(".")+1);
                    const date = XDate.XDate();
                    const dateString = date.toString(formatString);
                    substitution = dateString;
                } else {
                    substitutedString += token;
                }
                if (substitution !== undefined){
                    substitutedString += substitution;
                    substitutions.push([token, substitution]);
                }
                
                if (!isText){
                    substitutedString += ' ';
                }
            }
        }
        if (!isText && substitutedString.endsWith(' ')){
            substitutedString = substitutedString.slice(0, -1);
        }
        substitutedString = isReturningSubstitutedString ? substitutedString : input;
        return {parsedArray: parser.parse(tokens), substitutedString, substitutions};
    }

    function asNumber(a){
        console.trace();
        if (typeof a === 'number'){
            return Big(a);
        }
        if (typeof a === 'string'){
            if (a !== '' && !isNaN(a)){
                return Big(a);
            } 
            a = a ? Big(1) : Big(0);
        }
        return a;
    }

    function evaluate(parsedArray, currentPrice, rowOutputs, localVariables, tracker, rowLabels, outerRowIndex){
        const stack = [];

        const operator = {
            "<": (a, b) => asNumber(a).lt(b) ? 1 : 0,
            "<=": (a, b) => asNumber(a).lte(b) ? 1 : 0,
            ">": (a, b) => asNumber(a).gt(b) ? 1 : 0,
            ">=": (a, b) => asNumber(a).gte(b) ? 1 : 0,
            "==": (a, b) => { 
                try {
                    a = Big(a);
                } catch {
                   //failed to turn a into big number - will treat as string comparison
                }
                if (typeof a.eq === 'function'){
                    return a.eq(b) ? 1 : 0
                } else {
                    return a === b ? 1 : 0
                }
            },

            "^": (a, b) => {
                return asNumber(a).pow(Number(b));
            },

            "+": (a, b) => asNumber(a).plus(b),
            "-": (a, b) => asNumber(a).minus(b),

            "*": (a, b) => asNumber(a).times(b),
            "/": (a, b) => asNumber(a).div(b),
        };


        parsedArray.forEach(token => {
            switch (token) {
            case "<":
            case ">":
            case "<=":
            case ">=":
            case "==":
            case "+":
            case "-":
            case "*":
            case "/":
            case "^":
                var b = stack.pop();
                var a = stack.pop();
                stack.push(operator[token](a, b));
                break;
            default:
               if (token.startsWith('$R') || token.startsWith('+$R') || token.startsWith('-$R')){
                    const parts = token.split('.');
                    parts[1] = parts[1].toUpperCase();
                    let rowIndex = -1;
                    if (isNaN(parts[1])){
                        if (parts[1] === 'SELF'){
                            rowIndex = outerRowIndex;
                        } else if (parts[1] === 'NEXT'){
                            rowIndex = outerRowIndex + 1; //out of bounds caught later
                        } else {
                            rowIndex = rowLabels.indexOf(parts[1]);
                        }
                    } else {
                        rowIndex = Number(parts[1]);
                    }
                    if (rowIndex < 0){
                        throw "Invalid row label: " + parts[1];
                    }
                    const resultKeyword = parts.length === 3 ? '' : parts[2];
                    const parameter = parts.length === 3 ? parts[2] : parts[3];

                    let result;
                    if (rowIndex < rowOutputs.length && resultKeyword && rowOutputs[rowIndex].result.hasOwnProperty(parameter) 
                    || rowOutputs[rowIndex].hasOwnProperty(parameter)){
                        if (resultKeyword){
                            result = rowOutputs[rowIndex].result[parameter];
                        } else {
                            result = rowOutputs[rowIndex][parameter];
                        }
                        if (typeof result === 'object'){
                            result = JSON.stringify(result);
                        }
                        result = token.split("$R")[0] + result;
                    }
                    if (result && result.startsWith('"')){
                        result = result.slice(1, -1);
                    }
                    if (result === undefined){
                        throw "Invalid token " + token;
                    }
                    
                    stack.push(result);

                } else if (token.startsWith('$T') || token.startsWith('+$T') || token.startsWith('-$T')
                || token.startsWith('$V') || token.startsWith('+$V') || token.startsWith('-$V')){
                    const [prefix, parameter] = token.split('.');
                    let info;
                    if (token.startsWith('$T') || token.startsWith('+$T') || token.startsWith('-$T')){
                        info = tracker;
                    } else {
                        info = localVariables;
                    }
                    const letterAndDollar = prefix[prefix.length-2];
                    if (info.hasOwnProperty(parameter)){
                        stack.push(token.split(letterAndDollar)[0] + info[parameter]);
                    } else {
                        throw "Invalid token " + token;
                    }
                } else if (token.startsWith('$G') || token.startsWith('+$G') || token.startsWith('-$G')){
                    const [prefix, parameter] = token.split('.');
                    const letterAndDollar = prefix[prefix.length-2];
                    stack.push(token.split(letterAndDollar)[0] + Globals.getGlobal(parameter)); //throws if global doesn't exist
                } else if (token === '$P' || token === '+$P' || token === '-$P'){
                    stack.push(token.split("$P")[0] + currentPrice);
                } else {
                    stack.push(token);
                }
            }
        });
        //handles e.g. $p - $p which would otherwise result in a stack of [$p, -$p] at the end 
        //because it will treat the - as part of the second $p rather than an operator.
        let result = Big(0);
        while (stack.length){
            const pop = stack.pop();
            result = result.plus(asNumber(pop));
        }
        const asString = result.toFixed(20);
        let i = asString.length-1;
        while (asString[i] === '0' || asString[i] === '.'){
            i -= 1;
            if (asString[i] === '.'){
                i -= 1;
                break;
            }
        }
        return asString.slice(0, i+1);
    };

    return {
        isExpresionValid,
        parse,
        evaluate
    }
})();







