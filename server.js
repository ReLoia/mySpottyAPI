// Server Requirements
const express = require("express");
const app = express();
app.use(express.json());
app.use(require("cors")());
app.use((req, res, next) => {
	console.log(`[${req.method}] [${new Date().toLocaleString("it")}] ${req.url}`)
	next();
})

// Websocket stuff
const server = require("http").createServer(app);
const WebSocket = require("ws");
const wss = new WebSocket.Server({ server });

// Other requirements
const fetch = require("node-fetch").default;
const fs = require('fs');
require("dotenv").config();

// Constants
const spEndpoint = "https://api.spotify.com/v1/";
let baseUrl = process.env.PROJECT_DOMAIN || "";
if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}.glitch.me`;

server.listen(process.env.PORT || 3000, () => console.log(`Server started on ${baseUrl}`));

class SpotifyAPI {
	_accessTokenTimestamp = 0;
	loadedDataJSON = false;

	data = {
		author: "loading",
		name: "Please wait...",
		song_link: "",
		duration: 0,
		playing: false,
		album_image: "https://upload.wikimedia.org/wikipedia/commons/5/59/Empty.png",
		explicit: false,
		progress: 0
	};

	get accessToken() {
		if (this._accessToken == "") this.handleRefreshToken();
		if (Date.now() > (this._accessTokenTimestamp + 3600000) && this._refreshtoken) this.handleRefreshToken();

		return this._accessToken;
	}
	set accessToken(access_token) {
		this._accessTokenTimestamp = Date.now();
		this._accessToken = access_token;
	}

	get refreshToken() {
		if (this._refreshtoken == "") return console.log("Non c'è un refresh token A") && false;

		return this._refreshtoken;
	}
	set refreshToken(refresh_token) {
		this._refreshtoken = refresh_token;

		if (!this.loadedDataJSON) {
			this.loadedDataJSON = true;
			fs.writeFileSync('./data.json', `{ "refresh_token": "${refresh_token}" }`);
		}
	}

	constructor() {
		if (fs.existsSync("./data.json")) {
			this.loadedDataJSON = true;
			const datas = JSON.parse(fs.readFileSync("./data.json"));

			this.refreshToken = datas.refresh_token;
		}
	}

	async makeRequest(endpoint) {
		return await fetch(spEndpoint + endpoint, {
			headers: { Authorization: `Bearer ${this.accessToken}` }
		})
	}

	async handleRefreshToken() {
		const refresh_token = this.refreshToken;

		const res = await fetch("https://accounts.spotify.com/api/token", {
			method: "POST",
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token
			}),
			headers: { Authorization: `Basic ${(Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`)).toString("base64")}` }
		});
		if (res.status === 200) {
			const body = await res.json();
			this.accessToken = body.access_token;

			spotify.getData();
			return;
		}
		console.log(`1. Errore nel refresh token: ${res.status}`);
	}

	async getData() {
		if (!this.accessToken) await this.handleRefreshToken();

		if (this.accessToken) {
			let response = await this.makeRequest("me/player/currently-playing");

			if (response.status == 200) { // Current playing
				try {
					const json = await response.json();
					return {
						author: json.item.artists[0].name,
						name: json.item.name,
						song_link: json.item.external_urls.spotify,
						duration: json.item.duration_ms,
						explicit: json.item.explicit,
						playing: json.is_playing,
						album_image: json.item.album.images[1].url,
						progress: json.progress_ms,
					};
				} catch (err) {
					console.error(err);
					console.log(response);
				}
			} else if (response.status == 204) { // Last played
				response = await this.makeRequest("me/player/recently-played?limit=1");
				const json = await response.json();

				try {
					return {
						author: json.items[0].track.artists[0].name,
						name: json.items[0].track.name,
						song_link: json.items[0].track.external_urls.spotify,
						duration: json.items[0].track.duration_ms,
						explicit: json.items[0].track.explicit,
						playing: false, // Obviously it is false because it was previously playing
						album_image: json.items[0].track.album.images[1].url,
						progress: 0,
					};
				} catch (err) {
					console.error(err);
					console.log(response);
				}
			} else if (response.status == 401) {
				this.handleRefreshToken();
				return {
					response: 401,
				}
			}
		} else {
			console.error("Non c'è un token");
		}
	}
}

const spotify = new SpotifyAPI();

setInterval(async () => {
	if (!spotify.refreshToken) return console.log("Non c'è un refresh token");

	const newData = await spotify.getData();

	if (newData?.response == 401) return console.log(`3. Errore nel refresh token: ${res.status}`);
	
	if (
		(spotify?.data?.song_link != newData?.song_link) ||
		(spotify?.data?.playing != newData?.playing) ||
		(Math.abs(newData?.progress - spotify?.data?.progress) >= 15000)
	) {
		wss.clients.forEach(client => {
			// if the number of clients has changed, send it
			if (!spotify.data.clients || spotify.data.clients != wss.clients.size) newData.clients = wss.clients.size;
			client.send(JSON.stringify(newData));
		});
	}
	spotify.data = newData;
}, 5000);

