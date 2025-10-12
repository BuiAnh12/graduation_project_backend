"""
Script to export item embeddings and build retrieval index.

This script generates item embeddings using the trained model and creates
FAISS/Redis indices for fast retrieval.
"""

import os
import sys
import pickle
import numpy as np
import pandas as pd
import torch
from typing import Dict, List, Any
import argparse

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.two_tower import TwoTowerModel
from preprocessing.encoders import FeatureEncoder


class EmbeddingExporter:
    """Export item embeddings and build retrieval indices."""
    
    def __init__(
        self,
        model_path: str,
        encoder_path: str,
        dishes_df: pd.DataFrame,
        output_dir: str
    ):
        """
        Initialize embedding exporter.
        
        Args:
            model_path: Path to trained model checkpoint
            encoder_path: Path to fitted encoder
            dishes_df: DataFrame with dish information
            output_dir: Output directory for embeddings and indices
        """
        self.model_path = model_path
        self.encoder_path = encoder_path
        self.dishes_df = dishes_df
        self.output_dir = output_dir
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Load components
        self.model = None
        self.encoder = None
        self._load_components()
    
    def _load_components(self) -> None:
        """Load model and encoder."""
        print("Loading model and encoder...")
        
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
    
    def export_item_embeddings(self) -> np.ndarray:
        """
        Export embeddings for all items.
        
        Returns:
            Array of item embeddings
        """
        print("Generating item embeddings...")
        
        embeddings = []
        item_metadata = {}
        
        # Process items in batches
        batch_size = 32
        for i in range(0, len(self.dishes_df), batch_size):
            batch_df = self.dishes_df.iloc[i:i+batch_size]
            
            # Prepare batch data
            batch_items = []
            for _, row in batch_df.iterrows():
                item_data = {
                    'dish_id': row['dish_id'],
                    'store_id': row['store_id'],
                    'dish_tags': row['dish_tags'],
                    'dish_taste': row['dish_taste'],
                    'order_times': row['order_times'],
                    'price': row['price'],
                    'system_category': row['system_category'],
                    'location_lat': row['location_lat'],
                    'location_lon': row['location_lon'],
                    'average_rating': row['average_rating']
                }
                batch_items.append(item_data)
            
            # Encode features
            batch_features = []
            for item_data in batch_items:
                item_features = self.encoder.encode_item_features(item_data)
                
                # Convert to tensors
                item_tensors = {k: torch.tensor(v, dtype=torch.long if k in ['dish_id', 'store_id', 'category', 'tags', 'tastes', 'day_of_week'] else torch.float) 
                               for k, v in item_features.items()}
                batch_features.append(item_tensors)
            
            # Get embeddings
            with torch.no_grad():
                batch_embeddings = []
                for item_tensors in batch_features:
                    embedding = self.model.embed_item(item_tensors)
                    batch_embeddings.append(embedding.numpy())
                
                embeddings.extend(batch_embeddings)
            
            # Store metadata
            for item_data in batch_items:
                item_metadata[item_data['dish_id']] = {
                    'store_id': item_data['store_id'],
                    'name': item_data.get('name', ''),
                    'price': item_data['price'],
                    'tags': item_data['dish_tags'],
                    'tastes': item_data['dish_taste'],
                    'category': item_data['system_category']
                }
            
            print(f"Processed {min(i + batch_size, len(self.dishes_df))}/{len(self.dishes_df)} items")
        
        embeddings = np.vstack(embeddings)
        
        # Save embeddings
        embeddings_path = os.path.join(self.output_dir, 'items.npy')
        np.save(embeddings_path, embeddings)
        print(f"✓ Item embeddings saved to {embeddings_path}")
        
        # Save metadata
        metadata_path = os.path.join(self.output_dir, 'item_metadata.pkl')
        with open(metadata_path, 'wb') as f:
            pickle.dump(item_metadata, f)
        print(f"✓ Item metadata saved to {metadata_path}")
        
        return embeddings, item_metadata
    
    def build_faiss_index(self, embeddings: np.ndarray) -> None:
        """
        Build FAISS index for fast similarity search.
        
        Args:
            embeddings: Item embeddings array
        """
        print("Building FAISS index...")
        
        try:
            import faiss
        except ImportError:
            print("FAISS not available, skipping index creation")
            return
        
        # Create FAISS index
        dimension = embeddings.shape[1]
        index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        
        # Normalize embeddings for cosine similarity
        normalized_embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
        
        # Add embeddings to index
        index.add(normalized_embeddings.astype('float32'))
        
        # Save index
        index_path = os.path.join(self.output_dir, 'faiss.index')
        faiss.write_index(index, index_path)
        print(f"✓ FAISS index saved to {index_path}")
    
    def build_redis_index(self, embeddings: np.ndarray, item_metadata: Dict) -> None:
        """
        Build Redis index for fast similarity search.
        
        Args:
            embeddings: Item embeddings array
            item_metadata: Item metadata dictionary
        """
        print("Building Redis index...")
        
        try:
            import redis
        except ImportError:
            print("Redis not available, skipping Redis index creation")
            return
        
        try:
            # Connect to Redis
            redis_client = redis.from_url("redis://localhost:6379")
            redis_client.ping()
            
            # Store embeddings in Redis
            for i, (dish_id, metadata) in enumerate(item_metadata.items()):
                # Store embedding as vector
                embedding_key = f"item_embedding:{dish_id}"
                embedding_bytes = embeddings[i].astype('float32').tobytes()
                redis_client.set(embedding_key, embedding_bytes)
                
                # Store metadata
                metadata_key = f"item_metadata:{dish_id}"
                redis_client.hset(metadata_key, mapping=metadata)
            
            print(f"✓ Redis index created with {len(item_metadata)} items")
            
        except Exception as e:
            print(f"⚠️  Redis index creation failed: {e}")
            print("Continuing without Redis index...")
    
    def export_all(self) -> None:
        """Export all embeddings and build indices."""
        print("Starting embedding export process...")
        
        # Export item embeddings
        embeddings, item_metadata = self.export_item_embeddings()
        
        # Build FAISS index
        self.build_faiss_index(embeddings)
        
        # Build Redis index
        self.build_redis_index(embeddings, item_metadata)
        
        print("✓ Embedding export completed!")
        print(f"  - Embeddings: {embeddings.shape}")
        print(f"  - Items: {len(item_metadata)}")
        print(f"  - Output directory: {self.output_dir}")


def main():
    """Main function for embedding export."""
    parser = argparse.ArgumentParser(description='Export item embeddings and build retrieval indices')
    parser.add_argument('--model-path', default='runs/best_model.pth', 
                       help='Path to trained model checkpoint')
    parser.add_argument('--encoder-path', default='encoders.pkl', 
                       help='Path to fitted encoder')
    parser.add_argument('--dishes-path', default='data/clean/dishes.parquet', 
                       help='Path to dishes parquet file')
    parser.add_argument('--output-dir', default='data/embeddings', 
                       help='Output directory for embeddings and indices')
    
    args = parser.parse_args()
    
    # Load dishes data
    print(f"Loading dishes from {args.dishes_path}")
    dishes_df = pd.read_parquet(args.dishes_path)
    print(f"Loaded {len(dishes_df)} dishes")
    
    # Create exporter
    exporter = EmbeddingExporter(
        model_path=args.model_path,
        encoder_path=args.encoder_path,
        dishes_df=dishes_df,
        output_dir=args.output_dir
    )
    
    # Export all
    exporter.export_all()


if __name__ == "__main__":
    main()
