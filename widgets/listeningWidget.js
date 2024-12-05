import {createCanvas, loadImage} from "canvas";
import {formatMS} from "../utils.js";

const canva = createCanvas(356, 110);
const ctx = canva.getContext('2d');

export async function listeningWidget(req, res, spotify) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    while (spotify.data.name == "Please wait...") await new Promise(r => setTimeout(r, 1000));

    function evaluateColor(color) {
        if (/[0-9A-Fa-f]{6}/.test(color)) return `#${color}`;
        return color;
    }

// Parameters
    const backgroundColor = evaluateColor(req.query.backgroundColor) || '#1d1c1c';
    const barColor = evaluateColor(req.query.barColor) || '#8c8c8c';
    const barBackgroundColor = evaluateColor(req.query.barBackgroundColor) || '#fff';
    const borderRadius = Number(req.query.borderRadius) || 10;

// Clear the canvas
    ctx.clearRect(0, 0, canva.width, canva.height);

    ctx.fillStyle = backgroundColor;
    ctx.roundRect(0, 0, canva.width, canva.height, borderRadius);
    ctx.fill();

// Load image from url
    const image = await loadImage(spotify.data.album_image);
// Draw image on canvas
    const offX = 10,
        offY = 16;
    const imgSize = canva.height - offY * 2;
    ctx.save()
    ctx.beginPath();
    ctx.roundRect(offX, offY - 5, imgSize, imgSize, borderRadius);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, offX, offY - 5, imgSize, imgSize);
    ctx.restore();
    ctx.save()

// Title of the song
    ctx.fillStyle = '#fff';
    ctx.font = '500 17px sans-serif';
    ctx.fillText(spotify.data.name, imgSize + 20, offY + 16 - 5);
// Artist of the song
    ctx.fillStyle = '#999797';
    ctx.font = 'normal 13px sans-serif';
    ctx.fillText(spotify.data.author, imgSize + 20, offY + 16 - 5 + 15);
// Album of the song
    ctx.fillStyle = '#c0b4b4';
    ctx.font = 'normal 12px sans-serif';
    ctx.fillText(spotify.data.album_name, imgSize + 20, canva.height - 39);

// Wall on the right of the canvas to hide text overflow
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(canva.width - 10, 10, 10, canva.height - 20);

// Time bar of the song
    ctx.fillStyle = '#fff';
// Current time of song
    ctx.font = 'normal 9px sans-serif';
    const cTime = formatMS(spotify.data.progress),
        dTime = formatMS(spotify.data.duration);
    ctx.fillText(cTime, imgSize + 20, canva.height - 24);
// Total time of song
    ctx.fillText(dTime, canva.width - 10 - ctx.measureText(dTime).width, canva.height - 24);
// Time bar
    const timeBarWidth = canva.width - (imgSize + 20 + ctx.measureText(cTime).width + 5) - (10 + ctx.measureText(dTime).width + 5);
    ctx.fillStyle = barBackgroundColor;
    ctx.beginPath();
    ctx.roundRect(imgSize + 20 + ctx.measureText(cTime).width + 5,
        canva.height - 23 - 9.5,
        timeBarWidth,
        10,
        5);
    ctx.closePath()
    ctx.fill();
// Time bar foreground
    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(imgSize + 20 + ctx.measureText(cTime).width + 5,
        canva.height - 23 - 9.5,
        timeBarWidth * (spotify.data.progress / spotify.data.duration),
        10,
        5);
    ctx.closePath()
    ctx.fill();

    ctx.fillStyle = '#8c8c8c';
    ctx.font = 'normal 10px sans-serif';
    const text = 'Go to reloia.github.io to see more    -   made by reloia';
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, canva.width / 2 - textWidth / 2, canva.height - 5)

// output file to the server
    const buffer = canva.toBuffer('image/png');
    res.set('Content-Type', 'image/png');
    res.send(buffer);
}