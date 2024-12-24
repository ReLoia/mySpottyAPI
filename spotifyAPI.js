import fs from "fs";

export class SpotifyAPI {
    _accessTokenTimestamp = 0;
    loadedDataJSON = false;
    spEndpoint = "https://api.spotify.com/v1/";

    data = {
        author: "loading",
        name: "Please wait...",
        song_link: "",
        duration: 0,
        playing: false,
        album_name: "loading",
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
        if (!this.accessToken) await this.handleRefreshToken();

        return await fetch(this.spEndpoint + endpoint, {
            headers: {Authorization: `Bearer ${this.accessToken}`}
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
            headers: {Authorization: `Basic ${(Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`)).toString("base64")}`}
        });
        if (res.status === 200) {
            const body = await res.json();
            this.accessToken = body.access_token;

            await this.getData();
            return;
        }
        const text = await res.text();
        console.log(`1. Errore nel refresh token: ${res.status}`, text);
        const json = JSON.parse(text);
        if (json.error == "invalid_grant") {
            console.log("The grant has expired, deleting the refresh token!");
            fs.unlink("./data.json", () => {
                console.log("Deleted!");
            });
        }
    }

    async getData() {
        if (!this.accessToken) await this.handleRefreshToken();

        if (this.accessToken) {
            let response = await this.makeRequest("me/player/currently-playing");

            if (response.status == 200) { // Current playing
                try {
                    const json = await response.json();
                    return {
                        author: json.item?.artists?.[0]?.name,
                        name: json.item.name,
                        song_link: json.item?.external_urls?.spotify,
                        duration: json.item.duration_ms,
                        explicit: json.item.explicit,
                        playing: json.is_playing,
                        album_name: json.item.album?.name,
                        album_image: json.item.album?.images?.[1]?.url || "https://upload.wikimedia.org/wikipedia/commons/5/59/Empty.png",
                        progress: json.progress_ms,
                    }
                } catch (err) {
                    console.error(err);
                    console.log(response);
                }
            } else if (response.status == 204) { // Last played
                response = await this.makeRequest("me/player/recently-played?limit=1");
                let json;
                try {
                    json = await response.json()
                } catch (err) {
                    console.error(err);
                    console.log(response);
                    await this.handleRefreshToken();
                }

                try {
                    return {
                        author: json.items[0].track.artists[0].name,
                        name: json.items[0].track.name,
                        song_link: json.items[0].track.external_urls.spotify,
                        duration: json.items[0].track.duration_ms,
                        explicit: json.items[0].track.explicit,
                        playing: false, // Obviously it is false because it was previously playing
                        album_name: json.items[0].track.album.name,
                        album_image: json.items[0].track.album.images[1].url,
                        progress: 0,
                    };
                } catch (err) {
                    console.error(err);
                    console.log(response);
                }
            } else if (response.status == 401) {
                await this.handleRefreshToken();
                return {
                    status: 401,
                    response
                }
            }
        } else {
            console.error("Non c'è un token");
        }
    }

    async getLastSong() {
        if (!this.accessToken) await this.handleRefreshToken();

        console.log("Getting last song");

        if (this.accessToken) {
            if (this.data.playing == false && this.data.progress == 0) return null;

            let response = await this.makeRequest("me/player/recently-played?limit=2");

            if (response.status == 200) {
                try {
                    const json = await response.json();
                    let index = 0;
                    // If the last song is the same as the current one, get the previous one
                    if (json.items[index].track.external_urls.spotify == this.data.song_link) index = 1;
                    return {
                        author: json.items[index].track.artists[0].name,
                        name: json.items[index].track.name,
                        song_link: json.items[index].track.external_urls.spotify,
                        explicit: json.items[index].track.explicit,
                        album_name: json.items[index].track.album.name,
                        album_image: json.items[index].track.album.images[1].url,
                    };
                } catch (err) {
                    console.error(err);
                    console.log(response);
                }
            }
        }
    }
}