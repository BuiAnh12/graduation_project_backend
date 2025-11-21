import os
import sys
import pandas as pd
import numpy as np
import torch
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.decomposition import PCA
from tqdm import tqdm

# Setup paths
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server.src.evaluate import ModelEvaluator

# --- Config ---
MODEL_PATH = './server/model/best_model.pth'
MODEL_INFO_PATH = './server/model/model_info.json'
DATA_DIR = "server/src/data/exported_data/"

def analyze_learning_dynamics():
    print("--- Starting User Learning Dynamics Analysis ---")
    
    try:
        evaluator = ModelEvaluator(MODEL_PATH, MODEL_INFO_PATH, DATA_DIR)
    except Exception as e:
        print(f"Error: {e}")
        return

    # 1. Setup: Get Universe of Dishes
    dish_ids = list(evaluator.dish_embeddings_cache.keys())
    dish_vectors_np = np.array([evaluator.dish_embeddings_cache[d].cpu().numpy() for d in dish_ids])
    dish_id_to_idx = {d: i for i, d in enumerate(dish_ids)} # Map ID to Matrix Index
    
    # 2. Find the "Richest" User (Most interactions)
    interactions = evaluator.data['interactions']
    user_counts = interactions.groupby('user_id').size()
    target_user_id = user_counts.idxmax()
    total_interactions = user_counts[target_user_id]
    
    print(f"Analyzing Target User: {target_user_id}")
    print(f"Total History Length: {total_interactions} interactions")

    # 3. Get Ordered History
    user_history = interactions[interactions['user_id'] == target_user_id].sort_values('timestamp')
    history_items = user_history['dish_id'].tolist()

    # Calculate the "FINAL TRUE VECTOR" (Ground Truth at end of time)
    all_known_vectors = [evaluator.dish_embeddings_cache[d] for d in history_items if d in evaluator.dish_embeddings_cache]
    final_user_vector = torch.mean(torch.stack(all_known_vectors), dim=0)

    trajectory_data = []
    running_vectors = []

    print("\n--- Step-by-Step Learning Log ---")
    print(f"{'Step':<5} | {'Item Added':<25} | {'Sim to Final':<12} | {'Next Item Rank':<15}")
    print("-" * 65)

    for t in range(len(history_items) - 1):
        current_item = history_items[t]
        next_item = history_items[t+1] # The item we try to predict
        
        # Update User State
        if current_item in evaluator.dish_embeddings_cache:
            running_vectors.append(evaluator.dish_embeddings_cache[current_item])
        
        if not running_vectors: continue

        # A. Current User Vector (Understanding at time t)
        current_mean_tensor = torch.mean(torch.stack(running_vectors), dim=0)
        current_mean_np = current_mean_tensor.cpu().numpy()
        
        # B. Metric 1: Convergence (Cosine Sim to Final Truth)
        sim_to_final = torch.nn.functional.cosine_similarity(
            current_mean_tensor.unsqueeze(0), 
            final_user_vector.unsqueeze(0)
        ).item()

        # C. Metric 2: Predictive Rank (Where is the next item in our list?)
        # We score ALL dishes against current vector
        all_dish_tensor = torch.stack(list(evaluator.dish_embeddings_cache.values()))
        scores = torch.matmul(all_dish_tensor, current_mean_tensor) # Dot product
        
        # Sort scores descending
        sorted_indices = torch.argsort(scores, descending=True).cpu().numpy()
        
        # Find rank of 'next_item'
        # Note: dish_embeddings_cache.values() ordering might differ from dish_ids list
        # We need to map back safely.
        ranked_dish_ids = [list(evaluator.dish_embeddings_cache.keys())[i] for i in sorted_indices]
        
        try:
            rank = ranked_dish_ids.index(next_item) + 1 # 1-based index
        except ValueError:
            rank = -1 # Item not in cache

        # Log to Console
        dish_name = evaluator.data['dishes'][evaluator.data['dishes']['id'] == current_item]['name'].iloc[0]
        print(f"{t+1:<5} | {dish_name[:23]:<25} | {sim_to_final:.4f}       | #{rank:<13}")

        trajectory_data.append({
            "step": t + 1,
            "vector": current_mean_np,
            "similarity_to_final": sim_to_final,
            "next_item_rank": rank
        })

    # 4. Visualization (Dual Plot)
    fig, axes = plt.subplots(1, 2, figsize=(18, 7))

    # Plot A: PCA Trajectory
    pca = PCA(n_components=2)
    traj_vectors = np.array([d['vector'] for d in trajectory_data])
    # Fit PCA on Dishes + Trajectory to keep scale
    combined = np.vstack([dish_vectors_np, traj_vectors])
    pca.fit(combined)
    
    dishes_2d = pca.transform(dish_vectors_np)
    traj_2d = pca.transform(traj_vectors)

    axes[0].scatter(dishes_2d[:, 0], dishes_2d[:, 1], c='lightgray', s=50, label='All Dishes')
    axes[0].plot(traj_2d[:, 0], traj_2d[:, 1], c='blue', alpha=0.5, linestyle='--')
    sc = axes[0].scatter(traj_2d[:, 0], traj_2d[:, 1], c=range(len(traj_2d)), cmap='Blues', s=100, edgecolor='k')
    axes[0].set_title('Visual Proof: User Vector Moving to Cluster')
    axes[0].set_xlabel('PCA 1')
    axes[0].set_ylabel('PCA 2')
    
    # Plot B: Metrics Evolution
    steps = [d['step'] for d in trajectory_data]
    sims = [d['similarity_to_final'] for d in trajectory_data]
    ranks = [d['next_item_rank'] for d in trajectory_data]

    ax2 = axes[1]
    ax2.set_title('Quantitative Proof: Convergence & Accuracy')
    ax2.set_xlabel('Number of Interactions (Data Volume)')
    
    # Line 1: Similarity (Should go UP)
    color = 'tab:green'
    ax2.set_ylabel('Similarity to True Preference', color=color)
    ax2.plot(steps, sims, color=color, linewidth=2, label='Stability')
    ax2.tick_params(axis='y', labelcolor=color)
    ax2.set_ylim(0.99, 1.0005) # Zoom in for your dataset since it's high

    # Line 2: Rank (Should go DOWN)
    ax3 = ax2.twinx()
    color = 'tab:red'
    ax3.set_ylabel('Rank of Next Item (Lower is Better)', color=color)
    ax3.plot(steps, ranks, color=color, linewidth=2, linestyle=':', label='Prediction Error')
    ax3.tick_params(axis='y', labelcolor=color)
    ax3.invert_yaxis() # Because Rank 1 is top
    
    plt.tight_layout()
    plt.savefig('proof_of_learning_metrics.png')
    print("\n✅ Comprehensive Proof Saved: proof_of_learning_metrics.png")
    
    # 5. Scientific Conclusion Output
    start_rank = np.mean(ranks[:3])
    end_rank = np.mean(ranks[-3:])
    print("\n--- CONCLUSION FOR PAPER ---")
    print(f"At the beginning (First 3 steps), the Average Rank of the next item was: #{start_rank:.1f}")
    print(f"At the end (Last 3 steps), the Average Rank of the next item was: #{end_rank:.1f}")
    if end_rank < start_rank:
        print("✅ PROVEN: As data volume increases, the model predicts the user's next choice more accurately (Rank decreases).")
    else:
        print("⚠️ NOTE: Rank did not improve. Check if user behavior is erratic.")

if __name__ == "__main__":
    analyze_learning_dynamics()