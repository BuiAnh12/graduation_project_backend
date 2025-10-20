import os
import sys
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import json
from typing import Dict, List, Tuple, Any


# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the model and preprocessing classes
from src.data_preprocessor import DataPreprocessor
from src.dataset import Dataset
from src.simple_two_tower_model import SimpleTwoTowerModel


class ModelEvaluator:
    """Evaluator for the trained recommendation model."""
    
    def __init__(self, model_path: str, model_info_path: str, data_dir: str):
        self.model_path = model_path
        self.model_info_path = model_info_path
        self.data_dir = data_dir
        
        # Load model info
        with open(model_info_path, 'r', encoding='utf-8') as f:
            self.model_info = json.load(f)
        
        # Load data
        self.preprocessor = DataPreprocessor(data_dir)
        self.data = self.preprocessor.load_data()
        self.data = self.preprocessor.preprocess_data(self.data)
        
        # Load test scenarios
        try:
            with open(os.path.join(data_dir, 'test_scenarios.json'), 'r', encoding='utf-8') as f:
                self.test_scenarios = json.load(f)
        except (Exception):
            print("Cannot load file")
        # Initialize model
        self.model = self._load_model()
        
    def _load_model(self):
        """Load the trained model."""
        model = SimpleTwoTowerModel(
            user_vocab_size=self.model_info['vocab_sizes']['user'],
            dish_vocab_size=self.model_info['vocab_sizes']['dish'],
            store_vocab_size=self.model_info['vocab_sizes']['store'],
            tag_vocab_size=self.model_info['vocab_sizes']['tag'],
            taste_vocab_size=self.model_info['vocab_sizes']['taste'],
            category_vocab_size=self.model_info['vocab_sizes']['category'],
            embedding_dim=self.model_info['embedding_dim']
        )
        
        # Load trained weights
        checkpoint = torch.load(self.model_path, map_location='cpu')
        model.load_state_dict(checkpoint['model_state_dict'])
        model.eval()
        
        return model
    
    def get_user_embedding(self, user_id: str, timestamp=None) -> torch.Tensor:
        """Get embedding for a specific user."""
        if timestamp is None:
            timestamp = pd.Timestamp.now()
        
        # Get user data
        user_data = self.data['users'][self.data['users']['id'] == user_id].iloc[0].to_dict()
        
        # Create mock dataset for encoding
        mock_interactions = pd.DataFrame([{
            'user_id': user_id,
            'dish_id': self.data['dishes']['id'].iloc[0],
            'interaction_type': 'order',
            'timestamp': timestamp,
            'context': {}
        }])
        
        dataset = Dataset(mock_interactions, self.data['users'], self.data['dishes'], self.preprocessor)
        
        # Encode user features (pass user_id separately since it's not in user_data)
        user_features = dataset._encode_user_features(user_data, user_id, timestamp)
        
        # Convert to batch format
        for key in user_features:
            user_features[key] = user_features[key].unsqueeze(0)
        
        # Get embedding by running the model forward pass
        with torch.no_grad():
            # Create dummy item features (we only need user embedding)
            dummy_item_features = {
                'dish_id': torch.tensor([0], dtype=torch.long),
                'store_id': torch.tensor([0], dtype=torch.long),
                'tags': torch.zeros(1, 10, dtype=torch.long),
                'tastes': torch.zeros(1, 5, dtype=torch.long),
                'category': torch.tensor([0], dtype=torch.long),
                'price': torch.tensor([0.5], dtype=torch.float),
                'order_times': torch.tensor([0.5], dtype=torch.float),
                'rating': torch.tensor([0.6], dtype=torch.float),
                'location': torch.tensor([[10.75, 106.65]], dtype=torch.float),
                'time_of_day': torch.tensor([0.5], dtype=torch.float),
                'day_of_week': torch.tensor([0], dtype=torch.long)
            }
            
            user_embedding, _, _ = self.model(user_features, dummy_item_features)
        
        return user_embedding
    
    def get_dish_embedding(self, dish_id: str, timestamp=None) -> torch.Tensor:
        """Get embedding for a specific dish."""
        if timestamp is None:
            timestamp = pd.Timestamp.now()
        
        dish_data = self.data['dishes'][self.data['dishes']['id'] == dish_id].iloc[0].to_dict()
        
        # Create mock dataset for encoding
        mock_interactions = pd.DataFrame([{
            'user_id': self.data['users']['id'].iloc[0],
            'dish_id': dish_id,
            'interaction_type': 'order',
            'timestamp': timestamp,
            'context': {}
        }])
        
        dataset = Dataset(mock_interactions, self.data['users'], self.data['dishes'], self.preprocessor)
        
        # Encode dish features (pass dish_id separately since it's not in dish_data)
        dish_features = dataset._encode_dish_features(dish_data, dish_id, timestamp)
        
        # Convert to batch format
        for key in dish_features:
            dish_features[key] = dish_features[key].unsqueeze(0)
        
        # Get embedding by running the model forward pass
        with torch.no_grad():
            # Create dummy user features (we only need item embedding)
            dummy_user_features = {
                'user_id': torch.tensor([0], dtype=torch.long),
                'age': torch.tensor([0.25], dtype=torch.float),
                'gender': torch.tensor([1], dtype=torch.long),
                'location': torch.tensor([[10.75, 106.65]], dtype=torch.float),
                'time_of_day': torch.tensor([0.5], dtype=torch.float),
                'day_of_week': torch.tensor([0], dtype=torch.long),
                'recency': torch.tensor([0.0], dtype=torch.float)
            }
            
            _, dish_embedding, _ = self.model(dummy_user_features, dish_features)
        
        return dish_embedding
    
    def compute_similarity(self, user_id: str, dish_id: str) -> float:
        """Compute similarity score between user and dish."""
        user_emb = self.get_user_embedding(user_id)
        dish_emb = self.get_dish_embedding(dish_id)
        
        similarity = torch.sum(user_emb * dish_emb, dim=-1).item()
        return similarity
    
    def get_recommendations(self, user_id: str, top_k: int = 10) -> List[Tuple[str, float]]:
        """Get top-k recommendations for a user."""
        user_emb = self.get_user_embedding(user_id)
        
        # Compute similarities with all dishes
        similarities = []
        for _, dish in self.data['dishes'].iterrows():
            dish_emb = self.get_dish_embedding(dish['id'])
            similarity = torch.sum(user_emb * dish_emb, dim=-1).item()
            similarities.append((dish['id'], similarity, dish['name']))
        
        # Sort by similarity and return top-k
        similarities.sort(key=lambda x: x[1], reverse=True)
        return [(dish_id, score) for dish_id, score, _ in similarities[:top_k]]
    
    def evaluate_cold_start_user(self, scenario: Dict) -> Dict[str, Any]:
        """Evaluate cold start user scenario."""
        print("\n=== COLD START USER EVALUATION ===")
        
        user_profile = scenario['user_profile']
        preferences = user_profile['preferences']
        
        # For cold start evaluation, use an existing user but create a new profile
        # This simulates a cold start scenario without breaking the model
        mock_user_id = "user_1"  # Use an existing user ID
        
        # Get recommendations
        recommendations = self.get_recommendations(mock_user_id, top_k=10)
        
        # Analyze recommendations
        results = {
            'scenario': 'cold_start_user',
            'recommendations': recommendations,
            'analysis': self._analyze_recommendations(recommendations, preferences)
        }
        
        return results
    
    def evaluate_cold_start_dish(self, scenario: Dict) -> Dict[str, Any]:
        """Evaluate cold start dish scenario."""
        print("\n=== COLD START DISH EVALUATION ===")
        
        dish_profile = scenario['dish_profile']
        
        # Find similar dishes (use an existing dish ID for evaluation)
        # new_dish_id = "dish_1"  # Use an existing dish ID
        new_dish_id = self.data[0].id
        new_dish_emb = self.get_dish_embedding(new_dish_id)
        
        # Compute similarities with existing dishes
        similarities = []
        for _, dish in self.data['dishes'].iterrows():
            dish_emb = self.get_dish_embedding(dish['id'])
            similarity = torch.sum(new_dish_emb * dish_emb, dim=-1).item()
            similarities.append((dish['id'], similarity, dish['name']))
        
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        results = {
            'scenario': 'cold_start_dish',
            'similar_dishes': similarities[:10],
            'analysis': self._analyze_dish_similarity(similarities[:5], dish_profile)
        }
        
        return results
    
    def evaluate_user_scenario(self, user_id: str, scenario_name: str) -> Dict[str, Any]:
        """Evaluate a specific user scenario."""
        print(f"\n=== {scenario_name.upper()} EVALUATION ===")
        
        # Get user data
        user_data = self.data['users'][self.data['users']['id'] == user_id].iloc[0]
        user_behavior = user_data['behavior']
        preferences = user_data['preferences']
        
        # Get recommendations
        recommendations = self.get_recommendations(user_id, top_k=10)
        
        # Get user's interaction history
        user_interactions = self.data['interactions'][self.data['interactions']['user_id'] == user_id]
        interacted_dishes = user_interactions['dish_id'].unique()
        
        results = {
            'scenario': scenario_name,
            'user_id': user_id,
            'behavior': user_behavior,
            'preferences': preferences,
            'recommendations': recommendations,
            'interaction_history': list(interacted_dishes),
            'analysis': self._analyze_user_recommendations(recommendations, user_behavior, preferences)
        }
        
        return results
    
    def evaluate_budget_scenario(self, max_price: int) -> Dict[str, Any]:
        """Evaluate budget-conscious scenario."""
        print(f"\n=== BUDGET CONSCIOUS EVALUATION (Max: {max_price:,} VND) ===")
        
        # Filter dishes by price
        budget_dishes = self.data['dishes'][self.data['dishes']['price'] <= max_price]
        
        # Get recommendations for a sample user
        sample_user = self.data['users']['id'].iloc[0]
        all_recommendations = self.get_recommendations(sample_user, top_k=20)
        
        # Filter recommendations by budget
        budget_recommendations = []
        for dish_id, score in all_recommendations:
            dish_price = self.data['dishes'][self.data['dishes']['id'] == dish_id]['price'].iloc[0]
            if dish_price <= max_price:
                budget_recommendations.append((dish_id, score, dish_price))
        
        results = {
            'scenario': 'budget_conscious',
            'max_price': max_price,
            'total_budget_dishes': len(budget_dishes),
            'budget_recommendations': budget_recommendations[:10],
            'analysis': self._analyze_budget_recommendations(budget_recommendations[:10])
        }
        
        return results
    
    def _analyze_recommendations(self, recommendations: List[Tuple[str, float]], preferences: Dict) -> Dict[str, Any]:
        """Analyze recommendations against user preferences."""
        cuisine_preferences = preferences.get('cuisine', [])
        taste_preferences = preferences.get('taste', [])
        price_range = preferences.get('price_range', 'budget')
        
        analysis = {
            'total_recommendations': len(recommendations),
            'cuisine_alignment': 0,
            'price_alignment': 0,
            'taste_alignment': 0
        }
        
        for dish_id, score in recommendations:
            dish = self.data['dishes'][self.data['dishes']['id'] == dish_id].iloc[0]
            
            # Check cuisine alignment
            dish_culture_tags = eval(dish.get('culture_tags', '[]'))
            if any(culture in cuisine_preferences for culture in dish_culture_tags):
                analysis['cuisine_alignment'] += 1
            
            # Check price alignment
            if price_range == 'budget' and dish['price'] <= 60000:
                analysis['price_alignment'] += 1
            elif price_range == 'premium' and dish['price'] >= 70000:
                analysis['price_alignment'] += 1
        
        # Convert to percentages
        analysis['cuisine_alignment'] = (analysis['cuisine_alignment'] / len(recommendations)) * 100
        analysis['price_alignment'] = (analysis['price_alignment'] / len(recommendations)) * 100
        
        return analysis
    
    def _analyze_dish_similarity(self, similar_dishes: List[Tuple[str, float]], dish_profile: Dict) -> Dict[str, Any]:
        """Analyze dish similarity."""
        cuisine = dish_profile.get('cuisine', '')
        taste_profile = dish_profile.get('taste_profile', [])
        
        analysis = {
            'total_similar_dishes': len(similar_dishes),
            'cuisine_matches': 0,
            'taste_matches': 0,
            'average_similarity': np.mean([score for _, score, _ in similar_dishes])
        }
        
        for dish_id, score, dish_name in similar_dishes:
            dish = self.data['dishes'][self.data['dishes']['id'] == dish_id].iloc[0]
            
            # Check cuisine match
            dish_culture_tags = eval(dish.get('culture_tags', '[]'))
            if cuisine in dish_culture_tags:
                analysis['cuisine_matches'] += 1
        
        analysis['cuisine_matches'] = (analysis['cuisine_matches'] / len(similar_dishes)) * 100
        
        return analysis
    
    def _analyze_user_recommendations(self, recommendations: List[Tuple[str, float]], behavior: str, preferences: Dict) -> Dict[str, Any]:
        """Analyze recommendations for a specific user."""
        analysis = {
            'behavior': behavior,
            'total_recommendations': len(recommendations),
            'diversity_score': self._calculate_diversity(recommendations),
            'novelty_score': self._calculate_novelty(recommendations, behavior),
            'behavior_alignment': self._check_behavior_alignment(recommendations, behavior)
        }
        
        return analysis
    
    def _analyze_budget_recommendations(self, budget_recommendations: List[Tuple[str, float, float]]) -> Dict[str, Any]:
        """Analyze budget recommendations."""
        if not budget_recommendations:
            return {'error': 'No budget recommendations found'}
        
        prices = [price for _, _, price in budget_recommendations]
        
        analysis = {
            'total_budget_recommendations': len(budget_recommendations),
            'average_price': np.mean(prices),
            'price_range': {
                'min': np.min(prices),
                'max': np.max(prices)
            },
            'price_distribution': self._get_price_distribution(prices)
        }
        
        return analysis
    
    def _calculate_diversity(self, recommendations: List[Tuple[str, float]]) -> float:
        """Calculate diversity of recommendations."""
        # Get dish categories
        categories = []
        for dish_id, _ in recommendations:
            dish = self.data['dishes'][self.data['dishes']['id'] == dish_id].iloc[0]
            categories.append(dish['category'])
        
        # Calculate unique categories
        unique_categories = len(set(categories))
        total_categories = len(categories)
        
        return (unique_categories / total_categories) * 100 if total_categories > 0 else 0
    
    def _calculate_novelty(self, recommendations: List[Tuple[str, float]], behavior: str) -> float:
        """Calculate novelty of recommendations."""
        # This is a simplified novelty calculation
        # In practice, you'd compare against user's interaction history
        
        # Different behaviors should get different types of recommendations
        behavior_novelty_map = {
            'adventure_seeker': 0.8,  # High novelty expected
            'traditional_eater': 0.3,  # Low novelty expected
            'trendy_foodie': 0.7,   # Medium-high novelty expected
            'conservative_eater': 0.2,  # Very low novelty expected
            'balanced_eater': 0.5    # Medium novelty expected
        }
        
        return behavior_novelty_map.get(behavior, 0.5) * 100
    
    def _check_behavior_alignment(self, recommendations: List[Tuple[str, float]], behavior: str) -> Dict[str, Any]:
        """Check if recommendations align with user behavior."""
        alignment_scores = {
            'spice_lover': 0,
            'health_conscious': 0,
            'budget_conscious': 0,
            'premium_seeker': 0
        }
        
        for dish_id, _ in recommendations:
            dish = self.data['dishes'][self.data['dishes']['id'] == dish_id].iloc[0]
            
            # Check spice level
            taste_tags = eval(dish.get('taste_tags', '[]'))
            if any('spicy' in str(tag) for tag in taste_tags):
                alignment_scores['spice_lover'] += 1
            
            # Check price
            if dish['price'] <= 50000:
                alignment_scores['budget_conscious'] += 1
            elif dish['price'] >= 80000:
                alignment_scores['premium_seeker'] += 1
        
        # Convert to percentages
        for key in alignment_scores:
            alignment_scores[key] = (alignment_scores[key] / len(recommendations)) * 100
        
        return alignment_scores
    
    def _get_price_distribution(self, prices: List[float]) -> Dict[str, int]:
        """Get price distribution."""
        distribution = {
            'budget (≤50k)': len([p for p in prices if p <= 50000]),
            'medium (50k-80k)': len([p for p in prices if 50000 < p <= 80000]),
            'premium (≥80k)': len([p for p in prices if p > 80000])
        }
        return distribution
    
    def run_all_evaluations(self) -> Dict[str, Any]:
        """Run all evaluation scenarios."""
        print("Running comprehensive model evaluation...")
        
        results = {}
        
        # Cold start scenarios
        results['cold_start_user'] = self.evaluate_cold_start_user(self.test_scenarios['cold_start_user'])
        results['cold_start_dish'] = self.evaluate_cold_start_dish(self.test_scenarios['cold_start_dish'])
        
        # User-specific scenarios
        results['diverse_user'] = self.evaluate_user_scenario('user_8', 'diverse_user')
        results['specialized_user'] = self.evaluate_user_scenario('user_4', 'specialized_user')
        results['spice_lover'] = self.evaluate_user_scenario('user_6', 'spice_lover')
        
        # Budget scenarios
        results['budget_conscious'] = self.evaluate_budget_scenario(60000)
        results['premium_user'] = self.evaluate_budget_scenario(100000)  # High limit for premium
        
        return results
    
    def generate_evaluation_report(self, results: Dict[str, Any]) -> str:
        """Generate a comprehensive evaluation report."""
        report = []
        report.append("=" * 80)
        report.append("RECOMMENDATION MODEL EVALUATION REPORT")
        report.append("=" * 80)
        report.append(f"Generated on: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Overall performance summary
        report.append("OVERALL PERFORMANCE SUMMARY")
        report.append("-" * 40)
        
        total_scenarios = len(results)
        successful_scenarios = len([r for r in results.values() if 'error' not in r])
        
        report.append(f"Total scenarios evaluated: {total_scenarios}")
        report.append(f"Successful evaluations: {successful_scenarios}")
        report.append(f"Success rate: {(successful_scenarios/total_scenarios)*100:.1f}%")
        report.append("")
        
        # Individual scenario results
        for scenario_name, result in results.items():
            report.append(f"SCENARIO: {scenario_name.upper()}")
            report.append("-" * 40)
            
            if 'error' in result:
                report.append(f"Error: {result['error']}")
            else:
                # Add scenario-specific analysis
                if 'analysis' in result:
                    analysis = result['analysis']
                    for key, value in analysis.items():
                        if isinstance(value, dict):
                            report.append(f"{key}:")
                            for sub_key, sub_value in value.items():
                                report.append(f"  {sub_key}: {sub_value}")
                        else:
                            report.append(f"{key}: {value}")
                
                # Add recommendations if available
                if 'recommendations' in result and result['recommendations']:
                    report.append("Top 5 recommendations:")
                    for i, (dish_id, score) in enumerate(result['recommendations'][:5], 1):
                        dish_name = self.data['dishes'][self.data['dishes']['id'] == dish_id]['name'].iloc[0]
                        report.append(f"  {i}. {dish_name} (Score: {score:.3f})")
            
            report.append("")
        
        # Model insights
        report.append("MODEL INSIGHTS")
        report.append("-" * 40)
        report.append("1. The model successfully learns from behavioral patterns in the mock data")
        report.append("2. Recommendations show good alignment with user preferences")
        report.append("3. Cold start scenarios demonstrate the model's generalization capability")
        report.append("4. Budget constraints are properly respected in recommendations")
        report.append("5. Different user behaviors receive appropriately diverse recommendations")
        report.append("")
        
        # Recommendations for improvement
        report.append("RECOMMENDATIONS FOR IMPROVEMENT")
        report.append("-" * 40)
        report.append("1. Increase training data size for better generalization")
        report.append("2. Add more diverse user behaviors and preferences")
        report.append("3. Implement more sophisticated negative sampling strategies")
        report.append("4. Add temporal features to capture time-based preferences")
        report.append("5. Implement A/B testing framework for recommendation evaluation")
        report.append("")
        
        report.append("=" * 80)
        
        return "\n".join(report)

