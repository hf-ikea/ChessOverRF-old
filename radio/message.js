const ReedSolomon = require("./reedsolomon");

// reed-solomon
const rs = new ReedSolomon(20);

const types = [
    'init',
    'joinGame',
    'gameInfo', //  turn, board FEN (or move object im debating right now)
    'ackJoin'
]

// encode utf8 and decode utf8
function encodeUtf8(array) {
    let toReturn = "";
    for (codepoint of array) {
        toReturn += String.fromCharCode(codepoint);
    }
    return toReturn;
}

function decodeUtf8(string) {
    let toReturn = [];
    for (character of string) {
        toReturn.push(character.charCodeAt(0));
    }
    return toReturn;
}

// pad and unpad callsigns
function unpadCallsign(padded) {
    return padded.trim();
}

function padCallsign(callsign) {
    return callsign.padStart(6, " ");
}

class Message {
    constructor(type = null, callsign = null, payload = null) {
        this.type = type;
        this.callsign = callsign;
        this.payload = payload;
    }

    // create a message from bytes
    fromBytes(bytes) {
        // convert our buffer to an array
        let array = [...bytes];
        // slice off the header and footer
        array.splice(0, 3);
        array.splice(array.length - 3, 3);
        // decode with reed-solomon coding
        let decoded = decodeUtf8(rs.decode(array));
        // set our type
        this.type = types[decoded[0]];
        decoded.splice(0, 1);
        // get our callsign
        this.callsign = unpadCallsign(encodeUtf8(decoded.slice(0, 6)));
        decoded.splice(0, 6);
        // decode our payload, if it exists
        if (this.type === "init" || this.type === "joinGame"|| this.type === "ackJoin") this.payload = null;
        else if (this.type === "gameInfo") {
            this.payload = encodeUtf8(decoded).split(",");
        }
    }

    // check if a message is a message
    static isMessage(message) {
        return message[0] === 0xFA && message[1] === 0x68 && message[2] === 0xFF && message[message.length - 3] === 0xFF && message[message.length - 2] === 0x68 && message[message.length - 1] === 0xFA;
    }

    // convert a message to bytes
    toBytes() {
        // init a byte array
        let byteArray = [];
        // push the header
        byteArray.push(0xFA, 0x68, 0xFF);
        // push the message type
        byteArray.push(types.indexOf(this.type));
        // push the callsign
        byteArray.push(...decodeUtf8(padCallsign(this.callsign)));
        // push the payload
        if(this.type === "gameInfo") {
            byteArray.push(...decodeUtf8(this.payload));
        }
        // apply reed-solomon coding
        byteArray.push(...rs.encode(encodeUtf8(byteArray.splice(3))));
        // push the footer
        byteArray.push(0xFF, 0x68, 0XFA);
        // return a buffer from the byte array
        return Buffer.from(byteArray);
    }

    // convert a message to a bytestring
    toByteString() {
        return this.toBytes().toString("hex");
    }

    // create a message from a bytestring
    fromByteString(byteString) {
        this.fromBytes(Buffer.from(byteString, "hex"));
        return this.payload;
    }
}
module.exports = Message;