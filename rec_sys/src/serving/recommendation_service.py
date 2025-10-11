"""
FastAPI service for food recommendation system.

This module provides REST API endpoints for the three main recommendation use cases:
1. Global personalized recommendations (home page slider)
2. Next dish prediction (after adding to cart)
3. Cart suggestions (while reviewing cart)
"""

import os
import sys
import json
import pickle
import numpy as np
import torch
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from fastapi import FastAPI, HTTPException, Query
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    import uvicorn
except ImportError:
    print("Please install fastapi and uvicorn: pip install fastapi uvicorn")
    sys.exit(1)

try:
    import redis
    import faiss
except ImportError:
    print("Please install redis and faiss: pip install redis faiss-cpu")
    sys.exit(1)

from models.two_tower import TwoTowerModel
from preprocessing.encoders import FeatureEncoder


# Pydantic models for API
class RecommendationRequest(BaseModel):
    user_id: str
    k: int = 10


class NextDishRequest(BaseModel):
    user_id: str
    cart_item_id: str
    store_id: str
    k: int = 1


class CartSuggestionsRequest(BaseModel):
    user_id: str
    cart_items: List[str]
    store_id: str
    k: int = 5


class RecommendationResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    user_id: str
    timestamp: str


class RecommendationService:
    """Main recommendation service class."""
    
    def __init__(
        self,
        model_path: str,
        encoder_path: str,
        item_embeddings_path: str,
        item_metadata_path: str,
        redis_url: str = "redis://localhost:6379"
    ):
        """
        Initialize recommendation service.
        
        Args:
            model_path: Path to trained model checkpoint
            encoder_path: Path to fitted encoder
            item_embeddings_path: Path to precomputed item embeddings
            item_metadata_path: Path to item metadata
            redis_url: Redis connection URL
        """
        self.model_path = model_path
        self.encoder_path = encoder_path
        self.item_embeddings_path = item_embeddings_path
        self.item_metadata_path = item_metadata_path
        self.redis_url = redis_url
        
        # Initialize components
        self.model = None
        self.encoder = None
        self.item_embeddings = None
        self.item_metadata = None
        self.redis_client = None
        self.faiss_index = None
        
        # Load all components
        self._load_components()
    
    def _load_components(self) -> None:
        """Load all required components."""
        print("Loading recommendation service components...")
        
        # Load encoder
        self.encoder = FeatureEncoder.load(self.encoder_path)
        print("✓ Encoder loaded")
        
        # Load model
        checkpoint = torch.load(self.model_path, map_location='cpu')
        vocab_sizes = self.encoder.get_vocab_sizes()
        
        self.model = TwoTowerModel(
            user_vocab_size=vocab_sizes['user'],
            dish_vocab_size=vocab_sizes['dish'],
            store_vocab_size=vocab_sizes['store'],
            tag_vocab_size=vocab_sizes['tag'],
            taste_vocab_size=vocab_sizes['taste'],
            category_vocab_size=vocab_sizes['category']
        )
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model.eval()
        print("✓ Model loaded")
        
        # Load item embeddings and metadata
        self.item_embeddings = np.load(self.item_embeddings_path)
        with open(self.item_metadata_path, 'rb') as f:
            self.item_metadata = pickle.load(f)
        print("✓ Item embeddings and metadata loaded")
        
        # Initialize Redis client
        try:
            self.redis_client = redis.from_url(self.redis_url)
            self.redis_client.ping()  # Test connection
            print("✓ Redis connection established")
        except Exception as e:
            print(f"⚠️  Redis connection failed: {e}")
            print("Using in-memory storage instead")
            self.redis_client = None
        
        # Build FAISS index for fast similarity search
        self._build_faiss_index()
        print("✓ FAISS index built")
        
        print("Recommendation service ready!")
    
    def _build_faiss_index(self) -> None:
        """Build FAISS index for fast similarity search."""
        dimension = self.item_embeddings.shape[1]
        self.faiss_index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        
        # Normalize embeddings for cosine similarity
        normalized_embeddings = self.item_embeddings / np.linalg.norm(self.item_embeddings, axis=1, keepdims=True)
        self.faiss_index.add(normalized_embeddings.astype('float32'))
    
    def _get_user_features(self, user_id: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Get user features for encoding.
        
        Args:
            user_id: User ID
            context: Optional context information
            
        Returns:
            User feature dictionary
        """
        # This would typically query the database for user information
        # For now, return default values
        if context is None:
            now = datetime.now()
            context = {
                'time_of_day': now.hour / 24.0,
                'day_of_week': now.weekday()
            }
        
        # Default user features (would be fetched from database)
        user_data = {
            'user_id': user_id,
            'age': 30,  # Default age
            'gender': 'unknown',
            'location_lat': 10.8231,  # Ho Chi Minh City
            'location_lon': 106.6297,
            'dislike_taste': '[]',
            'allergy': '[]'
        }
        
        return user_data, context
    
    def _get_item_features(self, dish_id: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Get item features for encoding.
        
        Args:
            dish_id: Dish ID
            context: Optional context information
            
        Returns:
            Item feature dictionary
        """
        if context is None:
            now = datetime.now()
            context = {
                'time_of_day': now.hour / 24.0,
                'day_of_week': now.weekday()
            }
        
        # Get item metadata
        if dish_id in self.item_metadata:
            item_data = self.item_metadata[dish_id]
        else:
            # Default item features
            item_data = {
                'dish_id': dish_id,
                'store_id': 'unknown',
                'dish_tags': '[]',
                'dish_taste': '[]',
                'order_times': 0,
                'price': 0.0,
                'system_category': 'unknown',
                'location_lat': 10.8231,
                'location_lon': 106.6297,
                'average_rating': 3.0
            }
        
        return item_data, context
    
    def _apply_post_filters(
        self, 
        recommendations: List[Dict], 
        user_id: str,
        store_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Apply post-filters to recommendations.
        
        Args:
            recommendations: List of recommendations
            user_id: User ID
            store_id: Optional store ID for filtering
            
        Returns:
            Filtered recommendations
        """
        # Get user preferences (would be fetched from database)
        user_allergies = []  # Would be fetched from user profile
        user_dislikes = []   # Would be fetched from user profile
        
        filtered = []
        for rec in recommendations:
            dish_id = rec['dish_id']
            
            # Store filter
            if store_id and rec.get('store_id') != store_id:
                continue
            
            # Allergy filter
            if dish_id in self.item_metadata:
                item_tags = self.item_metadata[dish_id].get('tags', [])
                if any(allergy in item_tags for allergy in user_allergies):
                    continue
            
            # Dislike filter
            if dish_id in self.item_metadata:
                item_tastes = self.item_metadata[dish_id].get('tastes', [])
                if any(dislike in item_tastes for dislike in user_dislikes):
                    continue
            
            filtered.append(rec)
        
        return filtered
    
    def get_global_recommendations(self, user_id: str, k: int = 10) -> List[Dict[str, Any]]:
        """
        Get global personalized recommendations.
        
        Args:
            user_id: User ID
            k: Number of recommendations
            
        Returns:
            List of recommendations
        """
        # Get user features and encode
        user_data, context = self._get_user_features(user_id)
        user_features = self.encoder.encode_user_features(user_data, context)
        
        # Convert to tensors
        user_tensors = {k: torch.tensor(v, dtype=torch.long if k in ['user_id', 'gender', 'day_of_week'] else torch.float) 
                       for k, v in user_features.items()}
        
        # Get user embedding
        with torch.no_grad():
            user_embedding = self.model.embed_user(user_tensors)
            user_embedding = user_embedding.numpy()
        
        # Search for similar items using FAISS
        user_embedding = user_embedding / np.linalg.norm(user_embedding)
        scores, indices = self.faiss_index.search(user_embedding.reshape(1, -1), k * 2)  # Get more for filtering
        
        # Create recommendations
        recommendations = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(self.item_metadata):
                dish_id = list(self.item_metadata.keys())[idx]
                recommendations.append({
                    'dish_id': dish_id,
                    'score': float(score),
                    'store_id': self.item_metadata[dish_id].get('store_id', 'unknown'),
                    'name': self.item_metadata[dish_id].get('name', ''),
                    'price': self.item_metadata[dish_id].get('price', 0.0)
                })
        
        # Apply post-filters
        recommendations = self._apply_post_filters(recommendations, user_id)
        
        return recommendations[:k]
    
    def get_next_dish_recommendation(self, user_id: str, cart_item_id: str, store_id: str) -> List[Dict[str, Any]]:
        """
        Get next dish recommendation after adding to cart.
        
        Args:
            user_id: User ID
            cart_item_id: Dish ID that was added to cart
            store_id: Store ID
            
        Returns:
            List of recommendations (typically 1 item)
        """
        # Get user features
        user_data, context = self._get_user_features(user_id)
        user_features = self.encoder.encode_user_features(user_data, context)
        user_tensors = {k: torch.tensor(v, dtype=torch.long if k in ['user_id', 'gender', 'day_of_week'] else torch.float) 
                       for k, v in user_features.items()}
        
        # Get user embedding
        with torch.no_grad():
            user_embedding = self.model.embed_user(user_tensors)
            user_embedding = user_embedding.numpy()
        
        # Filter items by store
        store_items = []
        for dish_id, metadata in self.item_metadata.items():
            if metadata.get('store_id') == store_id and dish_id != cart_item_id:
                store_items.append((dish_id, metadata))
        
        if not store_items:
            return []
        
        # Get embeddings for store items
        store_embeddings = []
        store_dish_ids = []
        for dish_id, metadata in store_items:
            item_data, _ = self._get_item_features(dish_id, context)
            item_features = self.encoder.encode_item_features(item_data, context)
            item_tensors = {k: torch.tensor(v, dtype=torch.long if k in ['dish_id', 'store_id', 'category', 'tags', 'tastes', 'day_of_week'] else torch.float) 
                           for k, v in item_features.items()}
            
            with torch.no_grad():
                item_embedding = self.model.embed_item(item_tensors)
                store_embeddings.append(item_embedding.numpy())
                store_dish_ids.append(dish_id)
        
        store_embeddings = np.vstack(store_embeddings)
        
        # Calculate similarities
        similarities = np.dot(user_embedding, store_embeddings.T)
        
        # Get top recommendation
        top_idx = np.argmax(similarities)
        dish_id = store_dish_ids[top_idx]
        
        recommendation = {
            'dish_id': dish_id,
            'score': float(similarities[top_idx]),
            'store_id': store_id,
            'name': self.item_metadata[dish_id].get('name', ''),
            'price': self.item_metadata[dish_id].get('price', 0.0)
        }
        
        return [recommendation]
    
    def get_cart_suggestions(self, user_id: str, cart_items: List[str], store_id: str, k: int = 5) -> List[Dict[str, Any]]:
        """
        Get cart suggestions while reviewing cart.
        
        Args:
            user_id: User ID
            cart_items: List of dish IDs in cart
            store_id: Store ID
            k: Number of suggestions
            
        Returns:
            List of recommendations
        """
        # Similar to next dish but for multiple items
        user_data, context = self._get_user_features(user_id)
        user_features = self.encoder.encode_user_features(user_data, context)
        user_tensors = {k: torch.tensor(v, dtype=torch.long if k in ['user_id', 'gender', 'day_of_week'] else torch.float) 
                       for k, v in user_features.items()}
        
        with torch.no_grad():
            user_embedding = self.model.embed_user(user_tensors)
            user_embedding = user_embedding.numpy()
        
        # Filter items by store, excluding cart items
        store_items = []
        for dish_id, metadata in self.item_metadata.items():
            if metadata.get('store_id') == store_id and dish_id not in cart_items:
                store_items.append((dish_id, metadata))
        
        if not store_items:
            return []
        
        # Get embeddings and calculate similarities
        recommendations = []
        for dish_id, metadata in store_items:
            item_data, _ = self._get_item_features(dish_id, context)
            item_features = self.encoder.encode_item_features(item_data, context)
            item_tensors = {k: torch.tensor(v, dtype=torch.long if k in ['dish_id', 'store_id', 'category', 'tags', 'tastes', 'day_of_week'] else torch.float) 
                           for k, v in item_features.items()}
            
            with torch.no_grad():
                item_embedding = self.model.embed_item(item_tensors)
                similarity = np.dot(user_embedding, item_embedding.numpy())
                
                recommendations.append({
                    'dish_id': dish_id,
                    'score': float(similarity),
                    'store_id': store_id,
                    'name': metadata.get('name', ''),
                    'price': metadata.get('price', 0.0)
                })
        
        # Sort by score and apply filters
        recommendations.sort(key=lambda x: x['score'], reverse=True)
        recommendations = self._apply_post_filters(recommendations, user_id, store_id)
        
        return recommendations[:k]


# Initialize FastAPI app
app = FastAPI(title="Food Recommendation API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global recommendation service instance
recommendation_service = None


@app.on_event("startup")
async def startup_event():
    """Initialize the recommendation service on startup."""
    global recommendation_service
    
    # Initialize service with default paths
    recommendation_service = RecommendationService(
        model_path="runs/best_model.pth",
        encoder_path="encoders.pkl",
        item_embeddings_path="data/embeddings/items.npy",
        item_metadata_path="data/embeddings/item_metadata.pkl"
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "food-recommendation"}


@app.post("/recommend/home-slider", response_model=RecommendationResponse)
async def get_home_slider_recommendations(request: RecommendationRequest):
    """
    Get global personalized recommendations for home page slider.
    """
    if recommendation_service is None:
        raise HTTPException(status_code=500, detail="Recommendation service not initialized")
    
    try:
        recommendations = recommendation_service.get_global_recommendations(
            user_id=request.user_id,
            k=request.k
        )
        
        return RecommendationResponse(
            recommendations=recommendations,
            user_id=request.user_id,
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/recommend/next-dish", response_model=RecommendationResponse)
async def get_next_dish_recommendation(request: NextDishRequest):
    """
    Get next dish recommendation after adding to cart.
    """
    if recommendation_service is None:
        raise HTTPException(status_code=500, detail="Recommendation service not initialized")
    
    try:
        recommendations = recommendation_service.get_next_dish_recommendation(
            user_id=request.user_id,
            cart_item_id=request.cart_item_id,
            store_id=request.store_id
        )
        
        return RecommendationResponse(
            recommendations=recommendations,
            user_id=request.user_id,
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/recommend/cart-suggestions", response_model=RecommendationResponse)
async def get_cart_suggestions(request: CartSuggestionsRequest):
    """
    Get cart suggestions while reviewing cart.
    """
    if recommendation_service is None:
        raise HTTPException(status_code=500, detail="Recommendation service not initialized")
    
    try:
        recommendations = recommendation_service.get_cart_suggestions(
            user_id=request.user_id,
            cart_items=request.cart_items,
            store_id=request.store_id,
            k=request.k
        )
        
        return RecommendationResponse(
            recommendations=recommendations,
            user_id=request.user_id,
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def main():
    """Main function to run the API server."""
    uvicorn.run(
        "recommendation_service:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )


if __name__ == "__main__":
    main()
