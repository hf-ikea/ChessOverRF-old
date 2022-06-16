import Message from './radio/message.js';

let beans = new Message("init", "BEN");

console.log(beans.toByteString());
beans.fromByteString(beans.toByteString())

console.log(beans.callsign);