/**
 * ===============================================
 * 🧠 AI Services — Dish Recommendation & Tag System
 * ===============================================
 */

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const mongoose = require("mongoose");
const diacritics = require("diacritics");
const ErrorCode = require("../constants/errorCodes.enum");

// 🧩 Models
const CookingMethodTag = require("../models/cooking_method_tags.model");
const FoodTag = require("../models/food_tags.model");
const CultureTag = require("../models/culture_tags.model");
const TasteTag = require("../models/taste_tags.model");
const Dish = require("../models/dishes.model");
const TagCategory = require("../models/tag_categories.model");
const User = require("../models/users.model");
const UserReference = require("../models/user_references.model");
const { consoleLogger } = require("vnpay");

// 🧠 Python Service URL
const PYTHON_RECOMMEND_URL = "http://localhost:8000";

/* ======================================================
 * 🔹 Helper: Enrich Tags (group by category & schema)
 * ====================================================== */
async function enrichTagsByName(tags) {
    if (!tags || typeof tags !== "object") return [];

    const categoryMapping = {
        cuisine: "culture",
        culture: "culture",
        food: "food",
        taste: "taste",
        cooking_method: "cooking_method",
    };

    const allEnriched = [];

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

        const normalized = found.map((t) => ({
            _id: t._id,
            name: t.name,
            type: mappedCategory,
            tag_categories: t.tag_categories || null,
        }));

        allEnriched.push(...normalized);
    }

    if (allEnriched.length === 0) return [];

    const grouped = {};
    for (const tag of allEnriched) {
        const catId = tag.tag_categories?._id?.toString() || "uncategorized";
        if (!grouped[catId]) {
            grouped[catId] = {
                display_category: tag.tag_categories
                    ? {
                          _id: tag.tag_categories._id,
                          name: tag.tag_categories.name,
                      }
                    : { name: "Uncategorized" },
                tags: [],
            };
        }
        grouped[catId].tags.push({
            _id: tag._id,
            name: tag.name,
            type: tag.type,
        });
    }

    return Object.values(grouped);
}

/* ======================================================
 * 🔹 AI: Predict Tags from Image
 * ====================================================== */
const predictTagService = async (filePath) => {
    if (!filePath) throw ErrorCode.AI_IMAGE_REQUIRED;

    try {
        const formData = new FormData();
        formData.append("image", fs.createReadStream(filePath));

        const { data: result } = await axios.post(
            `${PYTHON_RECOMMEND_URL}/tag/predict`,
            formData,
            { headers: formData.getHeaders() }
        );

        const enrichedTags = await enrichTagsByName(result.tags);

        // cleanup
        fs.unlink(filePath, (err) => {
            if (err)
                console.warn("⚠️ Failed to remove temp file:", err.message);
        });

        return { ...result, post_process: enrichedTags };
    } catch (error) {
        console.error("❌ AI predictTagService error:", error.message);
        throw ErrorCode.AI_PREDICTION_FAILED;
    }
};

/* ======================================================
 * 🔹 AI: Recommend Dishes for User
 * ====================================================== */
const recommendDishService = async (userId, topK = 5) => {
    try {
        let result;
        const payload = { user_id: userId, top_k: topK };

        try {
            // 🔹 Try personalized recommendation first
            const { data } = await axios.post(
                `${PYTHON_RECOMMEND_URL}/dish/recommend`,
                payload
            );
            result = data;
        } catch (err) {
            console.warn("⚠️ User not found in dataset, trying cold start...");
        }

        // 🔹 Fallback: Cold start
        if (!result?.recommendations?.length) {
            const coldPayload = await buildColdStartPayload(userId, topK);
            if (!coldPayload) throw ErrorCode.USER_PROFILE_NOT_FOUND;
            console.log("cold", coldPayload);
            // ❗ Correct URL for cold start (it should call /dish/recommend)
            const { data } = await axios.post(
                `${PYTHON_RECOMMEND_URL}/dish/recommend`,
                coldPayload
            );
            result = data;
        }

        // 🔹 Enrich with MongoDB data
        if (result?.recommendations?.length) {
            const dishNames = result.recommendations.map((r) => r.name);
            const dishes = await Dish.find({
                name: { $in: dishNames },
            }).populate(
                "dishTags tasteTags cookingMethodtags cultureTags image"
            );

            const dishMap = new Map(dishes.map((d) => [d.name, d]));
            result.recommendations = result.recommendations.map((r) => ({
                ...r,
                _id: dishMap.get(r.name)?._id || null,
                metadata: dishMap.get(r.name) || null,
            }));
        }

        return result;
    } catch (error) {
        console.error(
            "❌ recommendDishService error:",
            error?.message || error?.response?.data || error
        );
        throw ErrorCode.AI_RECOMMENDATION_FAILED;
    }
};

/* ======================================================
 * 🔹 Cold Start Builder
 * ====================================================== */
