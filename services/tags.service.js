const CookingMethodTag = require("../models/cooking_method_tags.model");
const CultureTag = require("../models/culture_tags.model");
const FoodTag = require("../models/food_tags.model");
const TasteTag = require("../models/taste_tags.model");
const ErrorCode = require("../constants/errorCodes.enum");

const getAllCookingMethodTagsService = async () => {
  const tags = await CookingMethodTag.find().populate("tag_categories");
  if (!tags || tags.length === 0) throw ErrorCode.COOKING_METHOD_TAG_NOT_FOUND;
  return tags;
};
const getAllCultureTagsService = async () => {
  const tags = await CultureTag.find().populate("tag_categories");
  if (!tags || tags.length === 0) throw ErrorCode.CULTURE_TAG_NOT_FOUND;
  return tags;
};
const getAllFoodTagsService = async () => {
  const tags = await FoodTag.find().populate("tag_categories");
  if (!tags || tags.length === 0) throw ErrorCode.FOOD_TAG_NOT_FOUND;
  return tags;
};
const getAllTasteTagsService = async () => {
  const tags = await TasteTag.find().populate("tag_categories");
  if (!tags || tags.length === 0) throw ErrorCode.TASTE_TAG_NOT_FOUND;
  return tags;
};

const getAllTagsService = async () => {
  const [cookingMethodTags, cultureTags, foodTags, tasteTags] =
    await Promise.all([
      getAllCookingMethodTagsService(),
      getAllCultureTagsService(),
      getAllFoodTagsService(),
      getAllTasteTagsService(),
    ]);

  return {
    cookingMethodTags,
    cultureTags,
    foodTags,
    tasteTags,
  };
};

module.exports = {
  getAllCookingMethodTagsService,
  getAllCultureTagsService,
  getAllFoodTagsService,
  getAllTasteTagsService,
  getAllTagsService,
};
