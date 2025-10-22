const FoodTag = require("../models/food_tags.model");
const TasteTag = require("../models/taste_tags.model");
const CultureTag = require("../models/culture_tags.model");
const CookingMethodTag = require("../models/cooking_method_tags.model");
const ErrorCode = require("../constants/errorCodes.enum");

/**
 * Fetch all available tags grouped by type.
 */
const getAllTagsService = async () => {
  try {
    const [food, taste, culture, cooking_method] = await Promise.all([
      FoodTag.find().select("_id name"),
      TasteTag.find().select("_id name"),
      CultureTag.find().select("_id name"),
      CookingMethodTag.find().select("_id name"),
    ]);

    return {
      food,
      taste,
      culture,
      cooking_method,
    };
  } catch (err) {
    console.error("getAllTagsService error:", err.message);
    throw ErrorCode.TAG_FETCH_FAILED;
  }
};

module.exports = { getAllTagsService };
