// Base Requirements
import dotenv from "dotenv";
import fs from "fs";
import {getBaseURL, handleErrors} from "./utils.js";
// Server Requirements
import {SpotifyAPI} from "./spotifyAPI.js";

import express from "express";

import cors from "cors";
// Websocket stuff
import http from "http";
import {WebSocketServer} from "ws";

// Widgets
import {listeningWidget} from "./widgets/listeningWidget.js";

// Plugins
import {PaintCanvas} from "./plugins/paintCanvas.js";
import {SOTD} from "./plugins/sotd.js";

dotenv.config();

// Constants
const BASE_URL = getBaseURL();

const app = express();

app.use(express.json());

app.use(cors());
app.use((req, res, next) => {
    console.log(`[${req.method}] [${new Date().toLocaleString("it")}] ${req.url}`)
    next();
})

const server = http.createServer(app);

const wss = new WebSocketServer({server});


server.listen(process.env.PORT || 3000, () => console.log(`Server started on ${BASE_URL}\nAlternatively on http://localhost:${process.env.PORT || 3000}`));

const spotify = new SpotifyAPI();

// Main app Loop
setInterval(async () => {
    if (!spotify.refreshToken) return console.log("Non c'è un refresh token");

    const newData = await spotify.getData();

    if (newData?.status == 401) return console.log(`3. Errore nel refresh token: ${newData?.status}`, newData.response);

    if (
        (spotify?.data?.song_link != newData?.song_link) ||
        (spotify?.data?.playing != newData?.playing) ||
        (Math.abs(newData?.progress - spotify?.data?.progress) >= 15000)
    ) {
        wss.clients.forEach(client => {
            // if the number of clients has changed, send it
            if (!spotify.data.clients || spotify.data.clients != wss.clients.size) newData.clients = wss.clients.size;
            newData.type = "listening-status";

            client.send(JSON.stringify(newData));
        });
    }
    spotify.data = newData;
}, 5000);

let recentMessages = [];
let onCooldown = [];

wss.on("connection", ws => {
    const data = {...spotify.data};

    ws.send(JSON.stringify({listening: {...data, clients: wss.clients.size}, recentMessages, type: "init"}));

    ws.on("message", (message) => {
        console.log(`Received message from client: ${message}`);
        try {
            const received = JSON.parse(message);

            if (onCooldown.includes(ws)) return;
            onCooldown.push(ws);
            setTimeout(() => onCooldown.splice(onCooldown.indexOf(ws), 1), 2500);

            if (received.type == "chat") {
                recentMessages.push({username: received.username, message: received.message});
                setTimeout(() => recentMessages.shift(), 1000 * 60 * 60);
                Array.from(wss.clients).forEach(client => {
                    client.send(JSON.stringify({
                        type: "chat",
                        clients: wss.clients.size,
                        username: received.username,
                        message: received.message
                    }));
                });
            }
        } catch (err) {
            console.error(err);
        }
    });
});

// app.get("/", (req, res) => handleErrors(res, 200, `You shouldn't be here... Please go to https://reloia.github.io/ or the api endpoint : ${BASE_URL}/api`));
app.get("/", (req, res) => res.send(fs.readFileSync("./static/index.html").toString()));

app.get("/api", async (_, res) => {
    if (!spotify.accessToken) return handleErrors(res, 401, "Not logged in to Spotify or the Refresh Token has expired");
    res.send(spotify.data);
});

app.get("/api/last", async (_, res) => {
    if (!spotify.accessToken) return handleErrors(res, 401, "Not logged in to Spotify or the Refresh Token has expired");
    res.send(await spotify.getLastSong())
});

app.get("/log-in", (req, res) => {
    if (spotify.refreshToken) return handleErrors(res, 403, "Already logged in.");

    res.redirect("https://accounts.spotify.com/authorize?" + (new URLSearchParams({
        response_type: "code",
        client_id: process.env.CLIENT_ID,
        scope: "user-read-private user-read-email user-read-playback-state user-read-currently-playing user-read-recently-played user-top-read user-read-playback-position",
        redirect_uri: `${BASE_URL}/callback`,
        state: (`${Math.random().toString(36)}00000000000000000`).slice(2, 12 + 2),
    })).toString());
});

app.get("/callback", async (req, res) => {
    const code = req.query.code;

    if (code) {
        const resp = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            body: new URLSearchParams({
                code,
                redirect_uri: `${BASE_URL}/callback`,
                grant_type: "authorization_code"
            }),
            headers: {Authorization: `Basic ${(Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`)).toString("base64")}`,}
        })

        console.log(resp.status);
        const text = await resp.text();

        // const data = await resp.json();
        const data = JSON.parse(text);

        if (data.error) return handleErrors(res, 400, "The server has given the erorr: " + data.error_description);
        spotify.accessToken = data.access_token;
        spotify.refreshToken = data.refresh_token;
    }

    res.send('<a href="/">Goto home</a>');
});

// SOTD Stuff
const sotd = new SOTD(spotify);

app.get("/sotd", sotd.get);
app.post("/sotd/clear", sotd.clear);
app.post("/sotd/remove", sotd.remove);
app.post("/sotd/url", sotd.url);
app.post("/sotd", sotd.post);

// PaintCanvas canvas
const paintCanvas = new PaintCanvas(wss);

app.get("/paintcanvas/status", paintCanvas.sendStatus);

/**
 * PaintCanvas a pixel in the canvas with the specified color using the index calculated in the frontend.
 */
app.post("/paintcanvas", paintCanvas.post);

// Widgets
app.get('/widgets/listening', (req, res) => listeningWidget(req, res, spotify));
