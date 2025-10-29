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

const createPreferenceSets = (userReference) => {
    if (!userReference) return null;
    const toSet = (arr = []) => new Set(arr.map((id) => id.toString())); // Add default empty array
    return {
        allergy: toSet(userReference.allergy),
        dislike_food: toSet(userReference.dislike_food),
        dislike_taste: toSet(userReference.dislike_taste),
        dislike_cooking: toSet(userReference.dislike_cooking_method),
        dislike_culture: toSet(userReference.dislike_culture),
    };
};

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
const recommendDishService = async (userId, topK = 5, userReference = null) => {
    try {
        // --- 1. Log Initial Inputs ---
        // console.log("--- Starting recommendDishService ---");
        // console.log("UserId:", userId);
        // console.log("Requested topK:", topK);
        // console.log("User Reference Provided:", !!userReference);

        let aiResult;
        const K_MULTIPLIER = 3; // Fetch more for filtering
        const original_top_k = topK;
        const requested_k = original_top_k * K_MULTIPLIER;

        // Prepare preference sets for filtering
        const prefSets = createPreferenceSets(userReference); // Use the same helper function
        if (prefSets) {
            // console.log("Preference Sets Created (for filtering):");
            // console.log(" - Allergy:", Array.from(prefSets.allergy));
            // console.log(" - Dislike Food:", Array.from(prefSets.dislike_food));
            // ... log other dislike sets ...
        }

        // --- 2. Call AI Model (Personalized / Cold Start Fallback) ---
        // Payload for personalized call (if userId exists)
        const personalizedPayload = userId
            ? { user_id: userId.toString(), top_k: requested_k }
            : null;

        if (personalizedPayload) {
            try {
                // 2a. Try personalized recommendation first
                // console.log(
                //     "Attempting personalized recommendations for user:",
                //     userId
                // );
                const { data } = await axios.post(
                    `${PYTHON_RECOMMEND_URL}/dish/recommend`,
                    personalizedPayload
                );
                aiResult = data;
                // console.log(
                //     `Personalized call successful, got ${
                //         aiResult?.recommendations?.length || 0
                //     } results.`
                // );
            } catch (err) {
                // console.warn(
                //     `⚠️ Personalized recommendation failed for user ${userId} (User might be new). Trying cold start...`
                // );
                // Error logged, proceed to cold start below
            }
        } else {
            // console.log(
            //     "No userId provided, proceeding directly to cold start/generic."
            // );
        }

        // 2b. Fallback: Cold start (if personalized failed or no userId)
        if (!aiResult?.recommendations?.length) {
            // console.log("Attempting cold start recommendations.");
            // Build cold payload (adapt buildColdStartPayload if necessary to accept requested_k)
            const coldPayload = await buildColdStartPayload(
                userId,
                requested_k
            ); // Pass requested_k
            if (!coldPayload) {
                // console.error("Failed to build cold start payload.");
                throw (
                    ErrorCode.USER_PROFILE_NOT_FOUND ||
                    new Error("Cannot build user profile for recommendations.")
                );
            }
            // console.log("Cold start payload:", JSON.stringify(coldPayload));

            const { data } = await axios.post(
                `${PYTHON_RECOMMEND_URL}/dish/recommend`, // Use the recommend endpoint
                coldPayload
            );
            aiResult = data;
            // console.log(
            //     `Cold start call successful, got ${
            //         aiResult?.recommendations?.length || 0
            //     } results.`
            // );
        }

        // --- 3. Log Raw AI Result ---
        // console.log("Raw AI Result:", JSON.stringify(aiResult, null, 2));

        // --- 4. Enrich with MongoDB Data ---
        let enrichedDishes = [];
        if (aiResult?.recommendations?.length) {
            // AI likely returns dish names or IDs
            const recommendedIdsOrNames = aiResult.recommendations.map(
                (r) => r.dish_id || r.name
            );
            const isUsingNames = !aiResult.recommendations[0]?.dish_id;
            let queryField = isUsingNames ? "name" : "_id";

            // console.log(
            //     `Querying Mongo for ${queryField} IN:`,
            //     recommendedIdsOrNames
            // );
            const mongoDishes = await Dish.find({
                [queryField]: { $in: recommendedIdsOrNames },
            }).populate(
                "dishTags tasteTags cookingMethodtags cultureTags image categories"
            ); // Populate all needed fields

            // console.log(`Found ${mongoDishes.length} dishes in Mongo.`);
            if (mongoDishes.length > 0) {
                // console.log(
                //     "Example Mongo Dish (for enrichment):",
                //     JSON.stringify(mongoDishes[0], null, 2)
                // );
            }

            const dishMap = new Map(
                mongoDishes.map((d) => [
                    isUsingNames ? d.name : d._id.toString(),
                    d,
                ])
            );

            enrichedDishes = aiResult.recommendations
                .map((r) => {
                    const key = isUsingNames ? r.name : r.dish_id?.toString();
                    const mongoData = dishMap.get(key);
                    if (!mongoData) return null;
                    return { ...r, _id: mongoData._id, metadata: mongoData };
                })
                .filter(Boolean);

            // console.log(`Enriched ${enrichedDishes.length} dishes.`);
        } else {
            // console.log("AI returned no recommendations.");
            // If AI gives nothing, return empty or throw error based on requirements
            return { recommendations: [] }; // Return empty array if AI fails initially
            // Or: throw ErrorCode.AI_NO_RECOMMENDATIONS_FOUND || new Error("No recommendations found by AI.");
        }

        // --- 5. Filter Based on User Preferences ---
        let filteredDishes = enrichedDishes; // Start with all enriched dishes
        if (prefSets) {
            // Only filter if user preferences are available
            // console.log("--- Starting Filtering based on preferences ---");
            filteredDishes = enrichedDishes.filter((dishData) => {
                const dishName =
                    dishData.metadata?.name || dishData.name || dishData._id;
                // console.log(
                //     `\nFiltering recommended dish: ${dishName} (ID: ${dishData._id})`
                // );

                const dishTags = dishData.metadata; // Full dish object
                if (!dishTags) {
                    // console.warn(
                    //     ` -> Warning: Missing metadata for ${dishName}. Keeping it.`
                    // );
                    return true;
                }

                // Log tags being checked (similar to similarDishService debug logs)
                // console.log(
                //     `   Dish Tags: ${dishTags.dishTags
                //         ?.map((t) => t?._id || t)
                //         .join(", ")}`
                // );
                // ... log other tag types ...

                // Check Allergies
                if (
                    dishTags.dishTags?.some((tag) =>
                        prefSets.allergy.has((tag._id || tag).toString())
                    )
                ) {
                    // console.log(` -> Removed: Allergy match.`);
                    return false;
                }
                // Check Dislikes
                if (
                    dishTags.dishTags?.some((tag) =>
                        prefSets.dislike_food.has((tag._id || tag).toString())
                    )
                ) {
                    // console.log(` -> Removed: Disliked food.`);
                    return false;
                }
                if (
                    dishTags.tasteTags?.some((tag) =>
                        prefSets.dislike_taste.has((tag._id || tag).toString())
                    )
                ) {
                    // console.log(` -> Removed: Disliked taste.`);
                    return false;
                }
                if (
                    dishTags.cookingMethodtags?.some((tag) =>
                        prefSets.dislike_cooking.has(
                            (tag._id || tag).toString()
                        )
                    )
                ) {
                    // console.log(` -> Removed: Disliked cooking method.`);
                    return false;
                }
                if (
                    dishTags.cultureTags?.some((tag) =>
                        prefSets.dislike_culture.has(
                            (tag._id || tag).toString()
                        )
                    )
                ) {
                    // console.log(` -> Removed: Disliked culture.`);
                    return false;
                }

                // console.log(` -> Kept: Passed preference filters.`);
                return true;
            });
            // console.log("--- Filtering Complete ---");
        } else {
            // console.log(
            //     "Skipping preference filtering (no userReference provided)."
            // );
        }

        // --- 6. Limit Results and Handle No Suitable Dishes ---
        const finalDishes = filteredDishes.slice(0, original_top_k);
        // console.log(
        //     `Final dish count after filtering/slicing: ${finalDishes.length}`
        // );

        // Decide what to do if filtering removes everything
        if (finalDishes.length === 0 && enrichedDishes.length > 0 && prefSets) {
            // console.warn(
            //     `No suitable recommendations found for user ${userId} *after filtering*.`
            // );
            // Option 1: Return empty array
            return { recommendations: [] };
            // Option 2: Throw a specific error
            // throw ErrorCode.AI_NO_SUITABLE_RECOMMENDATIONS_FOUND || new Error("No suitable recommendations found after filtering.");
        }

        // Return the final structure
        return { recommendations: finalDishes };
    } catch (error) {
        console.error(
            "❌ recommendDishService error:",
            error?.message || error?.response?.data || error
        );
        // Rethrow specific errors or a generic one
        if (error.message.includes("No suitable recommendations")) {
            throw error;
        }
        throw (
            ErrorCode.AI_RECOMMENDATION_FAILED ||
            new Error("Failed to get recommendations.")
        );
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
const similarDishService = async (payload, userReference = null) => {
    try {
        // --- 1. Log Initial Inputs ---
        // console.log("--- Starting similarDishService ---");
        // console.log("Payload:", JSON.stringify(payload, null, 2));
        // console.log("User Reference Provided:", !!userReference);
        // if(userReference) console.log("User Reference ID:", userReference._id); // Log ID if present

        let aiResult;
        const K_MULTIPLIER = 2;
        const { dish_id, top_k = 5, sameStore = false } = payload;
        const original_top_k = top_k;
        const requested_k = original_top_k * K_MULTIPLIER;

        const sourceDish = await Dish.findById(dish_id).lean();
        if (!sourceDish) {
            throw new Error(`Source Dish not found: ${dish_id}`);
        }
        const storeIdFilter = sameStore ? sourceDish.storeId.toString() : null;
        const sourceDishIdString = sourceDish._id.toString();

        const prefSets = createPreferenceSets(userReference);
        // --- 2. Log Preference Sets ---
        if (prefSets) {
            // console.log("Preference Sets Created:");
            // console.log(" - Allergy:", Array.from(prefSets.allergy));
            // console.log(" - Dislike Food:", Array.from(prefSets.dislike_food));
            // console.log(" - Dislike Taste:", Array.from(prefSets.dislike_taste));
            // console.log(" - Dislike Cooking:", Array.from(prefSets.dislike_cooking));
            // console.log(" - Dislike Culture:", Array.from(prefSets.dislike_culture));
        } else {
            // console.log("No preference sets created (userReference likely null).");
        }

        const basePayload = { dish_id, top_k: requested_k };
        if (storeIdFilter) basePayload.store_id_filter = storeIdFilter;

        try {
            const { data } = await axios.post(
                `${PYTHON_RECOMMEND_URL}/dish/similar`,
                basePayload
            );
            aiResult = data;
            // console.log(`AI Call successful, got ${aiResult?.similar_dishes?.length || 0} results.`);
        } catch (error) {
            // ... (Cold start fallback logic - assumed correct for now) ...
            //  console.warn(`⚠️ Hot start failed for ${dish_id}, trying cold start...`);
            const { profilePayload } = await buildDishColdStartPayload(
                dish_id,
                requested_k
            );
            if (!profilePayload)
                throw new Error(
                    `Failed to build cold profile for dish: ${dish_id}`
                );
            if (storeIdFilter) profilePayload.store_id_filter = storeIdFilter;
            const { data } = await axios.post(
                `${PYTHON_RECOMMEND_URL}/dish/similar`,
                profilePayload
            );
            aiResult = data;
            //  console.log(`Cold start successful, got ${aiResult?.similar_dishes?.length || 0} results.`);
        }

        // --- 3. Log Raw AI Result ---
        // console.log("Raw AI Result:", JSON.stringify(aiResult, null, 2));

        let enrichedDishes = [];
        if (aiResult?.similar_dishes?.length) {
            const recommendedIdsOrNames = aiResult.similar_dishes.map(
                (r) => r.dish_id || r.name
            );
            const isUsingNames = !aiResult.similar_dishes[0]?.dish_id;
            let queryField = isUsingNames ? "name" : "_id";

            // --- 4. Log Mongo Query ---
            // console.log(`Querying Mongo for ${queryField} IN:`, recommendedIdsOrNames);

            const mongoDishes = await Dish.find({
                [queryField]: { $in: recommendedIdsOrNames },
            }).populate(
                "dishTags tasteTags cookingMethodtags cultureTags image categories"
            );

            // --- 5. Log Mongo Results (Check Populated Fields) ---
            // console.log(`Found ${mongoDishes.length} dishes in Mongo.`);
            // Log details of the first dish found to verify population
            if (mongoDishes.length > 0) {
                //  console.log("Example Mongo Dish (check populated tags):", JSON.stringify(mongoDishes[0], null, 2));
            }

            const dishMap = new Map(
                mongoDishes.map((d) => [
                    isUsingNames ? d.name : d._id.toString(),
                    d,
                ])
            );

            enrichedDishes = aiResult.similar_dishes
                .map((r) => {
                    const key = isUsingNames ? r.name : r.dish_id?.toString();
                    const mongoData = dishMap.get(key);
                    if (!mongoData) {
                        //  console.warn(`Dish "${key}" from AI not found in Mongo results.`);
                        return null;
                    }
                    return { ...r, _id: mongoData._id, metadata: mongoData };
                })
                .filter(Boolean);

            // --- 6. Log Enriched Dishes (Before Filtering) ---
            //  console.log(`Enriched ${enrichedDishes.length} dishes.`);
            if (enrichedDishes.length > 0) {
                //  console.log("First Enriched Dish (metadata included):", JSON.stringify(enrichedDishes[0], null, 2));
            }
        } else {
            // console.log("AI returned no similar dishes. Throwing error.");
            throw (
                ErrorCode.AI_NO_SUITABLE_DISHES_FOUND ||
                new Error("No similar dishes found by AI.")
            );
        }

        // --- 7. Filtering Process ---
        // console.log("--- Starting Filtering ---");
        let filteredDishes = enrichedDishes.filter((dishData) => {
            const dishName =
                dishData.metadata?.name || dishData.name || dishData._id; // Get a name for logging
            // console.log(`\nFiltering dish: ${dishName} (ID: ${dishData._id})`);

            // Filter source dish
            if (dishData._id.toString() === sourceDishIdString) {
                // console.log(` -> Removed: Is source dish.`);
                return false;
            }

            // Skip filtering if no user prefs
            if (!prefSets) {
                // console.log(` -> Kept: No user preferences.`);
                return true;
            }

            const dishTags = dishData.metadata; // Full dish object
            if (!dishTags) {
                // console.warn(` -> Warning: Missing metadata for ${dishName}. Keeping it.`);
                return true; // Keep if metadata somehow missing
            }

            // --- 8. Log Tag Arrays Being Checked ---
            // console.log(`   Dish Tags: ${dishTags.dishTags?.map(t => t?._id || t).join(', ')}`);
            // console.log(`   Taste Tags: ${dishTags.tasteTags?.map(t => t?._id || t).join(', ')}`);
            // console.log(`   Cooking Tags: ${dishTags.cookingMethodtags?.map(t => t?._id || t).join(', ')}`);
            // console.log(`   Culture Tags: ${dishTags.cultureTags?.map(t => t?._id || t).join(', ')}`);

            // Check Allergies
            if (
                dishTags.dishTags?.some((tag) =>
                    prefSets.allergy.has((tag._id || tag).toString())
                )
            ) {
                // Handle populated vs non-populated
                // console.log(` -> Removed: Allergy match found.`);
                return false;
            }

            // Check Dislikes
            if (
                dishTags.dishTags?.some((tag) =>
                    prefSets.dislike_food.has((tag._id || tag).toString())
                )
            ) {
                // console.log(` -> Removed: Disliked food match found.`);
                return false;
            }
            if (
                dishTags.tasteTags?.some((tag) =>
                    prefSets.dislike_taste.has((tag._id || tag).toString())
                )
            ) {
                //  console.log(` -> Removed: Disliked taste match found.`);
                return false;
            }
            if (
                dishTags.cookingMethodtags?.some((tag) =>
                    prefSets.dislike_cooking.has((tag._id || tag).toString())
                )
            ) {
                //  console.log(` -> Removed: Disliked cooking method match found.`);
                return false;
            }
            if (
                dishTags.cultureTags?.some((tag) =>
                    prefSets.dislike_culture.has((tag._id || tag).toString())
                )
            ) {
                //  console.log(` -> Removed: Disliked culture match found.`);
                return false;
            }

            // console.log(` -> Kept: Passed all filters.`);
            return true;
        });
        // console.log("--- Filtering Complete ---");

        // --- 9. Log Final Results ---
        const finalDishes = filteredDishes.slice(0, original_top_k);
        // console.log(`Final dish count after filtering and slicing: ${finalDishes.length}`);

        if (finalDishes.length === 0 && enrichedDishes.length > 0) {
            // Check if filtering removed everything
            // console.warn(`No suitable similar dishes found for ${dish_id} *after filtering*.`);
            throw (
                ErrorCode.AI_NO_SUITABLE_DISHES_FOUND ||
                new Error("No suitable similar dishes found after filtering.")
            );
        } else if (finalDishes.length === 0) {
            //  console.warn(`No similar dishes found at all for ${dish_id}.`); // Should have been caught earlier
            throw (
                ErrorCode.AI_NO_SUITABLE_DISHES_FOUND ||
                new Error("No similar dishes found.")
            );
        }

        return { similar_dishes: finalDishes };
    } catch (error) {
        console.error("❌ similarDishService error:", error?.message || error);
        // Rethrow specific known errors or a generic one
        if (error.message.includes("No suitable similar dishes")) {
            // Check message if specific code isn't thrown
            throw error; // Rethrow the specific error
        }
        throw (
            ErrorCode.AI_SIMILAR_DISH_FAILED ||
            new Error("Failed to get similar dishes.")
        );
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
