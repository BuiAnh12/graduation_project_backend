"""
Training script using the generated mock data.

This script demonstrates how to train the recommendation system using the mock data.
"""

import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime
import json

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def load_mock_data():
    """Load all mock data files."""
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    
    # Load data files
    users = pd.read_csv(os.path.join(data_dir, 'users.csv'))
    dishes = pd.read_csv(os.path.join(data_dir, 'dishes.csv'))
    interactions = pd.read_csv(os.path.join(data_dir, 'interactions.csv'))
    
    # Load tag data
    food_tags = pd.read_csv(os.path.join(data_dir, 'food_tags.csv'))
    taste_tags = pd.read_csv(os.path.join(data_dir, 'taste_tags.csv'))
    cooking_method_tags = pd.read_csv(os.path.join(data_dir, 'cooking_method_tags.csv'))
    culture_tags = pd.read_csv(os.path.join(data_dir, 'culture_tags.csv'))
    
    # Load test scenarios
    with open(os.path.join(data_dir, 'test_scenarios.json'), 'r', encoding='utf-8') as f:
        test_scenarios = json.load(f)
    
    return {
        'users': users,
        'dishes': dishes,
        'interactions': interactions,
        'food_tags': food_tags,
        'taste_tags': taste_tags,
        'cooking_method_tags': cooking_method_tags,
        'culture_tags': culture_tags,
        'test_scenarios': test_scenarios
    }

def analyze_data(data):
    """Analyze the mock data to understand patterns."""
    print("="*60)
    print("MOCK DATA ANALYSIS")
    print("="*60)
    
    users = data['users']
    dishes = data['dishes']
    interactions = data['interactions']
    
    print(f"\n📊 DATA OVERVIEW:")
    print(f"• Users: {len(users)}")
    print(f"• Dishes: {len(dishes)}")
    print(f"• Interactions: {len(interactions)}")
    
    print(f"\n👥 USER BEHAVIOR DISTRIBUTION:")
    behavior_counts = users['behavior'].value_counts()
    for behavior, count in behavior_counts.items():
        print(f"• {behavior}: {count} users")
    
    print(f"\n🍽️ DISH DISTRIBUTION:")
    store_counts = dishes['store_id'].value_counts()
    for store, count in store_counts.items():
        print(f"• {store}: {count} dishes")
    
    category_counts = dishes['category'].value_counts()
    print(f"\n📋 DISH CATEGORIES:")
    for category, count in category_counts.items():
        print(f"• {category}: {count} dishes")
    
    print(f"\n💰 PRICE ANALYSIS:")
    price_stats = dishes['price'].describe()
    print(f"• Average price: {price_stats['mean']:,.0f} VND")
    print(f"• Price range: {price_stats['min']:,.0f} - {price_stats['max']:,.0f} VND")
    
    print(f"\n📈 INTERACTION ANALYSIS:")
    interaction_types = interactions['interaction_type'].value_counts()
    for int_type, count in interaction_types.items():
        print(f"• {int_type}: {count} interactions")
    
    # Rating analysis
    rated_interactions = interactions[interactions['rating'].notna()]
    if len(rated_interactions) > 0:
        print(f"\n⭐ RATING ANALYSIS:")
        print(f"• Rated interactions: {len(rated_interactions)}")
        avg_rating = rated_interactions['rating'].mean()
        print(f"• Average rating: {avg_rating:.2f}")
        
        rating_dist = rated_interactions['rating'].value_counts().sort_index()
        for rating, count in rating_dist.items():
            print(f"• {rating} stars: {count} ratings")

