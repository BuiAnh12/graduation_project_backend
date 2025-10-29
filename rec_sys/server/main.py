from datetime import datetime
import os
import io
import json
import torch
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoFeatureExtractor, AutoModelForImageClassification
from contextlib import asynccontextmanager
import uuid
from PIL import Image
from typing import Optional, List, Dict, Any
import numpy as np
import math
from server.src.evaluate import ModelEvaluator
from server.src.data_preprocessor import DataPreprocessor
from server.src.dataset import Dataset
from server.src.simple_two_tower_model import SimpleTwoTowerModel
from server.src.trainner import Trainer

from run_pipeline import (
    run_export_task,
    run_train_eval_task,
    MODEL_SAVE_DIR, # Keep path
    EVALUATION_OUTPUT_PATH # Keep path
)


job_statuses: Dict[str, Dict[str, Any]] = {}
is_processing_running = False # Single lock for *any* background task (export/train)
evaluator_instance: ModelEvaluator = None

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
    TAGS_PATH = "./data/dish_tags.json"
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
# MODEL_PATH = '../ai_model/v1/best_model.pth'
# MODEL_INFO_PATH = '../ai_model/v1/model_info.json'
MODEL_PATH = './server/model/best_model.pth'
MODEL_INFO_PATH = './server/model/model_info.json'


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
    data_dir="server/src/data/exported_data/"
)

with open("./data/test_scenarios.json", "r", encoding="utf-8") as f:
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

# --- Lifespan for loading model ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global evaluator_instance
    print("Application startup: Loading initial model...")
    # Load model initially - handle potential errors gracefully
    try:
        if os.path.exists(MODEL_PATH) and os.path.exists(MODEL_INFO_PATH):
             evaluator_instance = ModelEvaluator(MODEL_PATH, MODEL_INFO_PATH, DATA_DIR)
             print("Initial model loaded.")
        else:
             print("Warning: Model files not found on startup. Evaluator not initialized.")
             evaluator_instance = None # Ensure it's None if loading fails
    except Exception as e:
        print(f"FATAL: Failed to load initial model on startup: {e}")
        evaluator_instance = None
    yield
    print("Application shutdown.")

def update_job_status(job_id: str, status: str, message: str = None, result: Any = None, error: str = None):
    """Callback function for the pipeline to update job status."""
    if job_id in job_statuses:
        job_statuses[job_id]['status'] = status
        # Only update fields if they are provided
        if message is not None: job_statuses[job_id]['message'] = message
        if result is not None: job_statuses[job_id]['result'] = result
        if error is not None: job_statuses[job_id]['error'] = error
        job_statuses[job_id]['last_updated'] = datetime.now().isoformat() # Use ISO format string
        print(f"Job {job_id} status updated: {status}")
    else:
        print(f"Warning: Attempted to update status for unknown job_id: {job_id}")
@app.post("/admin/export-data")
async def trigger_export(background_tasks: BackgroundTasks):
    """Triggers the data export process."""
    global is_processing_running, job_statuses

    if is_processing_running:
        raise HTTPException(status_code=409, detail="Another process (export/train) is already running.")

    is_processing_running = True # Acquire lock
    job_id = f"export_{uuid.uuid4()}" # Add prefix for clarity
    job_statuses[job_id] = {
        "job_id": job_id,
        "type": "export",
        "status": "PENDING",
        "message": "Export job received.",
        "start_time": datetime.now().isoformat(),
        "last_updated": datetime.now().isoformat(),
        "result": None, "error": None,
    }
    print(f"Starting data export job: {job_id}")
    background_tasks.add_task(run_export_task, job_id, update_job_status)
    return {"message": "Data export process started.", "job_id": job_id}

@app.post("/admin/train-model")
async def trigger_training(background_tasks: BackgroundTasks):
    """Triggers the model training and evaluation process."""
    global is_processing_running, job_statuses

    if is_processing_running:
        raise HTTPException(status_code=409, detail="Another process (export/train) is already running.")

    is_processing_running = True # Acquire lock
    job_id = f"train_{uuid.uuid4()}" # Add prefix
    job_statuses[job_id] = {
        "job_id": job_id,
        "type": "train",
        "status": "PENDING",
        "message": "Training job received.",
        "start_time": datetime.now().isoformat(),
        "last_updated": datetime.now().isoformat(),
        "result": None, "error": None,
    }
    print(f"Starting model training job: {job_id}")
    background_tasks.add_task(run_train_eval_task, job_id, update_job_status)
    return {"message": "Model training process started.", "job_id": job_id}

@app.post("/admin/reload-model")
async def reload_active_model():
    """Attempts to reload the latest trained model into the running service."""
    global evaluator_instance

    if is_processing_running:
         raise HTTPException(status_code=409, detail="Cannot reload while export/train is running.")

    print("Attempting to reload model...")
    if evaluator_instance is None:
        # Try to initialize if it wasn't loaded at startup
         print("Evaluator not initialized, attempting first load...")
         try:
            evaluator_instance = ModelEvaluator(MODEL_PATH, MODEL_INFO_PATH, DATA_DIR)
            return {"message": "Model loaded successfully for the first time."}
         except Exception as e:
             print(f"Failed to load model: {e}")
             raise HTTPException(status_code=500, detail=f"Failed to load model: {e}")
    else:
        # Reload existing instance
        success = evaluator_instance.reload_model_and_cache()
        if success:
            return {"message": "Model reloaded successfully."}
        else:
            # Keep serving with the old model if reload fails
            raise HTTPException(status_code=500, detail="Failed to reload model. Service continues with the previous model.")

