export function getBaseURL() {
    let baseUrl = process.env.PROJECT_DOMAIN || "";
    if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}.glitch.me`;

    if (baseUrl.startsWith("https://.glitch")) throw new Error("The project domain is not set, please set it in the .env file");

    return baseUrl;
}

/**
 *
 * @param {Response} res
 * @param {Number} err
 * @param {String} message
 */
export function handleErrors(res, err, message) {
    res.status(err).send({
        code: err,
        message
    });
}