wss.on("connection", ws => {
	const data = { ...spotify.data };
	data.clients = wss.clients.size;
	ws.send(JSON.stringify(data));

	// ws.on("message", (message) => {
	// 	console.log(`Received message from client: ${message}`);
	// });
});

/**
 * 
 * @param {Response} res 
 * @param {Number} err 
 * @param {String} message 
 */
const handleErrors = (res, err, message) => {
	res.status(err).send({
		code: err,
		message
	});
}

app.get("/", (req, res) => handleErrors(res, 403, `You shouldn't be here... Please go to https://reloia.github.io/ or the api endpoint : ${baseUrl}/api`));
app.get("/api", async (_, res) => {
	if (!spotify.accessToken) return handleErrors(res, 401, "Not logged in to Spotify or the Refresh Token has expired");
	res.send(spotify.data);
});

app.get("/log-in", (req, res) => {
	if (spotify.refreshToken) return handleErrors(res, 403, "Already logged in.");

	res.redirect("https://accounts.spotify.com/authorize?" + (new URLSearchParams({
		response_type: "code",
		client_id: process.env.CLIENT_ID,
		scope: "user-read-private user-read-email user-read-playback-state user-read-currently-playing user-read-recently-played user-top-read user-read-playback-position",
		redirect_uri: `${baseUrl}/callback`,
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
				redirect_uri: `${baseUrl}/callback`,
				grant_type: "authorization_code"
			}),
			headers: { Authorization: `Basic ${(Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`)).toString("base64")}`, }
		})

		const data = await resp.json();

		if (data.error) return handleErrors(res, 400, data.error_description);
		spotify.accessToken = data.access_token;
		spotify.refreshToken = data.refresh_token;
	}

	res.send('<a href="/">Goto home</a>');
});

// SOTD Stuff

const maxSongs = 31;

app.get("/sotd", async (_, res) => {
	if (!fs.existsSync("./sotd.json")) return handleErrors(res, 404, "No songs of the day");
	const data = JSON.parse(fs.readFileSync("./sotd.json")).reverse(); res.send(data);
})
app.post("/sotd/clear", async (req, res) => {
	if (!code) return handleErrors(res, 400, 'Missing parameters');
	if (req.headers.authorization !== process.env.CODE) return handleErrors(res, 401, "Wrong code");

	fs.writeFileSync("./sotd.json", "[]");

	res.send({ message: "Songs cleared" });
})
app.post("/sotd/remove", async (req, res) => {
	const { index } = req.body;

	if (index == undefined) return handleErrors(res, 400, 'Missing parameters');
	if (req.headers.authorization !== process.env.CODE) return handleErrors(res, 401, "Wrong code");

	const sotd = JSON.parse(fs.readFileSync("./sotd.json"));

	if (index < 0 || index > sotd.length) return handleErrors(res, 400, "Index out of range");
	sotd.splice(index, 1);
	fs.writeFileSync("./sotd.json", JSON.stringify(sotd));

	res.send({ message: `Song removed` });
})

function appendToSotd(data) {
	let songs = 1;
	if (fs.existsSync("./sotd.json")) {
		const sotd = JSON.parse(fs.readFileSync("./sotd.json"));
		if (sotd.length >= maxSongs) sotd.shift();
		sotd.push(data);
		songs = sotd.length;

		fs.writeFileSync("./sotd.json", JSON.stringify(sotd));
	}
	else fs.writeFileSync("./sotd.json", JSON.stringify([data]));

	return { message: `Song added: ${data.name} by ${data.author}, date: ${data.date} with album cover ${data.album}`, songs };
}

app.post("/sotd/url", async (req, res) => {
	const { url } = req.body;

	if (!url) return handleErrors(res, 400, 'Missing parameters');
	if (req.headers.authorization !== process.env.CODE) return handleErrors(res, 401, "Wrong code");

	const it = new URL(url).pathname; const response = await spotify.makeRequest(`tracks/${it.slice(it.lastIndexOf("/") + 1)}?market=IT`)
	if (response.status !== 200) return handleErrors(res, 500, "The server is not responding correctly");

	const json = await response.json()

	return res.send(appendToSotd({ name: json.name, author: json.artists.map(a => a.name).join(", "), date: Date.now(), album: json.album.images[0].url }))
})
app.post("/sotd", async (req, res) => {
	const { name, author, date, album } = req.body;

	if (!name || !author || !date || !album) return handleErrors(res, 400, 'Missing parameters');
	if (req.headers.authorization !== process.env.CODE) return handleErrors(res, 401, "Wrong code");

	return res.send(appendToSotd({ name, author, date, album }))
})
