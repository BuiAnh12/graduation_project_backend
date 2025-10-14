"""
Data export script for extracting data from MongoDB.

This script exports user interactions, user profiles, and dish information
from the MongoDB database for training the recommendation system.
"""

import os
import sys
import pandas as pd
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
import argparse

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from pymongo import MongoClient
    import motor.motor_asyncio
except ImportError:
    print("Please install pymongo and motor: pip install pymongo motor")
    sys.exit(1)


class DataExporter:
    """Export data from MongoDB for recommendation system training."""
    
    def __init__(self, mongodb_uri: str):
        """
        Initialize data exporter.
        
        Args:
            mongodb_uri: MongoDB connection URI
        """
        self.client = MongoClient(mongodb_uri)
        self.db = self.client.get_default_database()
    
    def export_interactions(self) -> pd.DataFrame:
        """
        Export user-item interactions from orders, completed carts, and ratings.
        
        Returns:
            DataFrame with interaction data
        """
        interactions = []
        
        # Export from orders (only completed orders)
        orders = self.db.orders.find({
            'status': 'done',  # Only completed orders
            'deleted': {'$ne': True}  # Exclude deleted orders
        }, {
            'userId': 1,
            'storeId': 1,
            'createdAt': 1,
            'status': 1
        })
        
        for order in orders:
            # Get order items for this order
            order_items = self.db.order_items.find({
                'orderId': order['_id']
            }, {
                'dishId': 1,
                'quantity': 1,
                'createdAt': 1
            })
            
            for item in order_items:
                interactions.append({
                    'user_id': str(order['userId']),
                    'dish_id': str(item['dishId']),
                    'store_id': str(order['storeId']),
                    'timestamp': order['createdAt'],
                    'event_type': 'order',
                    'rating': None,
                    'quantity': item.get('quantity', 1)
                })
        
        # Export from completed carts (carts with completed=True)
        completed_carts = self.db.carts.find({
            'completed': True,
            'status': 'active'
        }, {
            'userId': 1,
            'storeId': 1,
            'createdAt': 1
        })
        
        for cart in completed_carts:
            # Get cart items for this cart
            cart_items = self.db.cart_items.find({
                'cartId': cart['_id']
            }, {
                'dishId': 1,
                'quantity': 1,
                'createdAt': 1
            })
            
            for item in cart_items:
                interactions.append({
                    'user_id': str(cart['userId']),
                    'dish_id': str(item['dishId']),
                    'store_id': str(cart['storeId']),
                    'timestamp': cart['createdAt'],
                    'event_type': 'cart_completed',
                    'rating': None,
                    'quantity': item.get('quantity', 1)
                })
        
        # Export from ratings
        ratings = self.db.ratings.find({}, {
            'userId': 1,
            'storeId': 1,
            'ratingValue': 1,
            'createdAt': 1
        })
        
        for rating in ratings:
            # Get the dish from the order to find dish_id
            order = self.db.orders.find_one(
                {'_id': rating['orderId']},
                {'_id': 1}
            )
            if order:
                # Get order items to find dish_id
                order_items = self.db.order_items.find({
                    'orderId': order['_id']
                }, {'dishId': 1})
                
                for item in order_items:
                    interactions.append({
                        'user_id': str(rating['userId']),
                        'dish_id': str(item['dishId']),
                        'store_id': str(rating['storeId']),
                        'timestamp': rating['createdAt'],
                        'event_type': 'rating',
                        'rating': rating.get('ratingValue'),
                        'quantity': 1
                    })
        
        # Convert to DataFrame
        df = pd.DataFrame(interactions)
        
        # Remove duplicates and invalid entries
        df = df.dropna(subset=['user_id', 'dish_id', 'store_id'])
        df = df.drop_duplicates()
        
        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        return df
    
    def export_users(self) -> pd.DataFrame:
        """
        Export user profiles with user references.
        
        Returns:
            DataFrame with user data
        """
        users = []
        
        # Get users with their user_references
        user_docs = self.db.users.find({}, {
            '_id': 1,
            'name': 1,
            'email': 1,
            'gender': 1,
            'user_reference_id': 1,
            'createdAt': 1
        })
        
        for user in user_docs:
            user_ref_id = user.get('user_reference_id')
            user_ref = None
            
            # Get user reference data if exists
            if user_ref_id:
                user_ref = self.db.user_references.find_one({'_id': user_ref_id})
            
            # Extract user reference data
            allergy = []
            dislike_taste = []
            dislike_food = []
            dislike_cooking_method = []
            dislike_culture = []
            like_taste = []
            like_food = []
            like_cooking_method = []
            like_culture = []
            
            if user_ref:
                allergy = user_ref.get('allergy', [])
                dislike_taste = user_ref.get('dislike_taste', [])
                dislike_food = user_ref.get('dislike_food', [])
                dislike_cooking_method = user_ref.get('dislike_cooking_method', [])
                dislike_culture = user_ref.get('dislike_culture', [])
                like_taste = user_ref.get('like_taste', [])
                like_food = user_ref.get('like_food', [])
                like_cooking_method = user_ref.get('like_cooking_method', [])
                like_culture = user_ref.get('like_culture', [])
            
            # Get user's recent order history for recent_history_dishes
            recent_orders = self.db.orders.find({
                'userId': user['_id'],
                'status': 'done',
                'deleted': {'$ne': True}
            }).sort('createdAt', -1).limit(20)
            
            recent_dishes = []
            for order in recent_orders:
                order_items = self.db.order_items.find({
                    'orderId': order['_id']
                }, {'dishId': 1})
                for item in order_items:
                    recent_dishes.append(str(item['dishId']))
            
            users.append({
                'user_id': str(user['_id']),
                'name': user.get('name', ''),
                'email': user.get('email', ''),
                'gender': user.get('gender', 'unknown'),
                'allergy': json.dumps(allergy) if allergy else json.dumps([]),
                'dislike_taste': json.dumps(dislike_taste) if dislike_taste else json.dumps([]),
                'dislike_food': json.dumps(dislike_food) if dislike_food else json.dumps([]),
                'dislike_cooking_method': json.dumps(dislike_cooking_method) if dislike_cooking_method else json.dumps([]),
                'dislike_culture': json.dumps(dislike_culture) if dislike_culture else json.dumps([]),
                'like_taste': json.dumps(like_taste) if like_taste else json.dumps([]),
                'like_food': json.dumps(like_food) if like_food else json.dumps([]),
                'like_cooking_method': json.dumps(like_cooking_method) if like_cooking_method else json.dumps([]),
                'like_culture': json.dumps(like_culture) if like_culture else json.dumps([]),
                'recent_history_dishes': json.dumps(recent_dishes) if recent_dishes else json.dumps([]),
                'created_at': user.get('createdAt')
            })
        
        return pd.DataFrame(users)
    
    def export_dishes(self) -> pd.DataFrame:
        """
        Export dish information with proper tags and categories.
        
        Returns:
            DataFrame with dish data
        """
        dishes = []
        
        # Get dishes from dishes collection
        dish_docs = self.db.dishes.find({}, {
            '_id': 1,
            'name': 1,
            'storeId': 1,
            'dishTags': 1,
            'tasteTags': 1,
            'cookingMethodtags': 1,
            'cultureTags': 1,
            'price': 1,
            'category': 1,
            'description': 1,
            'stockStatus': 1,
            'createdAt': 1
        })
        
        for dish in dish_docs:
            # Get store location
            store = self.db.stores.find_one(
                {'_id': dish['storeId']},
                {'location': 1}
            )
            
            # Extract store location
            lat = 0.0
            lon = 0.0
            if store and store.get('location'):
                location = store['location']
                if location.get('type') == 'Point' and location.get('coordinates'):
                    # GeoJSON Point format: [longitude, latitude]
                    lon, lat = location['coordinates']
            
            # Get category name
            category_name = 'unknown'
            if dish.get('category'):
                category = self.db.categories.find_one(
                    {'_id': dish['category']},
                    {'name': 1}
                )
                if category:
                    category_name = category.get('name', 'unknown')
            
            # Calculate order times (popularity) from order_items
            order_times = self.db.order_items.count_documents({
                'dishId': dish['_id']
            })
            
            # Calculate average rating from ratings
            ratings = self.db.ratings.find({
                'storeId': dish['storeId']
            }, {'ratingValue': 1})
            
            rating_values = [r.get('ratingValue', 0) for r in ratings if r.get('ratingValue')]
            avg_rating = sum(rating_values) / len(rating_values) if rating_values else 3.0
            
            dishes.append({
                'dish_id': str(dish['_id']),
                'store_id': str(dish['storeId']),
                'name': dish.get('name', ''),
                'dish_tags': json.dumps(dish.get('dishTags', [])),
                'taste_tags': json.dumps(dish.get('tasteTags', [])),
                'cooking_method_tags': json.dumps(dish.get('cookingMethodtags', [])),
                'culture_tags': json.dumps(dish.get('cultureTags', [])),
                'price': float(dish.get('price', 0.0)),
                'category': category_name,
                'description': dish.get('description', ''),
                'stock_status': dish.get('stockStatus', 'available'),
                'order_times': order_times,
                'average_rating': avg_rating,
                'location_lat': lat,
                'location_lon': lon,
                'created_at': dish.get('createdAt')
            })
        
        return pd.DataFrame(dishes)
    
    def export_stores(self) -> pd.DataFrame:
        """
        Export store information with proper location handling.
        
        Returns:
            DataFrame with store data
        """
        stores = []
        
        # Get stores from stores collection
        store_docs = self.db.stores.find({}, {
            '_id': 1,
            'name': 1,
            'description': 1,
            'location': 1,
            'address_full': 1,
            'systemCategoryId': 1,
            'status': 1,
            'openStatus': 1,
            'openHour': 1,
            'closeHour': 1,
            'createdAt': 1
        })
        
        for store in store_docs:
            # Extract location from GeoJSON
            lat = 0.0
            lon = 0.0
            if store.get('location'):
                location = store['location']
                if location.get('type') == 'Point' and location.get('coordinates'):
                    # GeoJSON Point format: [longitude, latitude]
                    lon, lat = location['coordinates']
            
            # Get system category names
            system_categories = []
            if store.get('systemCategoryId'):
                for cat_id in store['systemCategoryId']:
                    category = self.db.system_categories.find_one(
                        {'_id': cat_id},
                        {'name': 1}
                    )
                    if category:
                        system_categories.append(category.get('name', ''))
            
            stores.append({
                'store_id': str(store['_id']),
                'name': store.get('name', ''),
                'description': store.get('description', ''),
                'location_lat': lat,
                'location_lon': lon,
                'address_full': store.get('address_full', ''),
                'system_categories': json.dumps(system_categories) if system_categories else json.dumps([]),
                'status': store.get('status', 'approve'),
                'open_status': store.get('openStatus', 'open'),
                'open_hour': store.get('openHour', '08:00'),
                'close_hour': store.get('closeHour', '18:00'),
                'created_at': store.get('createdAt')
            })
        
        return pd.DataFrame(stores)
    
    def export_all(self, output_dir: str) -> None:
        """
        Export all data to CSV files.
        
        Args:
            output_dir: Directory to save exported data
        """
        os.makedirs(output_dir, exist_ok=True)
        
        print("Exporting interactions...")
        interactions_df = self.export_interactions()
        interactions_df.to_csv(os.path.join(output_dir, 'interactions.csv'), index=False)
        print(f"Exported {len(interactions_df)} interactions")
        
        print("Exporting users...")
        users_df = self.export_users()
        users_df.to_csv(os.path.join(output_dir, 'users.csv'), index=False)
        print(f"Exported {len(users_df)} users")
        
        print("Exporting dishes...")
        dishes_df = self.export_dishes()
        dishes_df.to_csv(os.path.join(output_dir, 'dishes.csv'), index=False)
        print(f"Exported {len(dishes_df)} dishes")
        
        print("Exporting stores...")
        stores_df = self.export_stores()
        stores_df.to_csv(os.path.join(output_dir, 'stores.csv'), index=False)
        print(f"Exported {len(stores_df)} stores")
        
        # Create tags.csv from all tag collections
        print("Creating tags.csv...")
        all_tags = []
        
        # Get food tags
        food_tags = self.db.food_tags.find({}, {'_id': 1, 'name': 1, 'tag_category_id': 1})
        for tag in food_tags:
            all_tags.append({
                'tag_id': str(tag['_id']),
                'tag_name': tag.get('name', ''),
                'tag_type': 'food',
                'tag_category_id': str(tag.get('tag_category_id', ''))
            })
        
        # Get taste tags
        taste_tags = self.db.taste_tags.find({}, {'_id': 1, 'name': 1, 'tag_category_id': 1})
        for tag in taste_tags:
            all_tags.append({
                'tag_id': str(tag['_id']),
                'tag_name': tag.get('name', ''),
                'tag_type': 'taste',
                'tag_category_id': str(tag.get('tag_category_id', ''))
            })
        
        # Get cooking method tags
        cooking_method_tags = self.db.cooking_method_tags.find({}, {'_id': 1, 'name': 1, 'tag_category_id': 1})
        for tag in cooking_method_tags:
            all_tags.append({
                'tag_id': str(tag['_id']),
                'tag_name': tag.get('name', ''),
                'tag_type': 'cooking_method',
                'tag_category_id': str(tag.get('tag_category_id', ''))
            })
        
        # Get culture tags
        culture_tags = self.db.culture_tags.find({}, {'_id': 1, 'name': 1, 'tag_category_id': 1})
        for tag in culture_tags:
            all_tags.append({
                'tag_id': str(tag['_id']),
                'tag_name': tag.get('name', ''),
                'tag_type': 'culture',
                'tag_category_id': str(tag.get('tag_category_id', ''))
            })
        
        tags_df = pd.DataFrame(all_tags)
        tags_df.to_csv(os.path.join(output_dir, 'tags.csv'), index=False)
        print(f"Exported {len(tags_df)} unique tags")
        
        print(f"\nData export completed! Files saved to {output_dir}")
        
        # Print summary statistics
        print("\n=== EXPORT SUMMARY ===")
        print(f"Interactions: {len(interactions_df)}")
        print(f"Users: {len(users_df)}")
        print(f"Dishes: {len(dishes_df)}")
        print(f"Stores: {len(stores_df)}")
        print(f"Tags: {len(tags_df)}")
        
        if len(interactions_df) > 0:
            print(f"Date range: {interactions_df['timestamp'].min()} to {interactions_df['timestamp'].max()}")
            print(f"Event types: {interactions_df['event_type'].value_counts().to_dict()}")


def main():
    """Main function for data export."""
    parser = argparse.ArgumentParser(description='Export data from MongoDB for recommendation system')
    parser.add_argument('--mongodb-uri', default='mongodb://localhost:27017/food_ordering', 
                       help='MongoDB connection URI')
    parser.add_argument('--output', default='data', 
                       help='Output directory for exported data')
    
    args = parser.parse_args()
    
    # Create data exporter
    exporter = DataExporter(args.mongodb_uri)
    
    # Export all data
    exporter.export_all(args.output)


if __name__ == "__main__":
    main()