@app.get("/admin/job-status/{job_id}")
async def get_job_status(job_id: str):
    """Polls the status of an export or training job."""
    global job_statuses
    status = job_statuses.get(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job ID not found.")
    # Maybe add logic to clear old jobs after some time?
    return status


# ==================================================
# REQUEST SCHEMAS
# ==================================================

class UserProfile(BaseModel):
    age: int | None = None
    gender: str | None = None
    location: str | None = None
    preferences: dict | None = None

class DishProfile(BaseModel):
    cuisine: Optional[List[str]] = []
    taste: Optional[List[str]] = []
    price_range: Optional[str] = 'any'

class RecommendationRequest(BaseModel):
    user_id: str | None = None
    user_profile: UserProfile | None = None
    top_k: int = 10

class SimilarDishRequest(BaseModel):
    dish_id: Optional[str] = None
    dish_profile: Optional[DishProfile] = None
    top_k: int = 10
    store_id_filter: Optional[str] = None
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
            # First, handle special float values (NaN, Infinity)
            if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                return None  # Convert NaN/Infinity to null in JSON

            # Handle NumPy-specific types
            if isinstance(value, np.generic):
                # np.generic is the base for all numpy types (int64, float32, etc.)
                return value.item()

            # Recursively handle lists/arrays
            if isinstance(value, (list, np.ndarray)):
                return [safe_cast(v) for v in value]

            # Return the value if it's already a standard Python type
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

            response =  {
                "user_id": request.user_id,
                "recommendations": detailed_results,
                "count": len(detailed_results)
            }
            
            return to_serializable(response)

        # Case 2: cold-start user profile
        elif request.user_profile:
            scenario = {"user_profile": request.user_profile.dict()}
            print(scenario)
            result = evaluator.evaluate_cold_start_user(scenario)
            print("Cold start result:", result)

            # Optional enrichment
            enriched = []
            recommendations = result.get("recommendations", [])
            
            for rec in recommendations:
                # Normalize tuple or dict structure
                if isinstance(rec, tuple):
                    dish_id, score = rec
                else:
                    dish_id = rec.get("dish_id")
                    score = rec.get("score")

                # Find dish by ID
                dish_info = evaluator.data["dishes"][evaluator.data["dishes"]["id"] == dish_id]

                # ✅ Skip if not found
                if dish_info.empty:
                    print(f"⚠️ Dish ID {dish_id} not found in dataset — skipping.")
                    continue

                # Safe extract
                row = dish_info.iloc[0]
                enriched.append({
                    "dish_id": safe_cast(row["id"]),
                    "name": safe_cast(row.get("name")),
                    "cuisine": safe_cast(row.get("cuisine")),
                    "taste_profile": safe_cast(row.get("taste_profile")),
                    "price": safe_cast(row.get("price")),
                    "category": safe_cast(row.get("category")),
                    "score": safe_cast(score)
                })

            result["recommendations"] = enriched


            return to_serializable(result)

        else:
            raise HTTPException(status_code=400, detail="Provide either user_id or user_profile")

    except Exception as e:
        print(str(e))
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")

@app.post("/dish/similar")
def get_similar_dishes(request: SimilarDishRequest):
    """
    Get similar dishes for an existing dish_id or a new dish_profile.
    Returns detailed dish information.
    """
    
    # Helper from your /recommend endpoint
    def safe_cast(value):
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return None
        if isinstance(value, np.generic):
            return value.item()
        if isinstance(value, (list, np.ndarray)):
            return [safe_cast(v) for v in value]
        return value

    try:
        similar_dishes_raw = []
        response_data = {}
        
        store_filter = request.store_id_filter

        # Case 1: Existing Dish (by ID)
        if request.dish_id:
            print(f"Finding similar dishes for existing ID: {request.dish_id}")
            similar_dishes_raw = evaluator.get_similar_dishes(
                request.dish_id, 
                top_k=request.top_k,
                store_id_filter=store_filter 
            )
            response_data = {
                "scenario": "existing_dish",
                "source_dish_id": request.dish_id,
            }

        # Case 2: Cold-Start Dish (by Profile)
        elif request.dish_profile:
            print(f"Finding similar dishes for new profile: {request.dish_profile.dict()}")
            scenario = {"dish_profile": request.dish_profile.dict()}
            # We will update this function in ModelEvaluator
            result = evaluator.evaluate_cold_start_dish(
                scenario, 
                top_k=request.top_k,
                store_id_filter=store_filter 
            )
            similar_dishes_raw = result.get("similar_dishes_raw", [])
            response_data = {
                "scenario": "cold_start_dish",
                "source_profile": request.dish_profile.dict(),
                "analysis": result.get("analysis", {})
            }

        # Case 3: Error
        else:
            raise HTTPException(status_code=400, detail="Provide either dish_id or dish_profile")

        # --- Enrichment Step (common to both cases) ---
        detailed_results = []
        for rec in similar_dishes_raw:
            dish_id = rec[0] if isinstance(rec, (tuple, list)) else rec
            score = rec[1] if isinstance(rec, (tuple, list)) and len(rec) > 1 else None

            dish_info = evaluator.data["dishes"][evaluator.data["dishes"]["id"] == dish_id]
            if dish_info.empty:
                print(f"⚠️ Dish ID {dish_id} not found in dataset — skipping.")
                continue

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

        response_data["similar_dishes"] = detailed_results
        response_data["count"] = len(detailed_results)
        
        return to_serializable(response_data)

    except Exception as e:
        print(f"Similarity error: {e}")
        raise HTTPException(status_code=500, detail=f"Similarity error: {str(e)}")

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
