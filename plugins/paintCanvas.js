import fs from "fs";
import {handleErrors} from "../utils.js";

// TODO: Add a cooldown to the paint canvas
export class PaintCanvas {
    constructor(wss) {
        this.status = new Array(300);

        if (fs.existsSync("./data/paintcanvas.json")) this.status = JSON.parse(fs.readFileSync("./data/paintcanvas.json"));
        else fs.writeFileSync("./data/paintcanvas.json", JSON.stringify(this.status));

        this.wss = wss;

        this.sendStatus = this.sendStatus.bind(this);
        this.post = this.post.bind(this);
    }

    async sendStatus(req, res) {
        res.send(this.status);
    }

    async post(req, res) {
        const {x, y, color} = req.body;

        if (x == undefined || y == undefined || color == undefined) return handleErrors(res, 400, 'Missing parameters');
        if (x < 0 || x > 30 || y < 0 || y > 10) return handleErrors(res, 400, 'Out of bounds');

        this.status[y * 30 + x] = {x: x, y: y, color};

        fs.writeFileSync("./data/paintcanvas.json", JSON.stringify(this.status));

        Array.from(this.wss.clients).forEach(client => {
            client.send(JSON.stringify({type: "paintcanvas", x: x, y: y, color}));
        });
        res.send({message: "Pixel added"});
    }
}