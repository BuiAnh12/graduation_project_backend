const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const mongoose = require("mongoose");
const ErrorCode = require("../constants/errorCodes.enum");
const diacritics = require("diacritics");

const CookingMethodTag = require("../models/cooking_method_tags.model");
const FoodTag = require("../models/food_tags.model");
const CultureTag = require("../models/culture_tags.model");
const TasteTag = require("../models/taste_tags.model");
const Dish = require("../models/dishes.model");
const TagCategory = require("../models/tag_categories.model");

/* --------------------------------------------
 * 🔹 Helper: Enrich Tag Objects from MongoDB
 * -------------------------------------------- */
async function enrichTagsByName(tags) {
    if (!tags || typeof tags !== "object") return [];

    const categoryMapping = {
        cuisine: "culture",
        culture: "culture",
        food: "food",
        taste: "taste",
        cooking_method: "cooking_method",
    };

    // Temporary collector for all enriched tags (from all schemas)
    let allEnrichedTags = [];

    // 1️⃣ Query from each schema and populate tag_categories
    for (const [category, tagList] of Object.entries(tags)) {
        if (!Array.isArray(tagList) || tagList.length === 0) continue;

        const mappedCategory = categoryMapping[category] || category;
        let found = [];

        switch (mappedCategory) {
            case "food":
                found = await FoodTag.find({ name: { $in: tagList } })
                    .populate("tag_categories")
                    .lean();
                break;
            case "taste":
                found = await TasteTag.find({ name: { $in: tagList } })
                    .populate("tag_categories")
                    .lean();
                break;
            case "culture":
                found = await CultureTag.find({ name: { $in: tagList } })
                    .populate("tag_categories")
                    .lean();
                break;
            case "cooking_method":
                found = await CookingMethodTag.find({ name: { $in: tagList } })
                    .populate("tag_categories")
                    .lean();
                break;
            default:
                continue;
        }

        // Add "type" field to distinguish schema
        const normalized = found.map((t) => ({
            _id: t._id,
            name: t.name,
            type: mappedCategory,
            tag_categories: t.tag_categories || null,
        }));

        allEnrichedTags.push(...normalized);
    }

    if (allEnrichedTags.length === 0) return [];

    // 2️⃣ Group by display category (tag_categories)
    const groupedByDisplayCategory = {};

    for (const tag of allEnrichedTags) {
        const catId = tag.tag_categories?._id?.toString() || "uncategorized";

        if (!groupedByDisplayCategory[catId]) {
            groupedByDisplayCategory[catId] = {
                display_category: tag.tag_categories
                    ? {
                          _id: tag.tag_categories._id,
                          name: tag.tag_categories.name,
                      }
                    : { name: "Uncategorized" },
                tags: [],
            };
        }

        groupedByDisplayCategory[catId].tags.push({
            _id: tag._id,
            name: tag.name,
            type: tag.type, // schema source
        });
    }

    // 3️⃣ Convert to final array
    const final = Object.values(groupedByDisplayCategory);

    return final;
}


/* --------------------------------------------
 * 🔹 AI: Predict Dish Tags
 * -------------------------------------------- */
const predictTagService = async (filePath) => {
    if (!filePath) throw ErrorCode.AI_IMAGE_REQUIRED;

    try {
        const formData = new FormData();
        formData.append("image", fs.createReadStream(filePath));

        const pythonResponse = await axios.post(
            "http://localhost:8000/tag/predict",
            formData,
            {
                headers: formData.getHeaders(),
            }
        );

        const result = pythonResponse.data;
        const enrichedTags = await enrichTagsByName(result.tags);

        // Clean up uploaded temp file
        fs.unlink(filePath, (err) => {
            if (err) console.warn("Temp file cleanup failed:", err.message);
        });

        return {
            ...result,
            post_preocess: enrichedTags,
        };
    } catch (error) {
        console.error("AI predictTagService error:", error.message);
        throw ErrorCode.AI_PREDICTION_FAILED;
    }
};

/* --------------------------------------------
 * 🔹 AI: Recommend Dishes
 * -------------------------------------------- */
const recommendDishService = async (payload) => {
    try {
        const pythonResponse = await axios.post(
            "http://localhost:8000/dish/recommend",
            payload
        );
        const result = pythonResponse.data;

        if (result.recommendations?.length) {
            const dishNames = result.recommendations.map((r) => r.name);
            console.log(dishNames)
            const dishes = await Dish.find({ name: { $in: dishNames } });
            console.log(dishes)
            result.recommendations = result.recommendations.map((r) => ({
                ...r,
                _id: dishes.find((d) => d.name === r.name)?._id || null,
                metadata: dishes.find((d) => d.name === r.name) ? dishes.find((d) => d.name === r.name) : null,
            }));
        }

        return result;
    } catch (error) {
        console.error("AI recommendDishService error:", error.message);
        throw ErrorCode.AI_RECOMMENDATION_FAILED;
    }
};

/* --------------------------------------------
 * 🔹 AI: Find Similar Dishes
 * -------------------------------------------- */
const similarDishService = async (payload) => {
    try {
        const pythonResponse = await axios.post(
            "http://localhost:8000/dish/similar",
            payload
        );
        const result = pythonResponse.data;

        if (result.similar_dishes?.length) {
            const names = result.similar_dishes.map((d) => d.name);
            const dishes = await Dish.find({ name: { $in: names } });

            result.similar_dishes = result.similar_dishes.map((d) => ({
                ...d,
                _id: dishes.find((x) => x.name === d.name)?._id || null,
            }));
        }

        return result;
    } catch (error) {
        console.error("AI similarDishService error:", error.message);
        throw ErrorCode.AI_SIMILAR_DISH_FAILED;
    }
};

/* --------------------------------------------
 * 🔹 AI: Behavior Scenario Test
 * -------------------------------------------- */
const behaviorTestService = async (payload) => {
    try {
        const pythonResponse = await axios.post(
            "http://localhost:8000/behavior/test",
            payload
        );
        const result = pythonResponse.data;

        if (result.result?.recommendations?.length) {
            const dishNames = result.result.recommendations.map((r) => r.dish);
            const dishes = await Dish.find({ name: { $in: dishNames } });

            result.result.recommendations = result.result.recommendations.map(
                (r) => ({
                    ...r,
                    _id: dishes.find((d) => d.name === r.dish)?._id || null,
                })
            );
        }

        return result;
    } catch (error) {
        console.error("AI behaviorTestService error:", error.message);
        throw ErrorCode.AI_BEHAVIOR_TEST_FAILED;
    }
};

module.exports = {
    predictTagService,
    recommendDishService,
    similarDishService,
    behaviorTestService,
};
