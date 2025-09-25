const Counter = require("../models/counters.model");

const getNextSequence = async (storeId, type) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const counter = await Counter.findOneAndUpdate(
    { storeId, type, date: startOfDay },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return counter.seq;
};

module.exports = { getNextSequence };
