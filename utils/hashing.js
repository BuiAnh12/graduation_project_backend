const crypto = require("crypto");
const hashPassword = (password, salt) => {
    return crypto
        .pbkdf2Sync(password, salt, 1000, 64, "sha512")
        .toString("hex");
};

module.exports = {
    hashPassword
}