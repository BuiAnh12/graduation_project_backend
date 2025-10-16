import os
import io
import json
import torch
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoFeatureExtractor, AutoModelForImageClassification
from PIL import Image
import numpy as np
from scripts.train_mock_model import SimpleTwoTowerModel, MockDataset, MockDataPreprocessor
from scripts.evaluate_mock_model import ModelEvaluator

# ==================================================
# APP SETUP
# ==================================================
app = FastAPI(title="Dish Recognition & Recommendation API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================
# MODEL INITIALIZATION
# ==================================================

# --- 1. Tag Recognition Model (Image Classification)
try:
    TAGS_PATH = "data/dish_tags.json"
    with open(TAGS_PATH, "r", encoding="utf-8") as f:
        dish_tags = json.load(f)
except FileNotFoundError:
    raise RuntimeError(f"Missing file: {TAGS_PATH}")

try:
    extractor = AutoFeatureExtractor.from_pretrained("nateraw/food")
    tag_model = AutoModelForImageClassification.from_pretrained("nateraw/food")
    tag_model.eval()
except Exception as e:
    raise RuntimeError(f"Failed to load food tag model: {e}")

# --- 2. Recommendation Model (Two-Tower)
# Check if model exists
MODEL_PATH = 'runs/mock_training/best_model.pth'
MODEL_INFO_PATH = 'runs/mock_training/model_info.json'

if not os.path.exists(MODEL_PATH):
    print(f"Model not found at {MODEL_PATH}")
    print("Please run the training script first: python scripts/train_mock_model.py")
    

if not os.path.exists(MODEL_INFO_PATH):
    print(f"Model info not found at {MODEL_INFO_PATH}")
    print("Please run the training script first: python scripts/train_mock_model.py")
    

if not os.path.exists(MODEL_PATH) or not os.path.exists(MODEL_INFO_PATH):
    raise RuntimeError("Recommendation model files missing. Train the model first.")

evaluator = ModelEvaluator(
    model_path=MODEL_PATH,
    model_info_path=MODEL_INFO_PATH,
    data_dir="data"
)

with open("data/test_scenarios.json", "r", encoding="utf-8") as f:
    test_behaviors = json.load(f)
    
    
def to_serializable(obj):
    if isinstance(obj, np.generic):
        return obj.item()
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_serializable(i) for i in obj]
    return obj


# ==================================================
# REQUEST SCHEMAS
# ==================================================

class UserProfile(BaseModel):
    age: int | None = None
    gender: str | None = None
    location: str | None = None
    preferences: dict | None = None

class DishProfile(BaseModel):
    name: str | None = None
    cuisine: str | None = None
    taste_profile: list[str] | None = None
    price: float | None = None
    category: str | None = None

class RecommendationRequest(BaseModel):
    user_id: str | None = None
    user_profile: UserProfile | None = None
    top_k: int = 10

class SimilarDishRequest(BaseModel):
    dish_profile: DishProfile
    top_k: int = 5

class BehaviorTestRequest(BaseModel):
    behavior_name: str

# ==================================================
# TAG PREDICTION ENDPOINT
# ==================================================
@app.post("/tag/predict")
async def predict_dish(image: UploadFile = File(...)):
    """
    Predict dish category from an uploaded image.
    Supports multipart/form-data uploads.
    """
    try:
        if not image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image.")

        image_bytes = await image.read()
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Preprocess
        inputs = extractor(images=img, return_tensors="pt")

        with torch.no_grad():
            outputs = tag_model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            pred_idx = probs.argmax(-1).item()

        pred_label = tag_model.config.id2label[pred_idx]
        confidence = float(probs[0][pred_idx].item())
        tags = dish_tags.get(pred_label, [])

        response = {
            "success": True,
            "predicted_label": pred_label,
            "confidence": round(confidence, 4),
            "tags": tags,
        }
        
        return to_serializable(response)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {e}")

# ==================================================
# RECOMMENDATION ENDPOINTS
# ==================================================


