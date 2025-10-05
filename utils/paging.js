const getPaginatedData = async (Model, filterOptions = {}, populateFields = [], limit = null, page = null, sort = { createdAt: -1 }) => {
  try {
    let query = Model.find(filterOptions);
    if (sort) {
      query = query.sort(sort);
    }
    let totalItems = await Model.countDocuments(filterOptions).collation({ locale: "vi", strength: 1 });
    let totalPages = 0;

    if (limit && page) {
      if (page < 1) {
        throw new Error("Invalid page number");
      }
      limit = parseInt(limit);
      page = parseInt(page);
      totalPages = Math.ceil(totalItems / limit);
      const skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }

    // Populate fields if specified
    if (populateFields) {
      if (populateFields == "user") {
        query = query.populate({
          path: "user",
          select: "name avatar",
        });
      } else if (populateFields == "user dishes") {
        query = query
          .populate({
            path: "user",
            select: "name avatar",
          })
          .populate("dishes")
          .populate("store");
      } else {
        query = query.populate(populateFields);
      }
    }

    // Fetch data
    const data = await query.lean();

    return {
      success: true,
      total: totalItems,
      totalPages,
      currentPage: page || null,
      pageSize: limit || null,
      data,
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = { getPaginatedData };