def demonstrate_user_behavior_patterns(data):
    """Demonstrate the behavioral patterns in the mock data."""
    print("\n" + "="*60)
    print("BEHAVIORAL PATTERN ANALYSIS")
    print("="*60)
    
    users = data['users']
    interactions = data['interactions']
    dishes = data['dishes']
    
    # Analyze each behavior type
    behaviors = users['behavior'].unique()
    
    for behavior in behaviors:
        behavior_users = users[users['behavior'] == behavior]['id'].tolist()
        behavior_interactions = interactions[interactions['user_id'].isin(behavior_users)]
        
        print(f"\n🔍 {behavior.upper().replace('_', ' ')}:")
        print(f"• Users: {len(behavior_users)}")
        print(f"• Total interactions: {len(behavior_interactions)}")
        
        if len(behavior_interactions) > 0:
            # Get dish preferences
            dish_interactions = behavior_interactions['dish_id'].value_counts()
            top_dishes = dish_interactions.head(3)
            
            print(f"• Top preferred dishes:")
            for dish_id, count in top_dishes.items():
                dish_name = dishes[dishes['id'] == dish_id]['name'].iloc[0]
                print(f"  - {dish_name}: {count} interactions")
            
            # Interaction type preferences
            int_type_dist = behavior_interactions['interaction_type'].value_counts()
            print(f"• Interaction preferences:")
            for int_type, count in int_type_dist.items():
                percentage = (count / len(behavior_interactions)) * 100
                print(f"  - {int_type}: {percentage:.1f}%")

def demonstrate_test_scenarios(data):
    """Demonstrate the test scenarios."""
    print("\n" + "="*60)
    print("TEST SCENARIOS FOR MODEL EVALUATION")
    print("="*60)
    
    test_scenarios = data['test_scenarios']
    
    for scenario_name, scenario in test_scenarios.items():
        print(f"\n🧪 {scenario_name.upper().replace('_', ' ')}:")
        print(f"• Description: {scenario['description']}")
        print(f"• Expected behavior: {scenario['expected_behavior']}")
        
        if 'user_profile' in scenario:
            print(f"• User profile: {scenario['user_profile']}")
        elif 'user_id' in scenario:
            print(f"• User ID: {scenario['user_id']}")
        elif 'user_criteria' in scenario:
            print(f"• User criteria: {scenario['user_criteria']}")

def create_training_recommendations():
    """Provide recommendations for training the model."""
    print("\n" + "="*60)
    print("TRAINING RECOMMENDATIONS")
    print("="*60)
    
    print("\n🎯 RECOMMENDED TRAINING APPROACH:")
    print("1. Use the interactions data to train collaborative filtering")
    print("2. Use dish tags and user preferences for content-based filtering")
    print("3. Implement hybrid approach combining both methods")
    
    print("\n📊 DATA SPLIT RECOMMENDATION:")
    print("• Training set: 80% of interactions (160 interactions)")
    print("• Validation set: 10% of interactions (20 interactions)")
    print("• Test set: 10% of interactions (20 interactions)")
    print("• Use temporal split (older interactions for training)")
    
    print("\n🔧 FEATURE ENGINEERING:")
    print("• User features: age, gender, location, behavior type")
    print("• Dish features: price, category, cuisine type, taste profile")
    print("• Interaction features: time of day, device, interaction type")
    
    print("\n📈 EVALUATION METRICS:")
    print("• Precision@K (K=5, 10)")
    print("• Recall@K (K=5, 10)")
    print("• NDCG@K (K=5, 10)")
    print("• Hit Rate")
    print("• Coverage")
    
    print("\n🧪 TESTING STRATEGY:")
    print("• Use test scenarios for different user types")
    print("• Test cold start scenarios (new users, new dishes)")
    print("• Validate behavioral pattern adherence")
    print("• Test recommendation diversity and novelty")

def main():
    """Main function to demonstrate mock data usage."""
    print("Loading mock data...")
    data = load_mock_data()
    
    analyze_data(data)
    demonstrate_user_behavior_patterns(data)
    demonstrate_test_scenarios(data)
    create_training_recommendations()
    
    print("\n" + "="*60)
    print("MOCK DATA READY FOR TRAINING!")
    print("="*60)
    print("\nYour mock data is now ready for training the recommendation system.")
    print("The data includes realistic behavioral patterns that your ML model can learn from.")
    print("\nNext steps:")
    print("1. Implement your recommendation algorithm")
    print("2. Use the provided test scenarios for evaluation")
    print("3. Train on the behavioral patterns in the data")
    print("4. Validate using the diverse user profiles")

if __name__ == "__main__":
    main()
