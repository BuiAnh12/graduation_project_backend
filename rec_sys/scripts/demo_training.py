"""
Demonstration script showing how the training pipeline works with mock data.

This script provides a quick overview of the training process without running
the full training loop, making it perfect for understanding the pipeline.
"""

import os
import sys
import pandas as pd
import numpy as np
import torch
import json
from typing import Dict, List, Tuple, Any

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def demo_data_loading():
    """Demonstrate loading and preprocessing mock data."""
    print("=" * 60)
    print("DEMONSTRATION: DATA LOADING AND PREPROCESSING")
    print("=" * 60)
    
    # Load mock data
    data_dir = 'data'
    
    users = pd.read_csv(os.path.join(data_dir, 'users.csv'))
    dishes = pd.read_csv(os.path.join(data_dir, 'dishes.csv'))
    interactions = pd.read_csv(os.path.join(data_dir, 'interactions.csv'))
    
    print(f"✓ Loaded {len(users)} users")
    print(f"✓ Loaded {len(dishes)} dishes")
    print(f"✓ Loaded {len(interactions)} interactions")
    
    # Show sample user
    print(f"\nSample User Profile:")
    sample_user = users.iloc[0]
    print(f"  - Name: {sample_user['name']}")
    print(f"  - Age: {sample_user['age']}")
    print(f"  - Gender: {sample_user['gender']}")
    print(f"  - Behavior: {sample_user['behavior']}")
    print(f"  - Preferences: {sample_user['preferences']}")
    
    # Show sample dish
    print(f"\nSample Dish:")
    sample_dish = dishes.iloc[0]
    print(f"  - Name: {sample_dish['name']}")
    print(f"  - Price: {sample_dish['price']:,} VND")
    print(f"  - Category: {sample_dish['category']}")
    print(f"  - Store: {sample_dish['store_id']}")
    
    # Show interaction patterns
    print(f"\nInteraction Types:")
    interaction_counts = interactions['interaction_type'].value_counts()
    for int_type, count in interaction_counts.items():
        print(f"  - {int_type}: {count}")
    
    return users, dishes, interactions

def demo_behavioral_patterns(users, interactions, dishes):
    """Demonstrate the behavioral patterns in the data."""
    print("\n" + "=" * 60)
    print("DEMONSTRATION: BEHAVIORAL PATTERNS")
    print("=" * 60)
    
    # Analyze each behavior type
    behaviors = users['behavior'].unique()
    
    for behavior in behaviors:
        behavior_users = users[users['behavior'] == behavior]['id'].tolist()
        behavior_interactions = interactions[interactions['user_id'].isin(behavior_users)]
        
        print(f"\n{behavior.upper().replace('_', ' ')}:")
        print(f"  - Users: {len(behavior_users)}")
        print(f"  - Total interactions: {len(behavior_interactions)}")
        
        if len(behavior_interactions) > 0:
            # Get most popular dishes for this behavior
            dish_interactions = behavior_interactions['dish_id'].value_counts().head(3)
            print(f"  - Top preferred dishes:")
            for dish_id, count in dish_interactions.items():
                dish_name = dishes[dishes['id'] == dish_id]['name'].iloc[0]
                print(f"    * {dish_name}: {count} interactions")

def demo_model_architecture():
    """Demonstrate the model architecture."""
    print("\n" + "=" * 60)
    print("DEMONSTRATION: MODEL ARCHITECTURE")
    print("=" * 60)
    
    print("Two-Tower Recommendation Model:")
    print("┌─────────────────┐    ┌─────────────────┐")
    print("│   User Tower    │    │   Item Tower    │")
    print("├─────────────────┤    ├─────────────────┤")
    print("│ • User ID       │    │ • Dish ID       │")
    print("│ • Age           │    │ • Store ID      │")
    print("│ • Gender        │    │ • Tags          │")
    print("│ • Location      │    │ • Tastes        │")
    print("│ • Time Context  │    │ • Category      │")
    print("│ • Recency       │    │ • Price         │")
    print("│ • Behavior      │    │ • Rating        │")
    print("└─────────────────┘    └─────────────────┘")
    print("         │                       │")
    print("         └───────┬───────────────┘")
    print("                 │")
    print("         ┌───────▼────────┐")
    print("         │  Similarity    │")
    print("         │  Computation   │")
    print("         └────────────────┘")
    
    print("\nKey Features:")
    print("• Separate towers for users and items")
    print("• Normalized embeddings for similarity")
    print("• Multi-hot encoding for tags and tastes")
    print("• Context-aware features (time, location)")
    print("• Behavioral pattern learning")

