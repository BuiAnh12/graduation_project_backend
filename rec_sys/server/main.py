import os
import sys
import io
import json
import math
import uuid
import torch
import numpy as np
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import asynccontextmanager
from PIL import Image

# --- Third Party Imports ---
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import HTTP_504_GATEWAY_TIMEOUT
import asyncio
from pydantic import BaseModel
from transformers import AutoFeatureExtractor, AutoModelForImageClassification
from dotenv import load_dotenv

# --- Local Imports ---
# Add parent directory to path to ensure imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from server.src.evaluate import ModelEvaluator
from server.src.llm_service import LLMService
from run_pipeline import (
    run_export_task,
    run_train_eval_task
)

# --- Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

MODEL_PATH = './server/model/best_model.pth'
MODEL_INFO_PATH = './server/model/model_info.json'
DATA_DIR = "server/src/data/exported_data/"
TAGS_PATH = "./data/dish_tags.json"
TEST_SCENARIOS_PATH = "./data/test_scenarios.json"

# --- Global State ---
# We initialize these as None and load them in lifespan
evaluator_instance: Optional[ModelEvaluator] = None
llm_service_instance: Optional[LLMService] = None
extractor = None
tag_model = None
dish_tags = {}
test_behaviors = {}

# Job Management
job_statuses: Dict[str, Dict[str, Any]] = {}
is_processing_running = False 

# ==================================================
# HELPER FUNCTIONS
# ==================================================
def to_serializable(obj):
    """Converts NumPy types to Python native types for JSON serialization."""
    if isinstance(obj, np.generic):
        return obj.item()
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_serializable(i) for i in obj]
    return obj

def update_job_status(job_id: str, status: str, message: str = None, result: Any = None, error: str = None):
    """Callback to update background job status."""
    global is_processing_running
    if job_id in job_statuses:
        job_statuses[job_id]['status'] = status
        if message: job_statuses[job_id]['message'] = message
        if result: job_statuses[job_id]['result'] = result
        if error: job_statuses[job_id]['error'] = error
        job_statuses[job_id]['last_updated'] = datetime.now().isoformat()
        
        # Release lock if finished
        if status in ["COMPLETED", "FAILED"]:
            is_processing_running = False
            
        print(f"Job {job_id} updated: {status}")

# ==================================================
# LIFESPAN (Startup Logic)
# ==================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    global evaluator_instance, llm_service_instance, extractor, tag_model, dish_tags, test_behaviors
    
    print("--- Startup: Initializing Services ---")

    # 1. Load Image Recognition Model
    try:
        if os.path.exists(TAGS_PATH):
            with open(TAGS_PATH, "r", encoding="utf-8") as f:
                dish_tags = json.load(f)
        
        extractor = AutoFeatureExtractor.from_pretrained("nateraw/food")
        tag_model = AutoModelForImageClassification.from_pretrained("nateraw/food")
        tag_model.eval()
        print("✅ Image Recognition Model Loaded.")
    except Exception as e:
        print(f"⚠️ Image Model Warning: {e}")

    # 2. Load Recommendation Model (Two-Tower)
    try:
        if os.path.exists(MODEL_PATH) and os.path.exists(MODEL_INFO_PATH):
            evaluator_instance = ModelEvaluator(MODEL_PATH, MODEL_INFO_PATH, DATA_DIR)
            print("✅ Recommendation Model Loaded.")
        else:
            print(f"⚠️ Recommender Warning: Model files missing at {MODEL_PATH}")
    except Exception as e:
        print(f"❌ Recommender Error: {e}")

    # 3. Load LLM Service (Gemini)
    try:
        llm_service_instance = LLMService()
        if llm_service_instance.client:
            print("✅ LLM Service Loaded.")
        else:
            print("⚠️ LLM Warning: Client not initialized (Check API Key).")
    except Exception as e:
        print(f"❌ LLM Error: {e}")

    # 4. Load Test Scenarios
    try:
        if os.path.exists(TEST_SCENARIOS_PATH):
            with open(TEST_SCENARIOS_PATH, "r", encoding="utf-8") as f:
                test_behaviors = json.load(f)
    except Exception:
        print("⚠️ Warning: test_scenarios.json not found.")

    yield
    print("--- Shutdown: Application stopping ---")

# ==================================================
# APP SETUP
# ==================================================


