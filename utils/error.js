function errorResponse(message, code = 400) {
    const err = new Error(message);
    err.code = code;
    return err;
}

module.exports = errorResponse;