def demo_training_process():
    """Demonstrate the training process."""
    print("\n" + "=" * 60)
    print("DEMONSTRATION: TRAINING PROCESS")
    print("=" * 60)
    
    print("Training Pipeline:")
    print("1. Data Loading and Preprocessing")
    print("   ✓ Load mock data (users, dishes, interactions)")
    print("   ✓ Parse preferences and context data")
    print("   ✓ Create location features")
    print("   ✓ Build tag mappings")
    
    print("\n2. Negative Sampling")
    print("   ✓ Create positive samples from interactions")
    print("   ✓ Generate negative samples (4 per positive)")
    print("   ✓ Ensure temporal consistency")
    print("   ✓ Balance positive/negative ratio")
    
    print("\n3. Data Splitting")
    print("   ✓ Training set: 80% of interactions")
    print("   ✓ Validation set: 10% of interactions")
    print("   ✓ Test set: 10% of interactions")
    print("   ✓ Time-based splitting for realism")
    
    print("\n4. Model Training")
    print("   ✓ Initialize two-tower architecture")
    print("   ✓ Train with BCE loss (binary classification)")
    print("   ✓ Validate after each epoch")
    print("   ✓ Save best model based on validation loss")
    
    print("\n5. Training Configuration")
    print("   • Batch size: 16")
    print("   • Learning rate: 0.001")
    print("   • Epochs: 20")
    print("   • Embedding dimension: 64")
    print("   • Optimizer: Adam")

def demo_evaluation_scenarios():
    """Demonstrate the evaluation scenarios."""
    print("\n" + "=" * 60)
    print("DEMONSTRATION: EVALUATION SCENARIOS")
    print("=" * 60)
    
    # Load test scenarios
    with open('data/test_scenarios.json', 'r', encoding='utf-8') as f:
        test_scenarios = json.load(f)
    
    print("Test Scenarios for Model Evaluation:")
    
    for scenario_name, scenario in test_scenarios.items():
        print(f"\n{scenario_name.upper().replace('_', ' ')}:")
        print(f"  Description: {scenario['description']}")
        print(f"  Expected: {scenario['expected_behavior']}")
        
        if 'user_profile' in scenario:
            print(f"  User Profile: {scenario['user_profile']}")
        elif 'user_id' in scenario:
            print(f"  User ID: {scenario['user_id']}")
        elif 'user_criteria' in scenario:
            print(f"  Criteria: {scenario['user_criteria']}")

def demo_expected_results():
    """Demonstrate expected training results."""
    print("\n" + "=" * 60)
    print("DEMONSTRATION: EXPECTED TRAINING RESULTS")
    print("=" * 60)
    
    print("Expected Training Outcomes:")
    print("\n1. Model Convergence:")
    print("   • Training loss decreases steadily")
    print("   • Validation loss stabilizes")
    print("   • No significant overfitting")
    
    print("\n2. Behavioral Learning:")
    print("   • Health-conscious users get fresh, healthy recommendations")
    print("   • Spice lovers receive spicy dish recommendations")
    print("   • Traditional eaters get Vietnamese cuisine")
    print("   • Budget-conscious users see affordable options")
    
    print("\n3. Recommendation Quality:")
    print("   • High precision@5 (>70%)")
    print("   • Good recall@10 (>60%)")
    print("   • Appropriate diversity scores")
    print("   • Respect for user constraints")
    
    print("\n4. Cold Start Performance:")
    print("   • New users get reasonable recommendations")
    print("   • New dishes find suitable users")
    print("   • Fallback to popular items when needed")
    
    print("\n5. Business Metrics:")
    print("   • Recommendations align with user preferences")
    print("   • Price sensitivity is respected")
    print("   • Cuisine preferences are honored")
    print("   • Behavioral patterns are captured")

def demo_next_steps():
    """Demonstrate next steps after training."""
    print("\n" + "=" * 60)
    print("DEMONSTRATION: NEXT STEPS")
    print("=" * 60)
    
    print("After Successful Training:")
    
    print("\n1. Model Deployment:")
    print("   • Save trained model weights")
    print("   • Create serving API endpoint")
    print("   • Implement real-time inference")
    print("   • Set up monitoring and logging")
    
    print("\n2. Real Data Integration:")
    print("   • Replace mock data with real interactions")
    print("   • Implement data pipeline")
    print("   • Set up continuous training")
    print("   • Monitor model performance")
    
    print("\n3. Model Improvement:")
    print("   • Add more sophisticated features")
    print("   • Implement deep learning architectures")
    print("   • Add temporal modeling")
    print("   • Implement multi-task learning")
    
    print("\n4. Production Considerations:")
    print("   • A/B testing framework")
    print("   • Performance optimization")
    print("   • Scalability planning")
    print("   • User feedback integration")

def main():
    """Main demonstration function."""
    print("RECOMMENDATION SYSTEM TRAINING DEMONSTRATION")
    print("=" * 60)
    print("This demonstration shows how to train a recommendation system")
    print("using the generated mock data with realistic behavioral patterns.")
    print()
    
    # Run demonstrations
    users, dishes, interactions = demo_data_loading()
    demo_behavioral_patterns(users, interactions, dishes)
    demo_model_architecture()
    demo_training_process()
    demo_evaluation_scenarios()
    demo_expected_results()
    demo_next_steps()
    
    print("\n" + "=" * 60)
    print("DEMONSTRATION COMPLETE")
    print("=" * 60)
    print("\nTo actually train the model, run:")
    print("  python scripts/train_mock_model.py")
    print("\nTo evaluate the trained model, run:")
    print("  python scripts/evaluate_mock_model.py")
    print("\nFor detailed instructions, see TRAINING_GUIDE.md")

if __name__ == "__main__":
    main()
