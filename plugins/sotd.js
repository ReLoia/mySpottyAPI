import fs from "fs";
import {handleErrors} from "../utils.js";

const MAX_SONGS = Infinity;

export class SOTD {
    /**
     *
     * @param spotify {SpotifyAPI}
     */
    constructor(spotify) {
        this.spotify = spotify;
        this.post = this.post.bind(this);
        this.url = this.url.bind(this);
    }

    appendToSotd(data) {
        let songs = 1;
        if (fs.existsSync("./data/sotd.json")) {
            const sotd = JSON.parse(fs.readFileSync("./data/sotd.json"));
            if (sotd.length >= MAX_SONGS) sotd.shift();
            sotd.push(data);
            songs = sotd.length;

            fs.writeFileSync("./data/sotd.json", JSON.stringify(sotd));

            if (process.env.WEBHOOK) fetch(`https://discord.com/api/webhooks/1245796818755915816/${process.env.WEBHOOK}`, {
                method: "POST",
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(sotd)
            });
        } else fs.writeFileSync("./data/sotd.json", JSON.stringify([data]));

        return {
            message: `Song added: ${data.name} by ${data.author}, date: ${data.date} with album cover ${data.album}`,
            songs
        };
    }

    async get(_, res) {
        if (!fs.existsSync("./data/sotd.json")) return handleErrors(res, 404, "No songs of the day");
        const data = JSON.parse(fs.readFileSync("./data/sotd.json")).reverse();

        res.send(data);
    }

    async post(req, res) {
        const {name, author, date, album, url} = req.body;

        if (!name || !author || !date || !album || !url) return handleErrors(res, 400, 'Missing parameters');
        if (req.headers.authorization !== process.env.SECRET) return handleErrors(res, 401, "Wrong code");

        return res.send(this.appendToSotd({name, author, date, album, url}))
    }

    async clear(req, res) {
        if (req.headers.authorization !== process.env.SECRET) return handleErrors(res, 401, "Wrong code");

        fs.writeFileSync("./data/sotd.json", "[]");

        res.send({message: "Songs cleared"});
    }

    async remove(req, res) {
        const {index} = req.body;

        if (index == undefined) return handleErrors(res, 400, 'Missing parameters');
        if (req.headers.authorization !== process.env.SECRET) return handleErrors(res, 401, "Wrong code");

        const sotd = JSON.parse(fs.readFileSync("./data/sotd.json"));

        if (index < 0 || index > sotd.length) return handleErrors(res, 400, "Index out of range");
        sotd.splice(index, 1);
        fs.writeFileSync("./data/sotd.json", JSON.stringify(sotd));

        res.send({message: `Song removed`});
    }

    async removeFromUrl(req, res) {
        const {url} = req.body;

        if (!url) return handleErrors(res, 400, 'Missing parameters');
        if (req.headers.authorization !== process.env.SECRET) return handleErrors(res, 401, "Wrong code");

        const sotd = JSON.parse(fs.readFileSync("./data/sotd.json"));

        const index = sotd.findIndex(s => s.url === url);

        if (index === -1) return handleErrors(res, 404, "Song not found");
        sotd.splice(index, 1);
        fs.writeFileSync("./data/sotd.json", JSON.stringify(sotd));

        res.send({message: `Song removed`});
    }

    async removeFromDate(req, res) {
        const {date} = req.body;

        if (!date) return handleErrors(res, 400, 'Missing parameters');
        if (req.headers.authorization !== process.env.SECRET) return handleErrors(res, 401, "Wrong code");

        const sotd = JSON.parse(fs.readFileSync("./data/sotd.json"));

        const index = sotd.findIndex(s => s.date === date);

        if (index === -1) return handleErrors(res, 404, "Song not found");
        sotd.splice(index, 1);
        fs.writeFileSync("./data/sotd.json", JSON.stringify(sotd));

        res.send({message: `Song removed`});
    }

    async url(req, res) {
        const {url} = req.body;

        if (!url) return handleErrors(res, 400, 'Missing parameters');
        if (req.headers.authorization !== process.env.SECRET) return handleErrors(res, 401, "Wrong code");

        const it = new URL(url).pathname;
        console.log(this.spotify.refreshToken)
        const response = await this.spotify.makeRequest(`tracks/${it.slice(it.lastIndexOf("/") + 1)}?market=IT`)
        if (response.status !== 200) {
            console.log(response)
            return handleErrors(res, 500, "The server is not responding correctly");
        }

        const json = await response.json()

        return res.send(this.appendToSotd({
            name: json.name,
            author: json.artists.map(a => a.name).join(", "),
            date: Date.now(),
            album: json.album.images[0].url,
            url
        }))
    }
}