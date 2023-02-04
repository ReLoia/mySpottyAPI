const express = require("express");
const fetch = require("node-fetch").default;
const fs = require('fs');
const cors = require('cors');
require("dotenv").config();

const spEndpoint = "https://api.spotify.com/v1/";
let baseUrl = process.env.PROJECT_DOMAIN;

if (!baseUrl.startsWith("http")) baseUrl = "https://" + baseUrl + ".glitch.me";

console.log(process.env.PROJECT_DOMAIN);

let last_accesstoken = "",
	last_refreshtoken = "",
	last_timestamp = 0,
	last_data = {
		author: "loading",
		name: "Please wait...",
		song_link: "",
		duration: 0,
		playing: false,
		album_image: "https://upload.wikimedia.org/wikipedia/commons/5/59/Empty.png",
		explicit: false,
		progress: 0
	};

const app = express();
app.use(cors());

if (fs.existsSync("./data.json")) {
	const datas = JSON.parse(fs.readFileSync("./data.json"));

	if (datas.refresh_token) {
	    last_refreshtoken = datas.refresh_token;
		fetch(baseUrl + '/refresh-token?refresh_token=' + datas.refresh_token );
	}
}

const handleErrors = (res, err, msg) => res.send({
	code: err,
	message: msg
});

function handleRefreshToken(refresh_token) {
	last_refreshtoken = refresh_token;
	fs.writeFileSync('./data.json', `{ "refresh_token": "${refresh_token}" }`);
}

async function fetchData () {
	if (Date.now() > (last_timestamp + 3600000) && last_refreshtoken) await fetch(baseUrl + "/refresh-token?refresh_token=" + last_refreshtoken);
	
	if (last_accesstoken) { // token non scaduto e non nullo
		let response = await fetch(spEndpoint + "me/player/currently-playing", {
			headers: { Authorization: "Bearer " + last_accesstoken }
		});

		if (response.status == 200) { // Current playing
			console.log("Current played");
			try {
				const json = await (response).json();
				last_data = {
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
			console.log("Last played");
			response = await fetch(spEndpoint + "me/player/recently-played?limit=1", {
				headers: { Authorization: "Bearer " + last_accesstoken }
			});

			try {
				const json = await (response).json();
				last_data = {
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
		}
    else if (response.status == 401) {
      fetch(baseUrl + "/refresh-token?refresh_token=" + last_refreshtoken);
    }
	}
};
setInterval(fetchData, 6000);

/**
 * What I would like to get:
 *
 * Current playing -> If not playing anything then: DONE
 * Last played	DONE
 *
 * Response structure: DONE
 * {
 * 	author,
 * 	name,
 * 	song_link,
 * 	duration,
 * 	playing,
 * 	album_image,
 * 	explicit
 * }
 *
 */


app.get("/", (req, res) => handleErrors(res, 403, "This is not your business, please go to https://reloia.github.io/"));

app.get("/api", async (req, res) => {
	if (!last_accesstoken) return handleErrors(res, 401, "Not logged in to Spotify or the Refresh Token has expired");

	res.send(last_data);
});

app.get("/letmeinplease", (req, res) => {
	if (Date.now() < (last_timestamp + 3600000)) return handleErrors(res, 403, "Already logged in.");

	res.redirect("https://accounts.spotify.com/authorize?" + (new URLSearchParams({
		response_type: "code",
		client_id: process.env.CLIENT_ID,
		scope: "user-read-private user-read-email user-read-playback-state user-read-currently-playing user-read-recently-played user-top-read user-read-playback-position",
		redirect_uri: baseUrl + "/callback",
		state: (Math.random().toString(36) + "00000000000000000").slice(2, 12 + 2),
	})).toString());
});

app.get("/callback", (req, res) => {
	const code = req.query.code;

	const formData = new URLSearchParams();
	formData.append("code", code);
	formData.append("redirect_uri", baseUrl + "/callback");
	formData.append("grant_type", "authorization_code");

	if (code) {
		fetch("https://accounts.spotify.com/api/token", {
			method: "post",
			body: formData,
			headers: { Authorization: "Basic " + (Buffer.from(process.env.CLIENT_ID + ":" + process.env.CLIENT_SECRET)).toString("base64"), }
		}).then(async r => {
			const data = await r.json();
			last_accesstoken = data.access_token;
			handleRefreshToken(data.refresh_token);

			last_timestamp = Date.now();
			
			// setInterval(fetchData, 6000);
		});
	}

	res.send('<a href="/">Goto home</a>');
});

app.get("/refresh-token", (req, res) => {
	const refresh_token = req.query.refresh_token;

	const formData = new URLSearchParams();
	formData.append("grant_type", "refresh_token");
	formData.append("refresh_token", refresh_token);

	fetch("https://accounts.spotify.com/api/token", {
		method: "post",
		body: formData,
		headers: { Authorization: "Basic " + (Buffer.from(process.env.CLIENT_ID + ":" + process.env.CLIENT_SECRET)).toString("base64"), }
	}).then(async r => {
		if (r.status === 200) {
			const body = await r.json();
			last_accesstoken = body.access_token;
			last_timestamp = Date.now();
			res.send({
				access_token: last_accesstoken
			});
		} else {
			res.send({
				error: "idk"
			});
		}
	});
});

app.listen(process.env.PORT);

console.log("Server on: " + baseUrl)

