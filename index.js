import express from 'Express';
const app = express();
import fs from 'fs';
import bodyParser from 'body-parser';
import { Chess } from 'chess.js';
import { main } from './radio/index.js';
const chess = new Chess();
let whoseTurn = 'w'; 

app.use(bodyParser.json());
app.use('/chessboard', express.static('chessboard'));

app.get('/', function(req, res){
    fs.readFile('index.html', 'utf-8', (err, data) => {
        if(err) {
            console.log(err);
            return;
        }
        res.set('Content-Type', 'text/html')
        res.send(data);
    });
});
app.post('/post', function(req, res){
    let json = JSON.parse('{ "from": "abcd", "to": "abcd" }');
    json.from = req.body.from;
    json.to = req.body.to;
    res.send(validateMove(json, req.body.piece));
});

function validateMove(moveObject, piece) {
    if(chess.move(moveObject) != null) {
        return JSON.parse('{ "error": "invalid move" }')
    } else if (chess.move(moveObject) != null && [...piece][0] != whoseTurn) {
        return JSON.parse('{ "error": "wrong turn" }');
    } else {
        if (whoseTurn == 'w') {
            whoseTurn = 'b';
            return JSON.parse('{ "turn": "w" }');
        } else {
            whoseTurn = 'w';
            return JSON.parse('{ "turn": "b" }');
        }
    }
}

await main();

app.listen(3000);