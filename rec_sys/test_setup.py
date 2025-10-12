"""
Test script to validate the recommendation system setup.

This script tests the key components of the recommendation system.
"""

import os
import sys
import pandas as pd
import numpy as np
import torch
from typing import Dict, List, Any

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.preprocessing.encoders import FeatureEncoder
from src.preprocessing.dataset_builder import DatasetBuilder, create_sample_data
from src.models.two_tower import TwoTowerModel


def test_encoders():
    """Test feature encoders."""
    print("Testing feature encoders...")
    
    # Create sample data
    interactions_df, users_df, dishes_df = create_sample_data()
    
    # Create and fit encoder
    encoder = FeatureEncoder()
    encoder.fit({
        'users': users_df,
        'dishes': dishes_df,
        'interactions': interactions_df
    })
    
    # Test encoding
    user_data = users_df.iloc[0].to_dict()
    item_data = dishes_df.iloc[0].to_dict()
    
    user_features = encoder.encode_user_features(user_data)
    item_features = encoder.encode_item_features(item_data)
    
    print(f"✓ User features encoded: {len(user_features)} features")
    print(f"✓ Item features encoded: {len(item_features)} features")
    
    return encoder


def test_dataset_builder():
    """Test dataset builder with negative sampling."""
    print("Testing dataset builder...")
    
    # Create sample data
    interactions_df, users_df, dishes_df = create_sample_data()
    
    # Create dataset builder
    builder = DatasetBuilder(interactions_df, users_df, dishes_df, num_negatives=4)
    
    # Create datasets
    datasets = builder.create_datasets()
    
    # Check dataset statistics
    stats = builder.get_dataset_stats(datasets)
    
    print(f"✓ Train dataset: {stats['train']['total_examples']} examples")
    print(f"✓ Val dataset: {stats['val']['total_examples']} examples")
    print(f"✓ Test dataset: {stats['test']['total_examples']} examples")
    
    return datasets


def test_model():
    """Test two-tower model."""
    print("Testing two-tower model...")
    
    # Create sample data
    interactions_df, users_df, dishes_df = create_sample_data()
    
    # Create encoder
    encoder = FeatureEncoder()
    encoder.fit({
        'users': users_df,
        'dishes': dishes_df,
        'interactions': interactions_df
    })
    
    # Create model
    vocab_sizes = encoder.get_vocab_sizes()
    model = TwoTowerModel(
        user_vocab_size=vocab_sizes['user'],
        dish_vocab_size=vocab_sizes['dish'],
        store_vocab_size=vocab_sizes['store'],
        tag_vocab_size=vocab_sizes['tag'],
        taste_vocab_size=vocab_sizes['taste'],
        category_vocab_size=vocab_sizes['category']
    )
    
    # Test forward pass
    user_data = users_df.iloc[0].to_dict()
    item_data = dishes_df.iloc[0].to_dict()
    
    user_features = encoder.encode_user_features(user_data)
    item_features = encoder.encode_item_features(item_data)
    
    # Convert to tensors
    user_tensors = {k: torch.tensor(v, dtype=torch.long if k in ['user_id', 'gender', 'day_of_week'] else torch.float) 
                   for k, v in user_features.items()}
    item_tensors = {k: torch.tensor(v, dtype=torch.long if k in ['dish_id', 'store_id', 'category', 'tags', 'tastes', 'day_of_week'] else torch.float) 
                   for k, v in item_features.items()}
    
    # Forward pass
    with torch.no_grad():
        user_emb, item_emb, score = model(user_tensors, item_tensors)
    
    print(f"✓ Model forward pass successful")
    print(f"  User embedding shape: {user_emb.shape}")
    print(f"  Item embedding shape: {item_emb.shape}")
    print(f"  Score: {score.item():.4f}")
    
    return model


def test_training_components():
    """Test training components."""
    print("Testing training components...")
    
    # Create sample data
    interactions_df, users_df, dishes_df = create_sample_data()
    
    # Create encoder
    encoder = FeatureEncoder()
    encoder.fit({
        'users': users_df,
        'dishes': dishes_df,
        'interactions': interactions_df
    })
    
    # Create model
    vocab_sizes = encoder.get_vocab_sizes()
    model = TwoTowerModel(
        user_vocab_size=vocab_sizes['user'],
        dish_vocab_size=vocab_sizes['dish'],
        store_vocab_size=vocab_sizes['store'],
        tag_vocab_size=vocab_sizes['tag'],
        taste_vocab_size=vocab_sizes['taste'],
        category_vocab_size=vocab_sizes['category']
    )
    
    # Test loss computation
    criterion = torch.nn.BCEWithLogitsLoss()
    
    # Create dummy batch
    batch_size = 4
    user_emb = torch.randn(batch_size, 64)
    item_emb = torch.randn(batch_size, 64)
    labels = torch.randint(0, 2, (batch_size,)).float()
    
    scores = torch.sum(user_emb * item_emb, dim=-1)
    loss = criterion(scores, labels)
    
    print(f"✓ Loss computation successful: {loss.item():.4f}")
    
    return True


def run_all_tests():
    """Run all tests."""
    print("=== RECOMMENDATION SYSTEM TESTS ===\n")
    
    tests = [
        ("Feature Encoders", test_encoders),
        ("Dataset Builder", test_dataset_builder),
        ("Two-Tower Model", test_model),
        ("Training Components", test_training_components),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            print(f"\n--- {test_name} ---")
            test_func()
            print(f"✓ {test_name} passed")
            passed += 1
        except Exception as e:
            print(f"✗ {test_name} failed: {e}")
    
    print(f"\n=== TEST RESULTS ===")
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All tests passed! The recommendation system is ready.")
    else:
        print("⚠️  Some tests failed. Please check the errors above.")
    
    return passed == total


if __name__ == "__main__":
    run_all_tests()