async function buildColdStartPayload(userId, topK) {
    const user = await User.findById(userId);
    const ref = await UserReference.findById(user.user_reference_id)
        .populate("like_taste like_culture like_food")
        .populate("dislike_taste dislike_culture dislike_food")
        .populate("allergy");
    if (!user || !ref) return null;

    const preferences = {
        cuisine: [...new Set(ref.like_culture.map((t) => t.name))],
        taste: [...new Set(ref.like_taste.map((t) => t.name))],
        price_range: "budget",
    };

    const userProfile = {
        age: user.age || 25,
        gender: user.gender || "unknown",
        location: user.location || "unknown",
        preferences,
    };

    const tagIds = {
        like_taste_ids: ref.like_taste.map((t) => t._id),
        like_culture_ids: ref.like_culture.map((t) => t._id),
        dislike_food_ids: ref.dislike_food.map((t) => t._id),
        allergy_ids: ref.allergy.map((t) => t._id),
    };

    return {
        user_profile: userProfile,
        tag_ids: tagIds,
        top_k: topK,
    };
}

/* ======================================================
 * 🔹 AI: Find Similar Dishes
 * ====================================================== */
const similarDishService = async (payload) => {
    try {
        let result;

        // 1. Destructure the full payload, including the new 'sameStore' flag
        const { dish_id, top_k = 5, sameStore = false } = payload;

        // 2. We need the source dish's storeId for the filter.
        // Find the dish in Mongo *once* at the start.
        const sourceDish = await Dish.findById(dish_id).lean();
        if (!sourceDish) {
            throw new Error(`Dish not found in MongoDB: ${dish_id}`);
        }
        // Get the storeId to use as a filter
        const storeIdFilter = sourceDish.storeId.toString();

        // 3. Build the "Hot Start" payload
        const hotPayload = { dish_id, top_k };
        if (sameStore) {
            hotPayload.store_id_filter = storeIdFilter;
            console.log(
                `Finding similar dishes in the same store: ${storeIdFilter}`
            );
        }

        try {
            // 4. 🔹 Try "Hot Start" first
            const { data } = await axios.post(
                `${PYTHON_RECOMMEND_URL}/dish/similar`,
                hotPayload
            );
            result = data;
        } catch (error) {
            console.warn(
                `⚠️ Dish ID ${dish_id} not in Python model, trying cold start fallback...`
            );
        }

        // 5. 🔹 Fallback: Build and run "Cold Start"
        if (!result?.similar_dishes?.length) {
            console.log(`Building cold start profile for dish: ${dish_id}`);

            // We only need the 'profilePayload' since we already have the storeId
            const { profilePayload } = await buildDishColdStartPayload(
                dish_id,
                top_k
            );

            if (!profilePayload) {
                throw new Error(
                    `Failed to build cold profile for dish: ${dish_id}`
                );
            }

            // Add the store filter if needed
            if (sameStore) {
                profilePayload.store_id_filter = storeIdFilter;
                console.log(
                    `(Cold Start) Finding similar in same store: ${storeIdFilter}`
                );
            }

            // Retry the request
            const { data } = await axios.post(
                `${PYTHON_RECOMMEND_URL}/dish/similar`,
                profilePayload
            );
            result = data;
        }

        // 6. 🔹 Enrich with MongoDB data (Unchanged)
        if (result.similar_dishes?.length) {
            const dishNames = result.similar_dishes.map((r) => r.name);

            const dishes = await Dish.find({
                name: { $in: dishNames },
            }).populate(
                "dishTags tasteTags cookingMethodtags cultureTags image"
            );

            const dishMap = new Map(dishes.map((d) => [d.name, d]));

            result.similar_dishes = result.similar_dishes.map((r) => ({
                ...r,
                _id: dishMap.get(r.name)?._id || null,
                metadata: dishMap.get(r.name) || null,
            }));
        }

        return result;
    } catch (error) {
        console.error(
            "❌ similarDishService error:",
            error?.message || error?.response?.data || error
        );
        throw ErrorCode.AI_SIMILAR_DISH_FAILED;
    }
};

/* ======================================================
 * 🔹 Cold start dish payload
 * ====================================================== */

async function buildDishColdStartPayload(dishId, topK) {
    const dish = await Dish.findById(dishId)
        .populate("cultureTags", "name")
        .populate("tasteTags", "name")
        .lean();

    // Return nulls if dish not found
    if (!dish) return { profilePayload: null, storeId: null };

    let priceRange = "any";
    if (dish.price <= 60000) {
        priceRange = "budget";
    } else if (dish.price >= 70000) {
        priceRange = "premium";
    }

    const dishProfile = {
        cuisine: [...new Set(dish.cultureTags.map((t) => t.name))],
        taste: [...new Set(dish.tasteTags.map((t) => t.name))],
        price_range: priceRange,
    };

    const profilePayload = {
        dish_profile: dishProfile,
        top_k: topK,
    };

    // Return both the payload and the storeId
    return { profilePayload, storeId: dish.storeId };
}

/* ======================================================
 * 🔹 AI: Behavior Test Simulation
 * ====================================================== */
const behaviorTestService = async (payload) => {
    try {
        const { data: result } = await axios.post(
            `${PYTHON_RECOMMEND_URL}/behavior/test`,
            payload
        );

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
        console.error("❌ behaviorTestService error:", error.message);
        throw ErrorCode.AI_BEHAVIOR_TEST_FAILED;
    }
};

/* ======================================================
 * 🔹 Export
 * ====================================================== */
module.exports = {
    predictTagService,
    recommendDishService,
    similarDishService,
    behaviorTestService,
};
