import os
import sys
import json
import ast
import torch
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional
from collections import defaultdict

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.data_preprocessor import DataPreprocessor
from src.dataset import FoodRecommendationDataset  # Assuming your file is named dataset.py
from src.simple_two_tower_model import SimpleTwoTowerModel

class ModelEvaluator:
    """
    Evaluates the trained Two-Tower recommendation model using various 
    scenarios (Cold Start, specific user behavior, budget constraints).
    Includes features for Similarity Search and Tag Recommendation.
    """

    def __init__(self, model_path: str, model_info_path: str, data_dir: str):
        # 1. Setup Device
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"ModelEvaluator initialized on: {self.device}")

        self.data_dir = data_dir
        
        # 2. Load Configuration & Data
        with open(model_info_path, 'r', encoding='utf-8') as f:
            self.model_info = json.load(f)

        self.preprocessor = DataPreprocessor(data_dir)
        self.data = self.preprocessor.load_data()
        self.data = self.preprocessor.preprocess_data(self.data)
        
        # 3. Initialize Persistent Dataset (for vocabularies and encoding helpers)
        empty_interactions = pd.DataFrame(columns=['user_id', 'dish_id', 'timestamp', 'interaction_type', 'context'])
        self.dataset = FoodRecommendationDataset(empty_interactions, self.data['users'], self.data['dishes'])

        # 4. Load Model
        self.model = self._load_model(model_path)
        self.model.to(self.device)

        # 5. Precompute Embeddings (The "Index")
        # We cache all dish vectors immediately so retrieval is fast
        self.dish_embeddings_cache = self._precompute_all_dish_embeddings()
        
        # 6. Compute Tag Centroids (For Tag Recommendation Popup)
        self.tag_embeddings_map = self._compute_tag_centroids()

        # 7. Load Test Scenarios
        try:
            with open(os.path.join(data_dir, 'test_scenarios.json'), 'r', encoding='utf-8') as f:
                self.test_scenarios = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            print("Warning: 'test_scenarios.json' not found or invalid.")
            self.test_scenarios = {}

    def _load_model(self, model_path: str) -> SimpleTwoTowerModel:
        """Reconstructs the model architecture and loads weights."""
        sizes = self.model_info['vocab_sizes']
        model = SimpleTwoTowerModel(
            user_vocab_size=sizes['user'],
            dish_vocab_size=sizes['dish'],
            store_vocab_size=sizes['store'],
            tag_vocab_size=sizes['tag'],
            category_vocab_size=sizes['category'],
            embedding_dim=self.model_info['embedding_dim']
        )
        
        checkpoint = torch.load(model_path, map_location=self.device)
        model.load_state_dict(checkpoint['model_state_dict'])
        model.eval()
        return model

    # =========================================================================
    # PRE-COMPUTATION METHODS
    # =========================================================================

    def _precompute_all_dish_embeddings(self) -> Dict[str, torch.Tensor]:
        """Efficiently processes all dishes to create vector representations."""
        print("Caching dish embeddings...")
        dish_vectors = {}
        dummy_time = pd.to_datetime('2024-01-01 12:00:00') # Static time for catalog
        
        self.model.eval()
        with torch.no_grad():
            for _, row in self.data['dishes'].iterrows():
                dish_id = row['id']
                # Encode features using Dataset helper
                features = self.dataset._encode_dish_features(row.to_dict(), dish_id, dummy_time)
                
                # Add batch dimension and move to device
                features_batch = {k: v.unsqueeze(0).to(self.device) for k, v in features.items()}
                
                # Forward pass through Item Tower
                vector = self.model.forward_item(features_batch)
                dish_vectors[dish_id] = vector.squeeze(0) # Store 1D vector

        print(f"Successfully cached {len(dish_vectors)} dish embeddings.")
        return dish_vectors

    def _compute_tag_centroids(self) -> Dict[str, torch.Tensor]:
        """Creates 'Vectors' for tags by averaging vectors of dishes with those tags."""
        print("Computing Tag Embeddings...")
        tag_to_vectors = defaultdict(list)
        
        for dish_id, vector in self.dish_embeddings_cache.items():
            row = self.data['dishes'][self.data['dishes']['id'] == dish_id].iloc[0]
            
            all_tags = []
            # Use dataset helper to parse lists safely
            for col in ['food_tags', 'taste_tags', 'cooking_method_tags', 'culture_tags']:
                tags = self.dataset._safe_literal_eval(row.get(col, '[]'))
                if isinstance(tags, list):
                    all_tags.extend([t for t in tags if isinstance(t, str)])
            
            for tag in all_tags:
                tag_to_vectors[tag].append(vector)

        # Compute Mean and Normalize
        tag_embeddings = {}
        for tag, vectors in tag_to_vectors.items():
            if vectors:
                stacked = torch.stack(vectors)
                centroid = torch.mean(stacked, dim=0)
                # L2 Normalization
                centroid = torch.nn.functional.normalize(centroid, p=2, dim=0)
                tag_embeddings[tag] = centroid
                
        print(f"Computed embeddings for {len(tag_embeddings)} tags.")
        return tag_embeddings

    # =========================================================================
    # CORE RETRIEVAL LOGIC
    # =========================================================================

    def get_recommendations_for_embedding(self, user_emb: torch.Tensor, top_k: int = 10, store_id_filter: str = None) -> List[Tuple[str, float]]:
        """
        Core function: Finds nearest dishes to a given embedding vector.
        Includes Store Filtering logic.
        """
        # 1. Filter Candidates
        candidate_dish_ids = []
        if store_id_filter:
            # Ensure consistent type comparison (string vs string)
            filtered_df = self.data['dishes'][self.data['dishes']['store_id'].astype(str) == str(store_id_filter)]
            cached_ids = set(self.dish_embeddings_cache.keys())
            candidate_dish_ids = [did for did in filtered_df['id'] if did in cached_ids]
        else:
            candidate_dish_ids = list(self.dish_embeddings_cache.keys())

        if not candidate_dish_ids:
            # Handle empty result gracefully
            return []

        # 2. Calculate Similarity
        similarities = []
        for dish_id in candidate_dish_ids:
            dish_vec = self.dish_embeddings_cache[dish_id]
            score = torch.dot(user_emb, dish_vec).item()
            similarities.append((dish_id, score))
        
        # 3. Sort and Return
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]

    def get_user_embedding(self, user_id: str, timestamp=None) -> torch.Tensor:
        """Generates embedding for a specific user."""
        if timestamp is None:
            timestamp = pd.Timestamp.now()
        
        user_data = self.data['users'][self.data['users']['id'] == user_id].iloc[0].to_dict()
        features = self.dataset._encode_user_features(user_data, user_id, timestamp)
        batch_features = {k: v.unsqueeze(0).to(self.device) for k, v in features.items()}
        
        with torch.no_grad():
            user_emb = self.model.forward_user(batch_features).squeeze(0)
        return user_emb

    def _find_dishes_by_preference(self, preferences: Dict, top_n: int = 10) -> List[str]:
        """Finds dish IDs based on metadata filters (Cuisine, Taste, etc.)."""
        df = self.data['dishes'].copy()

        # Convert names to IDs if necessary, or assumes IDs are passed.
        # For robustness, we check intersection of lists.
        
        def safe_check_overlap(row_val, target_set):
            # Helper to check if row's tags overlap with target preferences
            row_tags = set(self.dataset._safe_literal_eval(row_val))
            # Filter out non-strings
            row_tags = {t for t in row_tags if isinstance(t, str)}
            return not row_tags.isdisjoint(target_set)

        try:
            filtered_df = df
            
            # 1. Cuisine / Culture
            if 'cuisine' in preferences and preferences['cuisine']:
                target = set(preferences['cuisine'])
                filtered_df = filtered_df[filtered_df['culture_tags'].apply(lambda x: safe_check_overlap(x, target))]

            # 2. Taste
            if 'taste' in preferences and preferences['taste']:
                target = set(preferences['taste'])
                filtered_df = filtered_df[filtered_df['taste_tags'].apply(lambda x: safe_check_overlap(x, target))]
            
            # 3. Price
            pref_price = preferences.get('price_range', 'any')
            if pref_price == 'budget':
                filtered_df = filtered_df[filtered_df['price'] <= 60000]
            elif pref_price == 'premium':
                filtered_df = filtered_df[filtered_df['price'] >= 70000]

            if filtered_df.empty:
                # Fallback to just top dishes if filter is too strict
                return df['id'].head(top_n).tolist()
            
            return filtered_df['id'].head(top_n).tolist()

        except Exception as e:
            print(f"Warning: Preference filter error: {e}. Returning fallback.")
            return df['id'].head(top_n).tolist()

    # =========================================================================
    # API FEATURE 1: USER RECOMMENDATIONS
    # =========================================================================

    def get_recommendations(self, user_id: str, top_k: int = 10, specific_timestamp=None) -> List[Tuple[str, float]]:
        """Get recommendations for an existing user."""
        if user_id not in self.dataset.users_lookup:
            raise ValueError(f"User {user_id} not found in dataset.")

        user_emb = self.get_user_embedding(user_id, specific_timestamp)
        return self.get_recommendations_for_embedding(user_emb, top_k=top_k)

    # =========================================================================
    # API FEATURE 2: SIMILAR DISHES (ITEM-TO-ITEM)
    # =========================================================================

    def get_similar_dishes(self, dish_id: str, top_k: int = 10, store_id_filter: str = None) -> List[Tuple[str, float]]:
        """Get similar dishes based on Dish Embedding distance."""
        if dish_id not in self.dish_embeddings_cache:
            raise ValueError(f"Dish {dish_id} not found in cache. Try retraining or reloading.")
            
        source_embedding = self.dish_embeddings_cache[dish_id]
        
        # Get recommendations using the dish vector as the query
        all_similar = self.get_recommendations_for_embedding(
            source_embedding, 
            top_k=top_k + 5, # Fetch extra to filter out self
            store_id_filter=store_id_filter
        )
        
        # Filter out the dish itself
        filtered = [(d_id, score) for d_id, score in all_similar if d_id != dish_id]
        return filtered[:top_k]

    # =========================================================================
    # API FEATURE 3: TAG RECOMMENDATION (POPUP)
    # =========================================================================

    def get_tags_for_order(self, dish_ids: List[str], top_k: int = 5) -> List[Tuple[str, float]]:
        """
        Generates tag recommendations based on a list of dishes (e.g., current order).
        """
        valid_embeddings = []
        for dish_id in dish_ids:
            if dish_id in self.dish_embeddings_cache:
                valid_embeddings.append(self.dish_embeddings_cache[dish_id])
        
        if not valid_embeddings:
            return []

        # Calculate Centroid of the Order
        stacked = torch.stack(valid_embeddings)
        order_vector = torch.mean(stacked, dim=0)
        order_vector = torch.nn.functional.normalize(order_vector, p=2, dim=0)

        # Find closest tags
        tag_scores = []
        for tag, tag_vec in self.tag_embeddings_map.items():
            score = torch.dot(order_vector, tag_vec).item()
            tag_scores.append((tag, score))
            
        tag_scores.sort(key=lambda x: x[1], reverse=True)
        return tag_scores[:top_k]
    
    def recommend_tags_for_user(self, user_id: str, top_k: int = 10) -> List[Tuple[str, float]]:
        """Recommends tags based on User History."""
        if user_id not in self.dataset.users_lookup:
            return []
            
        user_emb = self.get_user_embedding(user_id)
        
        tag_scores = []
        for tag, tag_vec in self.tag_embeddings_map.items():
            score = torch.dot(user_emb, tag_vec).item()
            tag_scores.append((tag, score))
            
        tag_scores.sort(key=lambda x: x[1], reverse=True)
        return tag_scores[:top_k]

    # =========================================================================
    # API FEATURE 4: COLD START SCENARIOS
    # =========================================================================

    def evaluate_cold_start_user(self, scenario: Dict) -> Dict[str, Any]:
        """Evaluate cold start user based on profile/preferences."""
        user_profile = scenario.get('user_profile', {})
        preferences = user_profile.get('preferences', {})
        
        # 1. Find dishes matching preferences
        matching_dish_ids = self._find_dishes_by_preference(preferences, top_n=10)
        
        # 2. Create User Proxy Vector (Average of matching dishes)
        vectors = [self.dish_embeddings_cache[did] for did in matching_dish_ids if did in self.dish_embeddings_cache]
        
        if vectors:
            user_proxy_emb = torch.mean(torch.stack(vectors), dim=0)
        else:
            # Fallback: Average of ALL dishes
            user_proxy_emb = torch.mean(torch.stack(list(self.dish_embeddings_cache.values())), dim=0)
            
        # 3. Get Recommendations
        recs = self.get_recommendations_for_embedding(user_proxy_emb, top_k=10)
        
        return {
            'scenario': 'cold_start_user',
            'input_preferences': preferences,
            'recommendations': recs
        }

    def evaluate_cold_start_dish(self, scenario: Dict, top_k: int = 10, store_id_filter: str = None) -> Dict[str, Any]:
        """Evaluate cold start dish (New Dish) based on its metadata."""
        dish_profile = scenario.get('dish_profile', {})
        
        # Treat the dish profile as a set of preferences to create a vector
        # (Conceptually: "What would a perfect user for this dish look like?")
        # Then find dishes similar to that concept.
        
        matching_dish_ids = self._find_dishes_by_preference(dish_profile, top_n=10)
        vectors = [self.dish_embeddings_cache[did] for did in matching_dish_ids if did in self.dish_embeddings_cache]
        
        if vectors:
            dish_proxy_emb = torch.mean(torch.stack(vectors), dim=0)
        else:
            # Fallback
            dish_proxy_emb = torch.mean(torch.stack(list(self.dish_embeddings_cache.values())), dim=0)
            
        similar_dishes = self.get_recommendations_for_embedding(
            dish_proxy_emb, 
            top_k=top_k, 
            store_id_filter=store_id_filter
        )
        
        return {
            'scenario': 'cold_start_dish',
            'input_profile': dish_profile,
            'similar_dishes_raw': similar_dishes
        }

    # =========================================================================
    # EVALUATION & ANALYSIS SCENARIOS
    # =========================================================================

    def evaluate_user_scenario(self, user_id: str, behavior_name: str) -> Dict[str, Any]:
        """Evaluates existing user and adds detailed analysis."""
        if user_id not in self.dataset.users_lookup:
            return {'error': f'User {user_id} not found'}

        recs = self.get_recommendations(user_id, top_k=10)
        
        # Simple Analysis
        analysis = self._analyze_recommendations(recs)
        
        return {
            'scenario': behavior_name,
            'user_id': user_id,
            'recommendations': recs,
            'analysis': analysis
        }

    def evaluate_budget_scenario(self, max_price: float) -> Dict[str, Any]:
        """Evaluates recommendations filtering for a specific budget."""
        # Use a sample user
        sample_user = self.data['users']['id'].iloc[0]
        
        # Fetch many, then filter
        raw_recs = self.get_recommendations(sample_user, top_k=50)
        
        budget_recs = []
        for did, score in raw_recs:
            price = self.data['dishes'][self.data['dishes']['id'] == did]['price'].iloc[0]
            if price <= max_price:
                budget_recs.append((did, score))
                if len(budget_recs) >= 10: break
        
        return {
            'scenario': 'budget_conscious',
            'max_price': max_price,
            'recommendations': budget_recs
        }

    def _analyze_recommendations(self, recs: List[Tuple[str, float]]) -> Dict[str, Any]:
        """Calculates basic diversity stats for recommendations."""
        categories = []
        prices = []
        
        for did, _ in recs:
            row = self.data['dishes'][self.data['dishes']['id'] == did].iloc[0]
            categories.append(row['category'])
            prices.append(row['price'])
            
        return {
            'unique_categories': len(set(categories)),
            'avg_price': np.mean(prices) if prices else 0,
            'price_min': np.min(prices) if prices else 0,
            'price_max': np.max(prices) if prices else 0
        }

    def run_comprehensive_evaluation(self) -> str:
        """Runs all defined scenarios and returns a formatted report string."""
        results = {}
        print("Running comprehensive evaluation...")

        # 1. Cold Start User
        if 'cold_start_user' in self.test_scenarios:
            print(" - Evaluating Cold Start...")
            results['cold_start'] = self.evaluate_cold_start_user(self.test_scenarios['cold_start_user'])

        # 2. Specific User (Dynamic Selection)
        # Pick the 5th user in the DB, or the 1st if dataset is small
        try:
            test_user_idx = 5 if len(self.data['users']) > 5 else 0
            test_user_id = self.data['users']['id'].iloc[test_user_idx]
            print(f" - Evaluating Specific User ({test_user_id})...")
            results['specific_user'] = self.evaluate_user_scenario(test_user_id, 'existing_user_test')
        except Exception as e:
            print(f" - Could not evaluate specific user: {e}")

        # 3. Budget Constraint
        print(" - Evaluating Budget Constraint (<= 50,000 VND)...")
        results['budget'] = self.evaluate_budget_scenario(50000)

        return self._generate_report_string(results)

    def _generate_report_string(self, results: Dict) -> str:
        """Helper to format the results dict into a readable text report."""
        lines = []
        lines.append("=" * 60)
        lines.append("MODEL EVALUATION REPORT")
        lines.append(f"Generated: {pd.Timestamp.now()}")
        lines.append("=" * 60)
        lines.append("")

        # --- Cold Start Report ---
        if 'cold_start' in results:
            res = results['cold_start']
            lines.append("[SCENARIO: COLD START]")
            lines.append(f"Input Preferences: {res.get('input_preferences')}")
            lines.append("Top Recommendations:")
            for dish_id, score in res.get('recommendations', [])[:5]:
                # Resolve Name
                name_row = self.data['dishes'][self.data['dishes']['id'] == dish_id]['name']
                name = name_row.iloc[0] if not name_row.empty else "Unknown Dish"
                lines.append(f"  - {name} (ID: {dish_id}) | Score: {score:.4f}")
            lines.append("-" * 40)

        # --- Specific User Report ---
        if 'specific_user' in results:
            res = results['specific_user']
            lines.append(f"[SCENARIO: EXISTING USER ({res.get('user_id')})]")
            if 'analysis' in res:
                stats = res['analysis']
                lines.append(f"Diversity Stats: {stats}")
            lines.append("Top Recommendations:")
            for dish_id, score in res.get('recommendations', [])[:5]:
                name_row = self.data['dishes'][self.data['dishes']['id'] == dish_id]['name']
                name = name_row.iloc[0] if not name_row.empty else "Unknown Dish"
                lines.append(f"  - {name} | Score: {score:.4f}")
            lines.append("-" * 40)

        # --- Budget Report ---
        if 'budget' in results:
            res = results['budget']
            lines.append(f"[SCENARIO: BUDGET (<= {res.get('max_price'):,.0f})]")
            lines.append("Recommendations (Price Checked):")
            for dish_id, score in res.get('recommendations', [])[:5]:
                dish_row = self.data['dishes'][self.data['dishes']['id'] == dish_id]
                if not dish_row.empty:
                    name = dish_row['name'].iloc[0]
                    price = dish_row['price'].iloc[0]
                    lines.append(f"  - {name} | Price: {price:,.0f} | Score: {score:.4f}")
            lines.append("-" * 40)

        return "\n".join(lines)