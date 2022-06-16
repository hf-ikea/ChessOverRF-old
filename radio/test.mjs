/*
import Message from './radio/message.js';



console.log("ackJoin");
let ackMessage = new Message("ackJoin", callsign);
console.log(ackMessage.toByteString());
*/

import { Chess } from 'chess.js'
import readline from 'readline';
import Message from './message.js';

const chess = new Chess();
let rl = readline.promises.createInterface({
    input: process.stdin,
    output: process.stdout
});

const callsign = "mogus";

console.log("It is your turn.");
console.log(chess.ascii());
let move = await rl.question("SAN Move: ");
chess.move(move);
let gameMessage = new Message("gameInfo", callsign,["b", move].join(","));
console.log(gameMessage.toByteString());
console.log(gameMessage.fromByteString(gameMessage.toByteString()));