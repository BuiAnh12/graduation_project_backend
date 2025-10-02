const Store = require("../models/stores.model");

const getStoreIdFromUser = async (userId) => {
    const store = await Store.findOne({
        $or: [{ owner: userId }, { staff: userId }],
    });
    if (!store) throw createError(404, "Store not found");
    return store._id;
};
module.exports = { getStoreIdFromUser };