app = FastAPI(title="Dish Recognition & Recommendation API", version="1.0", lifespan=lifespan)

# class DelayMiddleware(BaseHTTPMiddleware):
#     def __init__(self, app, delay: float):
#         super().__init__(app)
#         self.delay = delay

#     async def dispatch(self, request: Request, call_next):
#         # 1. Force the server to sleep BEFORE processing the request
#         print(f"Delaying request by {self.delay} seconds...")
#         await asyncio.sleep(self.delay)
        
#         # 2. Process the request as normal
#         response = await call_next(request)
#         return response
# app.add_middleware(DelayMiddleware, delay=6.0)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================
# PYDANTIC MODELS
# ==================================================
class DishTextRequest(BaseModel):
    name: str
    description: Optional[str] = None

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

class OrderTagRequest(BaseModel):
    dish_ids: List[str]
    top_k: int = 5

class BehaviorTestRequest(BaseModel):
    behavior_name: str

#Response Models
class TaggingResponse(BaseModel):
    taste_tags: List[str]
    method_tags: List[str]
    ingredient_tags: List[str]

class OptimizedDescriptionResponse(BaseModel):
    original_name: str
    original_description: Optional[str]
    new_description: str

class TagRecommendationResponse(BaseModel):
    user_id: str
    recommended_tags: List[Dict[str, Any]]

class UpdateUserRequest(BaseModel):
    user_id: str
    user_data: Dict # Contains age, gender, preferences, etc.

class UpdateDishRequest(BaseModel):
    dish_id: str
    dish_data: Dict # Contains price, category, tags, etc.
    
# ==================================================
# EMBEDING UPDATE
# ==================================================
@app.post("/refresh/user")
def refresh_user_data(request: UpdateUserRequest):
    """
    Call this when a user updates their profile/tags.
    Updates the in-memory data so recommendations change immediately.
    """
    if not evaluator_instance: raise HTTPException(503, "Model not loaded.")
    
    try:
        evaluator_instance.update_live_user_data(request.user_id, request.user_data)
        return {"status": "success", "message": f"User {request.user_id} updated in RAM."}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/refresh/dish")
def refresh_dish_embedding(request: UpdateDishRequest):
    """
    Call this when a restaurant adds/edits a dish.
    Calculates the new vector and puts it in the cache.
    """
    if not evaluator_instance: raise HTTPException(503, "Model not loaded.")
    
    try:
        evaluator_instance.update_dish_embedding(request.dish_id, request.dish_data)
        return {"status": "success", "message": f"Dish {request.dish_id} embedding updated."}
    except Exception as e:
        print(e)
        raise HTTPException(500, str(e))

# ==================================================
# ADMIN & MLOPS ENDPOINTS
# ==================================================

@app.post("/admin/export-data")
async def trigger_export(background_tasks: BackgroundTasks):
    global is_processing_running
    if is_processing_running:
        raise HTTPException(status_code=409, detail="Process already running.")
    
    is_processing_running = True
    job_id = f"export_{uuid.uuid4()}"
    job_statuses[job_id] = {
        "job_id": job_id, "type": "export", "status": "PENDING",
        "start_time": datetime.now().isoformat(), "last_updated": datetime.now().isoformat()
    }
    background_tasks.add_task(run_export_task, job_id, update_job_status)
    return {"message": "Data export started.", "job_id": job_id}

@app.post("/admin/train-model")
async def trigger_training(background_tasks: BackgroundTasks):
    global is_processing_running
    if is_processing_running:
        raise HTTPException(status_code=409, detail="Process already running.")
    
    is_processing_running = True
    job_id = f"train_{uuid.uuid4()}"
    job_statuses[job_id] = {
        "job_id": job_id, "type": "train", "status": "PENDING",
        "start_time": datetime.now().isoformat(), "last_updated": datetime.now().isoformat()
    }
    background_tasks.add_task(run_train_eval_task, job_id, update_job_status)
    return {"message": "Model training started.", "job_id": job_id}

@app.post("/admin/reload-model")
async def reload_active_model():
    global evaluator_instance
    if is_processing_running:
         raise HTTPException(status_code=409, detail="Cannot reload while training.")
    
    try:
        evaluator_instance = ModelEvaluator(MODEL_PATH, MODEL_INFO_PATH, DATA_DIR)
        return {"message": "Model reloaded successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reload failed: {e}")

