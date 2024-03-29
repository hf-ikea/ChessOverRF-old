/*
    help
    TODO:
    - basic game started in console
*/

import Message from './message.js';
import xmlrpc from 'xmlrpc';
import readline from 'readline';
import EventEmitter from 'events';
import { Chess } from 'chess.js';

// setup variables
let pos = 0;
let messages = "";
let callsign = ""
let transmitting = false;
let game = new EventEmitter();
let state = {};
const regex = /[0-9a-f]/;

let rl = readline.promises.createInterface({
    input: process.stdin,
    output: process.stdout
});

const chess = new Chess();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// create client to interface with fldigi
const client = xmlrpc.createClient({
    host: "127.0.0.1",
    port: 7362
});

// nobody likes promises
function asyncRpc(method, params = []) {
    return new Promise(resolve => {
        client.methodCall(method, params, (err, val) => {
            if (err) throw err;
            resolve(val);
        });
    });
}

// transmit message
async function beginTransmit(message) {
    await asyncRpc("text.add_tx", [message + "^r"]);
    await asyncRpc("main.tx");
    transmitting = true;
}

// turn string into hex
function convertHex(string) {
    let array = [...string];
    for (var i = 0; i < array.length; i++) {
        if(!(/[0-9a-f]/.test(array[i]))) {
            array[i] = 0;
        }
    }
    return array.join("");
}

// check rx loop
async function checkRxLoop() {
    if (await asyncRpc("main.get_trx_state") === "RX") {
        transmitting = false;
    } else {
        transmitting = true;
    }
}

// add to rx buffer loop
async function addToRxBufferLoop() {
    let newPos = await asyncRpc("text.get_rx_length") - pos;
    messages += (await asyncRpc("text.get_rx", [pos, newPos])).toString();
    messages = convertHex(messages);
    pos = newPos + pos;
}

// look for the latest message and process it if it exists loop
async function messageSearchLoop() {
    let currentMsgs = messages;
    let packets = currentMsgs.match(/(0e6210)([a-f0-9][a-f0-9])+(10620e)/g);
    if (packets === null) return;
    else {
        messages = messages.slice(currentMsgs);
        let message = new Message();
        message.fromByteString(packets[0]);
        game.emit("message", message);
        await asyncRpc("text.clear_rx");
        packets, messages, currentMsgs = null;
    }
}

// loop runner
function runLoops() {
    checkRxLoop();
    if (transmitting) return;
    addToRxBufferLoop();
    messageSearchLoop();
}

async function makeWhiteMove(state) {
    console.log("It is your turn.");
    console.log(chess.ascii());
    let move = await rl.question("SAN Move: ");
    chess.move(move);
    let gameMessage = new Message("gameInfo", callsign, ["b", move].join(","));
    await beginTransmit(gameMessage.toByteString());
    state.turn = "b";
}

async function makeBlackMove(state) {
    console.log("It is your turn.");
    console.log(chess.ascii());
    let move = await rl.question("SAN Move: ");
    chess.move(move);
    let gameMessage = new Message("gameInfo", callsign, ["b", move].join(","));
    await beginTransmit(gameMessage.toByteString());
    state.turn = "b";
}

async function main() {
    // clear receive buffer from fldigi
    await asyncRpc("text.clear_rx");
    // get user callsign and make it always uppercase
    callsign = (await rl.question("What is your callsign? ")).toUpperCase();
    // ask if user will host the game
    if ((await rl.question("Are you the host? (yes for yes, anything else for no) ")) === "yes") {
        await rl.question("Press enter when you are ready to start the game. ");
        // setup some variables
        state.started = false;
        state.playerJoined = false;
        state.otherPlayer = "";
        state.turn = 'w';
        // run loops
        setInterval(runLoops, 300);
        // send initialize message
        let initMessage = new Message("init", callsign);
        await beginTransmit(initMessage.toByteString());
        // clear receive buffer from fldigi
        await asyncRpc("text.clear_rx");
        // message event
        game.on("message", async (message) => {
            // clear receive buffer from fldigi
            await asyncRpc("text.clear_rx");
            // discard any messages we receive from ourself
            if (message.callsign === callsign) return;
            // check if other player sent a joinGame message
            if (message.type === "joinGame") {
                // if so, set the state to true and transmit an ackJoin message.
                state.playerJoined = true;
                state.otherPlayer = message.callsign;
                let ackMessage = new Message("ackJoin", callsign);
                await beginTransmit(ackMessage.toByteString());
                // wait for tx to finish
                let interval = setInterval(async () => {
                    // if we're no longer transmitting
                    if (!transmitting) {
                        // clear the interval
                        clearInterval(interval);
                        await makeWhiteMove(state);
                    }
                }, 500);
            }
        });
    } else {
        await rl.question("Press enter when you are ready to start the game. ");
        // setup some variables
        state.gameBegun = false;
        state.joined = false;
        state.hostJoined = false;
        state.turn = 'w'; // w for white going on the first turn
        game.on("message", async (message) => {
            // discard any messages we receive from ourself
            if (message.callsign === callsign) return;
            // if it's an initialization message
            if (message.type === "init") {
                // notify the user
                console.log(`New game from ${message.callsign}!`);
                state.joined = (await rl.question("Would you like to join the game? (yes for yes, anything else for no) )") === "yes");
                if (!state.joined) return;
                state.host = message.callsign;
                let joinMessage = new Message("joinGame", callsign);
                await beginTransmit(joinMessage.toByteString());
            } else if (message.type === "ackJoin" && state.joined) {
                state.hostJoined = true;
                state.gameBegun = true;
            } else if (messages.type === "gameInfo") {
                console.log(message.payload); 
            }
        });
        //you gotta actually run the loops homie
        setInterval(runLoops, 160);
    }
}

main();