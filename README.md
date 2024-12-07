# reloia_listen

![img.png](https://cloud-lm3w4o0q0-hack-club-bot.vercel.app/0image.png)  
real time listening status **based on [Spotify](https://developer.spotify.com/)**

# Spotify Key Guide

[Learn how to create a Spotify Developer API Key](https://github.com/ReLoia/reloia_listen/wiki/Creating-a-Spotify-Developer-API-Key-Guide) because you will need this later.

# Installation

## Local Installation

### Clone the repository

    git clone https://github.com/ReLoia/reloia_listen.git /path/to/reloia_listen

### Install dependencies

    cd /path/to/reloia_listen
    npm install

### Start the server

    node index.js

## Docker Installation

### Clone the repository

    git clone https://github.com/ReLoia/reloia_listen.git /path/to/reloia_listen

### Run the docker-compose file

    cd /path/to/reloia_listen
    docker-compose up

#### Login

To login to spotify and load the current playing song, you need to access the following URL:

    /log-in

After logging in, you will be redirected to / and everything should start working.
