"""
Evaluation metrics for the recommendation system.

This module implements Precision@K, Recall@K, and NDCG@K metrics
for offline evaluation of the recommendation model.
"""

import torch
import numpy as np
from typing import List, Dict, Tuple, Optional
from sklearn.metrics import precision_score, recall_score
import pandas as pd


def precision_at_k(y_true: np.ndarray, y_pred: np.ndarray, k: int) -> float:
    """
    Calculate Precision@K.
    
    Args:
        y_true: True binary labels
        y_pred: Predicted scores
        k: Number of top items to consider
        
    Returns:
        Precision@K score
    """
    if len(y_true) == 0:
        return 0.0
    
    # Get top-k predictions
    top_k_indices = np.argsort(y_pred)[-k:]
    top_k_labels = y_true[top_k_indices]
    
    # Calculate precision
    if k == 0:
        return 0.0
    
    return np.sum(top_k_labels) / k


def recall_at_k(y_true: np.ndarray, y_pred: np.ndarray, k: int) -> float:
    """
    Calculate Recall@K.
    
    Args:
        y_true: True binary labels
        y_pred: Predicted scores
        k: Number of top items to consider
        
    Returns:
        Recall@K score
    """
    if len(y_true) == 0:
        return 0.0
    
    # Get top-k predictions
    top_k_indices = np.argsort(y_pred)[-k:]
    top_k_labels = y_true[top_k_indices]
    
    # Calculate recall
    total_positive = np.sum(y_true)
    if total_positive == 0:
        return 0.0
    
    return np.sum(top_k_labels) / total_positive


def ndcg_at_k(y_true: np.ndarray, y_pred: np.ndarray, k: int) -> float:
    """
    Calculate NDCG@K.
    
    Args:
        y_true: True binary labels
        y_pred: Predicted scores
        k: Number of top items to consider
        
    Returns:
        NDCG@K score
    """
    if len(y_true) == 0:
        return 0.0
    
    # Get top-k predictions
    top_k_indices = np.argsort(y_pred)[-k:]
    top_k_labels = y_true[top_k_indices]
    
    # Calculate DCG
    dcg = 0.0
    for i, label in enumerate(top_k_labels):
        dcg += label / np.log2(i + 2)  # i+2 because log2(1) = 0
    
    # Calculate IDCG (ideal DCG)
    ideal_labels = np.sort(y_true)[-k:][::-1]  # Sort in descending order
    idcg = 0.0
    for i, label in enumerate(ideal_labels):
        idcg += label / np.log2(i + 2)
    
    # Calculate NDCG
    if idcg == 0:
        return 0.0
    
    return dcg / idcg


def evaluate_user(
    user_id: str,
    user_embeddings: np.ndarray,
    item_embeddings: np.ndarray,
    item_ids: List[str],
    true_items: List[str],
    k_values: List[int] = [5, 10, 20]
) -> Dict[str, float]:
    """
    Evaluate recommendations for a single user.
    
    Args:
        user_id: User ID
        user_embeddings: User embedding vector
        item_embeddings: Item embedding matrix
        item_ids: List of item IDs corresponding to embeddings
        true_items: List of true positive item IDs
        k_values: List of K values to evaluate
        
    Returns:
        Dictionary of metrics for the user
    """
    # Calculate similarities
    similarities = np.dot(user_embeddings, item_embeddings.T)
    
    # Create binary labels
    y_true = np.array([1 if item_id in true_items else 0 for item_id in item_ids])
    
    # Calculate metrics for each K
    metrics = {}
    for k in k_values:
        metrics[f'precision@{k}'] = precision_at_k(y_true, similarities, k)
        metrics[f'recall@{k}'] = recall_at_k(y_true, similarities, k)
        metrics[f'ndcg@{k}'] = ndcg_at_k(y_true, similarities, k)
    
    return metrics


def evaluate_model(
    model: torch.nn.Module,
    test_loader: torch.utils.data.DataLoader,
    device: str = 'cpu',
    k_values: List[int] = [5, 10, 20]
) -> Dict[str, float]:
    """
    Evaluate the model on test data.
    
    Args:
        model: Trained model
        test_loader: Test data loader
        device: Device to run evaluation on
        k_values: List of K values to evaluate
        
    Returns:
        Dictionary of average metrics
    """
    model.eval()
    
    all_metrics = []
    
    with torch.no_grad():
        for user_features, item_features, labels in test_loader:
            # Move to device
            user_features = {k: v.to(device) for k, v in user_features.items()}
            item_features = {k: v.to(device) for k, v in item_features.items()}
            labels = labels.to(device)
            
            # Get embeddings
            user_emb = model.embed_user(user_features)
            item_emb = model.embed_item(item_features)
            
            # Calculate similarities
            similarities = torch.sum(user_emb * item_emb, dim=-1)
            
            # Convert to numpy
            y_true = labels.cpu().numpy()
            y_pred = similarities.cpu().numpy()
            
            # Calculate metrics for this batch
            batch_metrics = {}
            for k in k_values:
                batch_metrics[f'precision@{k}'] = precision_at_k(y_true, y_pred, k)
                batch_metrics[f'recall@{k}'] = recall_at_k(y_true, y_pred, k)
                batch_metrics[f'ndcg@{k}'] = ndcg_at_k(y_true, y_pred, k)
            
            all_metrics.append(batch_metrics)
    
    # Average metrics across all batches
    avg_metrics = {}
    for k in k_values:
        avg_metrics[f'precision@{k}'] = np.mean([m[f'precision@{k}'] for m in all_metrics])
        avg_metrics[f'recall@{k}'] = np.mean([m[f'recall@{k}'] for m in all_metrics])
        avg_metrics[f'ndcg@{k}'] = np.mean([m[f'ndcg@{k}'] for m in all_metrics])
    
    return avg_metrics