@app.get("/admin/job-status/{job_id}")
async def get_job_status(job_id: str):
    status = job_statuses.get(job_id)
    if not status: raise HTTPException(404, "Job ID not found.")
    return status

# ==================================================
# FEATURE 1: IMAGE RECOGNITION
# ==================================================
@app.post("/tag/predict")
async def predict_dish(image: UploadFile = File(...)):
    if not tag_model or not extractor:
        raise HTTPException(503, "Image model not initialized.")
    if not image.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image.")

    try:
        image_bytes = await image.read()
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        inputs = extractor(images=img, return_tensors="pt")

        with torch.no_grad():
            outputs = tag_model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            pred_idx = probs.argmax(-1).item()

        pred_label = tag_model.config.id2label[pred_idx]
        confidence = float(probs[0][pred_idx].item())
        tags = dish_tags.get(pred_label, [])

        return to_serializable({
            "success": True, "predicted_label": pred_label,
            "confidence": round(confidence, 4), "tags": tags
        })
    except Exception as e:
        raise HTTPException(500, f"Prediction error: {e}")

# ==================================================
# FEATURE 2: LLM SERVICES (TEXT)
# ==================================================
@app.post("/text/extract-tags", response_model=TaggingResponse)
async def extract_tags_from_text(request: DishTextRequest):
    if not llm_service_instance or not llm_service_instance.client:
        raise HTTPException(503, "LLM Service unavailable.")
    return await llm_service_instance.extract_tags(request.name, request.description)

@app.post("/text/optimize-description", response_model=OptimizedDescriptionResponse)
async def optimize_dish_description(request: DishTextRequest):
    if not llm_service_instance or not llm_service_instance.client:
        raise HTTPException(503, "LLM Service unavailable.")
    desc = request.description if request.description else request.name
    return await llm_service_instance.optimize_description(request.name, desc)

# ==================================================
# FEATURE 3: RECOMMENDATIONS
# ==================================================

@app.post("/tags/recommend", response_model=TagRecommendationResponse)
def recommend_tags(request: RecommendationRequest):
    if not evaluator_instance: raise HTTPException(503, "Model not loaded.")
    
    try:
        if request.user_id:
            raw_results = evaluator_instance.recommend_tags_for_user(request.user_id, top_k=request.top_k)
            formatted_results = [{"tag": t, "score": round(s, 4)} for t, s in raw_results]
            return {"user_id": request.user_id, "recommended_tags": formatted_results}
        else:
            raise HTTPException(501, "Cold start tag recommendation not implemented")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/tags/recommend-for-order")
def recommend_tags_for_order(request: OrderTagRequest):
    if not evaluator_instance: raise HTTPException(503, "Model not loaded.")
    
    try:
        raw_results = evaluator_instance.get_tags_for_order(request.dish_ids, top_k=request.top_k)
        formatted_results = [{"tag": t, "score": round(s, 4)} for t, s in raw_results]
        return {"input_dishes": request.dish_ids, "recommended_tags": formatted_results}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/dish/recommend")
def recommend(request: RecommendationRequest):
    if not evaluator_instance: raise HTTPException(503, "Model not loaded.")

    try:
        # Helper for safe casting (prevents JSON errors)
        def safe_cast(val):
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)): return None
            if isinstance(val, np.generic): return val.item()
            return val

        def enrich_results(recs):
            results = []
            for rec in recs:
                dish_id = rec[0] if isinstance(rec, tuple) else rec.get('dish_id')
                score = rec[1] if isinstance(rec, tuple) else rec.get('score')
                
                dish_info = evaluator_instance.data["dishes"][evaluator_instance.data["dishes"]["id"] == dish_id]
                if dish_info.empty: continue
                
                row = dish_info.iloc[0]
                results.append({
                    "dish_id": safe_cast(row["id"]),
                    "name": safe_cast(row.get("name")),
                    "cuisine": safe_cast(row.get("cuisine")),
                    "price": safe_cast(row.get("price")),
                    "category": safe_cast(row.get("category")),
                    "score": safe_cast(score)
                })
            return results

        if request.user_id:
            recs = evaluator_instance.get_recommendations(request.user_id, top_k=request.top_k)
            enriched = enrich_results(recs)
            return to_serializable({"user_id": request.user_id, "recommendations": enriched, "count": len(enriched)})
            
        elif request.user_profile:
            result = evaluator_instance.evaluate_cold_start_user({"user_profile": request.user_profile.dict()})
            enriched = enrich_results(result.get("recommendations", []))
            result["recommendations"] = enriched
            return to_serializable(result)
        
        else:
            raise HTTPException(400, "Provide user_id or user_profile")

    except Exception as e:
        raise HTTPException(500, f"Recommendation error: {e}")

