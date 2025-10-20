import os
import sys
import pandas as pd
import numpy as np
import torch
from torch.utils.data import DataLoader
import json
import random
import argparse

# Assume these modules exist in your project
from src.data_preprocessor import DataPreprocessor
from src.dataset import Dataset
from src.simple_two_tower_model import SimpleTwoTowerModel
from src.trainner import Trainer

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set seeds for consistent results
torch.manual_seed(42)
np.random.seed(42)
random.seed(42)


def create_negative_samples(interactions_df, users_df, dishes_df, num_negatives=4):
    """Creates negative samples for training."""
    # (This function does not need to be changed)
    negative_samples = []
    all_dishes_set = set(dishes_df['id'].unique())
    user_interactions_map = interactions_df.groupby('user_id')['dish_id'].apply(set)
    for _, row in interactions_df.iterrows():
        user_id = row['user_id']
        user_interacted_dishes = user_interactions_map.get(user_id, set())
        negative_candidates = list(all_dishes_set - user_interacted_dishes)
        if len(negative_candidates) >= num_negatives:
            negatives = np.random.choice(negative_candidates, num_negatives, replace=False)
        elif negative_candidates:
            negatives = np.random.choice(negative_candidates, num_negatives, replace=True)
        else:
            continue
        for neg_dish_id in negatives:
            negative_samples.append({
                'user_id': user_id, 'dish_id': neg_dish_id,
                'interaction_type': 'negative', 'timestamp': row['timestamp'],
                'context': row['context']
            })
    return pd.DataFrame(negative_samples)

def run_training(
    data_dir='data',
    save_dir='runs/mock_training',
    batch_size=16,
    learning_rate=0.001,
    num_epochs=20,
    embedding_dim=64,
    num_negatives=4,
    device=None
):
    """
    Main training function that loads data, creates a model, and runs the training loop.
    """
    # Set default device if one isn't provided
    if device is None:
        device = 'cuda' if torch.cuda.is_available() else 'cpu'

    print("Starting training...")
    print(f"Using device: {device}")

    # Load and preprocess data
    print("Loading and preprocessing data...")
    preprocessor = DataPreprocessor(data_dir)
    data = preprocessor.load_data()
    data = preprocessor.preprocess_data(data)

    # Create negative samples
    print("Creating negative samples...")
    negative_samples = create_negative_samples(
        data['interactions'], data['users'], data['dishes'], num_negatives=num_negatives
    )

    # Combine and shuffle
    all_interactions = pd.concat([data['interactions'], negative_samples], ignore_index=True)
    all_interactions = all_interactions.sample(frac=1, random_state=42).reset_index(drop=True)

    # Split data
    train_size = int(0.8 * len(all_interactions))
    val_size = int(0.1 * len(all_interactions))
    train_interactions = all_interactions[:train_size]
    val_interactions = all_interactions[train_size:train_size + val_size]
    test_interactions = all_interactions[train_size + val_size:]

    print("Dataset divided:")
    print(f"  - Train: {len(train_interactions)} interactions")
    print(f"  - Validation: {len(val_interactions)} interactions")
    print(f"  - Test: {len(test_interactions)} interactions")

    # Create datasets and loaders
    train_dataset = Dataset(train_interactions, data['users'], data['dishes'], preprocessor)
    val_dataset = Dataset(val_interactions, data['users'], data['dishes'], preprocessor)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    # Initialize model
    print("Initializing model...")
    model = SimpleTwoTowerModel(
        user_vocab_size=train_dataset.user_vocab_size,
        dish_vocab_size=train_dataset.dish_vocab_size,
        store_vocab_size=train_dataset.store_vocab_size,
        tag_vocab_size=train_dataset.tag_vocab_size,
        taste_vocab_size=train_dataset.taste_vocab_size,
        category_vocab_size=train_dataset.category_vocab_size,
        embedding_dim=embedding_dim
    )
    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")

    # Create and run trainer
    trainer = Trainer(
        model=model, train_loader=train_loader, val_loader=val_loader,
        learning_rate=learning_rate, device=device
    )
    print(f"Starting training for {num_epochs} epochs...")
    trainer.train(num_epochs=num_epochs, save_dir=save_dir)
    print("Training completed!")

    # Save model info
    os.makedirs(save_dir, exist_ok=True)
    model_info_path = os.path.join(save_dir, 'model_info.json')
    model_info = {
        'vocab_sizes': {
            'user': train_dataset.user_vocab_size, 'dish': train_dataset.dish_vocab_size,
            'store': train_dataset.store_vocab_size, 'tag': train_dataset.tag_vocab_size,
            'taste': train_dataset.taste_vocab_size, 'category': train_dataset.category_vocab_size
        },
        'embedding_dim': embedding_dim, 'user_vocab': train_dataset.user_vocab,
        'dish_vocab': train_dataset.dish_vocab, 'store_vocab': train_dataset.store_vocab,
        'category_vocab': train_dataset.category_vocab, 'tag_vocab': train_dataset.tag_vocab,
        'taste_vocab': train_dataset.taste_vocab
    }
    with open(model_info_path, 'w', encoding='utf-8') as f:
        json.dump(model_info, f, indent=2, ensure_ascii=False)
    print(f"Model info saved to {model_info_path}")


# Call the training function with your custom settings
run_training(
    data_dir='server/src/data/exported_data/',
    save_dir='rec_sys/server/model',
    batch_size=16,
    learning_rate=0.001,
    num_epochs=30,
    embedding_dim=128,
    num_negatives=5,
    device='cpu'
)
