import os
import sys
import pandas as pd
import numpy as np
import torch
import matplotlib.pyplot as plt
import seaborn as sns
from torch.utils.data import DataLoader

# Adjust imports based on your folder structure
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.data_preprocessor import DataPreprocessor
from src.dataset import FoodRecommendationDataset
from src.simple_two_tower_model import SimpleTwoTowerModel
from src.trainner import Trainer

# --- Configuration ---
DATA_DIR = 'server/src/data/exported_data/'
FRACTIONS = [0.2, 0.4, 0.6, 0.8, 1.0] # Train on 20%, 40%... 100%
NUM_EPOCHS = 8 # Lower epochs slightly to save time during experiment
BATCH_SIZE = 16
EMBEDDING_DIM = 64

def get_metrics_for_fraction(fraction, all_interactions, data_bundle, device):
    print(f"\n--- Experiment: Training on {fraction*100}% of data ---")
    
    # 1. Stable Split
    # CRITICAL: The Validation Set must remain FIXED. 
    # We only shrink the Training Set.
    total_len = len(all_interactions)
    train_cutoff = int(0.8 * total_len)
    
    train_pool = all_interactions[:train_cutoff]
    val_df = all_interactions[train_cutoff:] # Fixed Validation Set
    
    # Sub-sample the training pool
    subset_size = int(len(train_pool) * fraction)
    train_df_subset = train_pool.sample(n=subset_size, random_state=42)
    
    print(f"Train Size: {len(train_df_subset)} | Val Size: {len(val_df)}")

    # 2. Datasets
    train_dataset = FoodRecommendationDataset(train_df_subset, data_bundle['users'], data_bundle['dishes'])
    val_dataset = FoodRecommendationDataset(val_df, data_bundle['users'], data_bundle['dishes'])
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

    # 3. Initialize Fresh Model
    model = SimpleTwoTowerModel(
        user_vocab_size=int(train_dataset.user_vocab_size),
        dish_vocab_size=int(train_dataset.dish_vocab_size),
        store_vocab_size=int(train_dataset.store_vocab_size),
        tag_vocab_size=int(train_dataset.tag_vocab_size), 
        category_vocab_size=int(train_dataset.category_vocab_size),
        embedding_dim=EMBEDDING_DIM
    )

    # 4. Train
    trainer = Trainer(model, train_loader, val_loader, learning_rate=0.001, device=device)
    
    # We manually run the loop to get the best validation loss
    best_val_loss = float('inf')
    for _ in range(NUM_EPOCHS):
        trainer.train_epoch()
        val_loss = trainer.validate()
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            
    return best_val_loss

def main():
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    # 1. Load Data Once
    preprocessor = DataPreprocessor(DATA_DIR)
    data = preprocessor.load_data()
    data = preprocessor.preprocess_data(data)
    
    # 2. Create Negatives & Shuffle Once
    # (We reuse the logic from run_pipeline)
    from train import create_negative_samples
    neg_df = create_negative_samples(data['interactions'], data['users'], data['dishes'])
    all_interactions = pd.concat([data['interactions'], neg_df], ignore_index=True)
    all_interactions = all_interactions.sample(frac=1, random_state=42).reset_index(drop=True)
    
    results = []
    
    # 3. Loop through fractions
    for frac in FRACTIONS:
        loss = get_metrics_for_fraction(frac, all_interactions, data, device)
        results.append({'fraction': frac, 'val_loss': loss})
        
    # 4. Plotting
    df_res = pd.DataFrame(results)
    print("\nResults:")
    print(df_res)
    
    plt.figure(figsize=(10, 6))
    sns.lineplot(data=df_res, x='fraction', y='val_loss', marker='o')
    plt.title('Learning Curve: Does Data Size Matter?')
    plt.xlabel('Fraction of Training Data Used')
    plt.ylabel('Best Validation Loss (Lower is Better)')
    plt.grid(True)
    plt.show()
    
    # 5. Analysis
    slope = df_res['val_loss'].iloc[-1] - df_res['val_loss'].iloc[-2]
    if slope < -0.001:
        print("\n✅ PROOF POSITIVE: The curve is sloping downwards.")
        print("Adding more data will likely decrease loss further.")
    else:
        print("\n⚠️ PROOF NEGATIVE: The curve has flattened.")
        print("Adding data might not help much without changing the model architecture.")

if __name__ == "__main__":
    main()