@app.post("/dish/similar")
def get_similar_dishes(request: SimilarDishRequest):
    if not evaluator_instance: raise HTTPException(503, "Model not loaded.")

    # Reuse safe_cast logic...
    def safe_cast(val):
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)): return None
        if isinstance(val, np.generic): return val.item()
        return val

    try:
        raw_recs = []
        response_meta = {}
        
        # Debug print
        print(f"Incoming Request: {request}")

        if request.dish_id:
            # CHECK IF ID EXISTS FIRST
            if request.dish_id not in evaluator_instance.dish_embeddings_cache:
                # Return 404 so Node knows it's a specific "Not Found" error, not a server crash
                raise HTTPException(status_code=404, detail=f"Dish ID {request.dish_id} not found in model cache (Try retraining).")
                
            raw_recs = evaluator_instance.get_similar_dishes(
                request.dish_id, top_k=request.top_k, store_id_filter=request.store_id_filter
            )
            response_meta = {"scenario": "existing_dish", "source_dish_id": request.dish_id}
            
        elif request.dish_profile:
            print("Running Cold Start Logic...")
            result = evaluator_instance.evaluate_cold_start_dish(
                {"dish_profile": request.dish_profile.dict()}, 
                top_k=request.top_k, store_id_filter=request.store_id_filter
            )
            raw_recs = result.get("similar_dishes_raw", [])
            response_meta = {"scenario": "cold_start", "source": request.dish_profile.dict()}
        else:
            raise HTTPException(400, "Provide dish_id or dish_profile")

        # Enrich
        detailed = []
        for rec in raw_recs:
            dish_id, score = rec[0], rec[1]
            # Check if dish exists in dataframe before accessing
            if dish_id not in evaluator_instance.data["dishes"]["id"].values:
                continue
                
            dish_info = evaluator_instance.data["dishes"][evaluator_instance.data["dishes"]["id"] == dish_id]
            row = dish_info.iloc[0]
            detailed.append({
                "dish_id": safe_cast(row["id"]),
                "name": safe_cast(row.get("name")),
                "price": safe_cast(row.get("price")),
                "category": safe_cast(row.get("category")),
                "score": safe_cast(score)
            })
            
        response_meta["similar_dishes"] = detailed
        return to_serializable(response_meta)

    except HTTPException as he:
        raise he # Re-raise HTTP exceptions (like 404)
    except Exception as e:
        # PRINT THE FULL ERROR TRACEBACK
        traceback.print_exc()
        raise HTTPException(500, f"Similarity error: {str(e)}")
@app.post("/behavior/test")
def evaluate_behavior(request: BehaviorTestRequest):
    if not evaluator_instance: raise HTTPException(503, "Model not loaded.")
    behavior = request.behavior_name
    if behavior not in test_behaviors: raise HTTPException(404, f"Unknown behavior: {behavior}")

    try:
        scenario = test_behaviors[behavior]
        if behavior == "cold_start_user":
            result = evaluator_instance.evaluate_cold_start_user(scenario)
        elif behavior == "cold_start_dish":
            result = evaluator_instance.evaluate_cold_start_dish(scenario)
        elif behavior == "budget_conscious":
            result = evaluator_instance.evaluate_budget_scenario(scenario["user_criteria"]["max_price"])
        elif behavior == "premium_user":
            result = evaluator_instance.evaluate_budget_scenario(scenario["user_criteria"]["min_price"])
        else:
            user_id = scenario.get("user_id")
            if not user_id: raise HTTPException(400, "Scenario needs user_id")
            result = evaluator_instance.evaluate_user_scenario(user_id, behavior)
            
        return to_serializable({"behavior": behavior, "result": result})
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/")
def root():
    return {"message": "Dish Recognition & Recommendation API is running 🚀"}