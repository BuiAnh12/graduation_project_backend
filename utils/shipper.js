const mongoose = require("mongoose");
const Shipper = require("../models/shippers.model");
const findNearestShipper = async (
  storeLat,
  storeLon,
  excludedShippers = [],
  maxDistanceKm = 110000
) => {
  if (!storeLat || !storeLon) throw new Error("Missing store coordinates");

  const [nearestShipper] = await Shipper.aggregate([
    {
      $match: {
        online: true,
        busy: false,
        _id: { $nin: excludedShippers },
        currentLocation: { $exists: true, $ne: null },
      },
    },
    {
      $addFields: {
        distanceKm: {
          $let: {
            vars: {
              lat1: { $toDouble: "$currentLocation.lat" },
              lon1: { $toDouble: "$currentLocation.lon" },
              lat2: { $toDouble: { $literal: storeLat } },
              lon2: { $toDouble: { $literal: storeLon } },
            },
            in: {
              $multiply: [
                6371,
                {
                  $acos: {
                    $min: [
                      1,
                      {
                        $add: [
                          {
                            $multiply: [
                              { $sin: { $degreesToRadians: "$$lat1" } },
                              { $sin: { $degreesToRadians: "$$lat2" } },
                            ],
                          },
                          {
                            $multiply: [
                              { $cos: { $degreesToRadians: "$$lat1" } },
                              { $cos: { $degreesToRadians: "$$lat2" } },
                              {
                                $cos: {
                                  $degreesToRadians: {
                                    $subtract: ["$$lon2", "$$lon1"],
                                  },
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
    {
      $match: { distanceKm: { $lte: maxDistanceKm } },
    },
    { $sort: { distanceKm: 1 } },
    { $limit: 1 },
  ]);

  return nearestShipper || null;
};
module.exports = { findNearestShipper };