def evaluate_retrieval(
    model: torch.nn.Module,
    user_features: Dict[str, torch.Tensor],
    item_embeddings: torch.Tensor,
    item_ids: List[str],
    true_items: List[str],
    k_values: List[int] = [5, 10, 20]
) -> Dict[str, float]:
    """
    Evaluate retrieval performance for a single user.
    
    Args:
        model: Trained model
        user_features: User feature dictionary
        item_embeddings: Precomputed item embeddings
        item_ids: List of item IDs
        true_items: List of true positive item IDs
        k_values: List of K values to evaluate
        
    Returns:
        Dictionary of metrics
    """
    model.eval()
    
    with torch.no_grad():
        # Get user embedding
        user_emb = model.embed_user(user_features)
        
        # Calculate similarities
        similarities = torch.sum(user_emb * item_embeddings, dim=-1)
        
        # Convert to numpy
        similarities = similarities.cpu().numpy()
        
        # Create binary labels
        y_true = np.array([1 if item_id in true_items else 0 for item_id in item_ids])
        
        # Calculate metrics
        metrics = {}
        for k in k_values:
            metrics[f'precision@{k}'] = precision_at_k(y_true, similarities, k)
            metrics[f'recall@{k}'] = recall_at_k(y_true, similarities, k)
            metrics[f'ndcg@{k}'] = ndcg_at_k(y_true, similarities, k)
    
    return metrics


def evaluate_allergy_violations(
    recommendations: List[str],
    user_allergies: List[str],
    item_tags: Dict[str, List[str]]
) -> Dict[str, int]:
    """
    Evaluate allergy violations in recommendations.
    
    Args:
        recommendations: List of recommended item IDs
        user_allergies: List of user's allergies
        item_tags: Dictionary mapping item IDs to their tags
        
    Returns:
        Dictionary with violation counts
    """
    violations = 0
    total_recommendations = len(recommendations)
    
    for item_id in recommendations:
        if item_id in item_tags:
            item_tag_list = item_tags[item_id]
            if any(allergy in item_tag_list for allergy in user_allergies):
                violations += 1
    
    return {
        'total_violations': violations,
        'total_recommendations': total_recommendations,
        'violation_rate': violations / total_recommendations if total_recommendations > 0 else 0
    }


def evaluate_dislike_violations(
    recommendations: List[str],
    user_dislikes: List[str],
    item_tastes: Dict[str, List[str]]
) -> Dict[str, int]:
    """
    Evaluate dislike violations in recommendations.
    
    Args:
        recommendations: List of recommended item IDs
        user_dislikes: List of user's disliked tastes
        item_tastes: Dictionary mapping item IDs to their tastes
        
    Returns:
        Dictionary with violation counts
    """
    violations = 0
    total_recommendations = len(recommendations)
    
    for item_id in recommendations:
        if item_id in item_tastes:
            item_taste_list = item_tastes[item_id]
            if any(dislike in item_taste_list for dislike in user_dislikes):
                violations += 1
    
    return {
        'total_violations': violations,
        'total_recommendations': total_recommendations,
        'violation_rate': violations / total_recommendations if total_recommendations > 0 else 0
    }


def create_evaluation_report(
    metrics: Dict[str, float],
    allergy_violations: Dict[str, int],
    dislike_violations: Dict[str, int]
) -> str:
    """
    Create a comprehensive evaluation report.
    
    Args:
        metrics: Model performance metrics
        allergy_violations: Allergy violation statistics
        dislike_violations: Dislike violation statistics
        
    Returns:
        Formatted evaluation report
    """
    report = "=== RECOMMENDATION SYSTEM EVALUATION REPORT ===\n\n"
    
    # Performance metrics
    report += "PERFORMANCE METRICS:\n"
    for metric, value in metrics.items():
        report += f"  {metric}: {value:.4f}\n"
    
    report += "\n"
    
    # Safety metrics
    report += "SAFETY METRICS:\n"
    report += f"  Allergy violations: {allergy_violations['total_violations']}/{allergy_violations['total_recommendations']} ({allergy_violations['violation_rate']:.2%})\n"
    report += f"  Dislike violations: {dislike_violations['total_violations']}/{dislike_violations['total_recommendations']} ({dislike_violations['violation_rate']:.2%})\n"
    
    report += "\n"
    
    # Recommendations
    report += "RECOMMENDATIONS:\n"
    if allergy_violations['violation_rate'] > 0.05:  # 5% threshold
        report += "  ⚠️  High allergy violation rate detected. Consider improving post-filtering.\n"
    
    if dislike_violations['violation_rate'] > 0.1:  # 10% threshold
        report += "  ⚠️  High dislike violation rate detected. Consider improving post-filtering.\n"
    
    if metrics.get('precision@10', 0) < 0.1:
        report += "  ⚠️  Low precision detected. Consider retraining with more data or different hyperparameters.\n"
    
    if metrics.get('recall@10', 0) < 0.1:
        report += "  ⚠️  Low recall detected. Consider adjusting recommendation strategy.\n"
    
    return report
