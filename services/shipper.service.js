const mongoose = require("mongoose");
const Account = require("../models/accounts.model");
const Shipper = require("../models/shippers.model");
const ErrorCode = require("../constants/errorCodes.enum");

// Request
const getShipperRequestsService = async (
  page = 1,
  limit = 10,
  search = "",
  sort = "createdAt_desc"
) => {
  const skip = (page - 1) * limit;

  // Build query cho tên shipper
  const query = { firstCheck: true };
  if (search && search.trim() !== "") {
    query.name = { $regex: search.trim(), $options: "i" };
  }

  // Sắp xếp
  const sortOption = {
    createdAt_desc: { createdAt: -1 },
    createdAt_asc: { createdAt: 1 },
    name_asc: { name: 1 },
    name_desc: { name: -1 },
  }[sort] || { createdAt: -1 };

  let shippers = await Shipper.find(query)
    .populate("accountId", "blocked")
    .populate("vehicleId", "vehicleNumber vehicleType vehicleColor")
    .populate("avatarImage", "url")
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  const totalShippers = await Shipper.countDocuments(query);
  const totalPages = Math.ceil(totalShippers / limit);

  return {
    shippers,
    totalShippers,
    totalPages,
    currentPage: page,
  };
};

const approveShipperRequestService = async (shipperId) => {
  const shipper = await Shipper.findById(shipperId).populate("accountId");
  if (!shipper) throw ErrorCode.SHIPPER_NOT_FOUND;

  if (!shipper.firstCheck) throw ErrorCode.SHIPPER_ALREADY_ACTIVE;

  // Update firstCheck
  shipper.firstCheck = false;
  await shipper.save();

  // Đồng bộ account
  if (shipper.accountId) {
    const account = await Account.findById(shipper.accountId._id);
    if (account.blocked) {
      account.blocked = false;
      await account.save();
    }
  }

  return {
    shipperId: shipper._id,
    firstCheck: shipper.firstCheck,
    accountBlocked: false,
  };
};
// Management
const getAllShipperService = async (query) => {
  const {
    search = "",
    sortBy = "createdAt",
    order = "desc",
    blocked,
    page = 1,
    limit = 10,
  } = query;

  const filter = { firstCheck: false };

  // --- Convert blocked query string sang boolean ---
  let blockedBool;
  if (blocked === "true") blockedBool = true;
  else if (blocked === "false") blockedBool = false;

  // --- Search filter ---
  if (search.trim() !== "") {
    filter.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { email: { $regex: search.trim(), $options: "i" } },
    ];
  }

  // --- Build aggregation pipeline ---
  const pipeline = [
    { $match: filter },
    // Join account
    {
      $lookup: {
        from: "accounts",
        localField: "accountId",
        foreignField: "_id",
        as: "account",
      },
    },
    { $unwind: "$account" },
    // Join vehicle
    {
      $lookup: {
        from: "vehicles",
        localField: "vehicleId",
        foreignField: "_id",
        as: "vehicle",
      },
    },
    { $unwind: { path: "$vehicle", preserveNullAndEmptyArrays: true } },
  ];

  // --- Filter blocked nếu có ---
  if (blockedBool !== undefined) {
    pipeline.push({ $match: { "account.blocked": blockedBool } });
  }

  // --- Sort ---
  const sort = {};
  sort[sortBy] = order === "asc" ? 1 : -1;
  pipeline.push({ $sort: sort });

  // --- Pagination ---
  const skip = (page - 1) * limit;
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: parseInt(limit) });

  // --- Execute ---
  let shipperList = await Shipper.aggregate(pipeline);

  // --- Total count ---
  const countPipeline = [...pipeline];
  countPipeline.pop(); // remove $limit
  countPipeline.pop(); // remove $skip
  countPipeline.push({ $count: "totalItems" });
  const countResult = await Shipper.aggregate(countPipeline);
  const totalItems = countResult[0]?.totalItems || 0;
  const totalPages = Math.ceil(totalItems / limit);

  return {
    shippers: shipperList,
    meta: {
      totalItems,
      totalPages,
      currentPage: parseInt(page),
      limit: parseInt(limit),
    },
  };
};
const toggleShipperAccountStatusService = async (shipperId) => {
  const shipper = await Shipper.findById(shipperId);
  if (!shipper) throw ErrorCode.SHIPPER_NOT_FOUND;

  // Tìm account liên kết
  const account = await Account.findById(shipper.accountId);
  if (!account) throw ErrorCode.ACCOUNT_NOT_FOUND;

  // Cập nhật trạng thái khóa
  account.blocked = !account.blocked;
  await account.save();

  return {
    success: true,
    blocked: account.blocked,
    message: `Account has been ${
      account.blocked ? "blocked" : "unblocked"
    } successfully.`,
  };
};

module.exports = {
  getShipperRequestsService,
  approveShipperRequestService,
  getAllShipperService,
  toggleShipperAccountStatusService,
};