@app.post("/dish/recommend")
def recommend(request: RecommendationRequest):
    """
    Generate dish recommendations for a user or cold-start user.
    Returns detailed dish information instead of only dish IDs.
    """
    try:
        # Helper to safely cast numpy/pandas types to Python built-ins
        def safe_cast(value):
            if isinstance(value, (np.generic,)):  # e.g., np.int64, np.float32
                return value.item()
            if isinstance(value, (list, np.ndarray)):
                return [safe_cast(v) for v in value]
            return value

        # Case 1: existing user by ID
        if request.user_id:
            recommendations = evaluator.get_recommendations(request.user_id, top_k=request.top_k)

            detailed_results = []
            for rec in recommendations:
                dish_id = rec[0] if isinstance(rec, (tuple, list)) else rec
                score = rec[1] if isinstance(rec, (tuple, list)) and len(rec) > 1 else None

                dish_info = evaluator.data["dishes"][evaluator.data["dishes"]["id"] == dish_id]
                if not dish_info.empty:
                    row = dish_info.iloc[0]
                    detailed_results.append({
                        "dish_id": safe_cast(row["id"]),
                        "name": safe_cast(row.get("name")),
                        "cuisine": safe_cast(row.get("cuisine")),
                        "taste_profile": safe_cast(row.get("taste_profile")),
                        "price": safe_cast(row.get("price")),
                        "category": safe_cast(row.get("category")),
                        "score": safe_cast(score),
                    })

            resposne =  {
                "user_id": request.user_id,
                "recommendations": detailed_results,
                "count": len(detailed_results)
            }
            
            return to_serializable(resposne)

        # Case 2: cold-start user profile
        elif request.user_profile:
            scenario = {"user_profile": request.user_profile.dict()}
            result = evaluator.evaluate_cold_start_user(scenario)

            # Optional enrichment
            if "recommendations" in result:
                enriched = []
                for rec in result["recommendations"]:
                    # Unpack tuple (dish_id, score)
                    if isinstance(rec, tuple):
                        dish_id, score = rec
                    else:
                        dish_id = rec.get("dish_id")
                        score = rec.get("score")

                    dish_info = evaluator.data["dishes"][evaluator.data["dishes"]["id"] == dish_id]
                    if not dish_info.empty:
                        row = dish_info.iloc[0]
                        enriched.append({
                            "dish_id": safe_cast(row["id"]),
                            "name": safe_cast(row.get("name")),
                            "cuisine": safe_cast(row.get("cuisine")),
                            "price": safe_cast(row.get("price")),
                            "category": safe_cast(row.get("category")),
                            "score": safe_cast(score)
                        })
                result["recommendations"] = enriched
            resposne = {
                "scenario": "cold_start_user",
                "result": result,
            }
            
            return to_serializable(resposne)

        else:
            raise HTTPException(status_code=400, detail="Provide either user_id or user_profile")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")

@app.post("/dish/similar")
def similar_dishes(request: SimilarDishRequest):
    try:
        scenario = {"dish_profile": request.dish_profile.dict()}
        result = evaluator.evaluate_cold_start_dish(scenario)
        response = {"scenario": "cold_start_dish", "result": result}
        return to_serializable(response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Similarity error: {e}")

@app.post("/behavior/test")
def evaluate_behavior(request: BehaviorTestRequest):
    behavior_name = request.behavior_name
    if behavior_name not in test_behaviors:
        raise HTTPException(status_code=404, detail=f"Unknown behavior: {behavior_name}")

    scenario = test_behaviors[behavior_name]
    try:
        if behavior_name == "cold_start_user":
            result = evaluator.evaluate_cold_start_user(scenario)
        elif behavior_name == "cold_start_dish":
            result = evaluator.evaluate_cold_start_dish(scenario)
        elif behavior_name == "budget_conscious":
            result = evaluator.evaluate_budget_scenario(scenario["user_criteria"]["max_price"])
        elif behavior_name == "premium_user":
            result = evaluator.evaluate_budget_scenario(scenario["user_criteria"]["min_price"])
        else:
            user_id = scenario.get("user_id", None)
            if not user_id:
                raise HTTPException(status_code=400, detail="Scenario requires a user_id")
            result = evaluator.evaluate_user_scenario(user_id, behavior_name)

        response = {"behavior": behavior_name, "result": result}
        return to_serializable(response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Behavior test error: {e}")

# ==================================================
# HEALTH CHECK
# ==================================================
@app.get("/")
def root():
    return {"message": "Dish Recognition & Recommendation API is running 🚀"}
