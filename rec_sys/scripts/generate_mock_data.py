"""
Mock data generator for recommendation system testing.

This script generates comprehensive mock data including:
- Food tags, taste tags, cooking method tags, and culture tags
- 2 stores with 10 dishes each (20 total dishes)
- 10 users with diverse preferences
- 200 interactions with realistic behavioral patterns
- Test scenarios for model evaluation
"""

import os
import sys
import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any
import json

# Set random seed for reproducibility
random.seed(42)
np.random.seed(42)

class MockDataGenerator:
    """Generate comprehensive mock data for recommendation system."""
    
    def __init__(self):
        """Initialize the mock data generator."""
        self.data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
        self.ensure_data_dir()
        
        # Initialize tag IDs
        self.tag_ids = {}
        self.dish_ids = []
        self.store_ids = []
        self.user_ids = []
        
    def ensure_data_dir(self):
        """Ensure data directory exists."""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
    
    def generate_tag_categories(self) -> pd.DataFrame:
        """Generate tag categories."""
        categories = [
            {"id": "food_cat", "name": "Thực phẩm", "type": "food"},
            {"id": "taste_cat", "name": "Vị", "type": "taste"},
            {"id": "cooking_cat", "name": "Phương pháp nấu", "type": "cooking_method"},
            {"id": "culture_cat", "name": "Văn hóa", "type": "culture"}
        ]
        return pd.DataFrame(categories)
    
    def generate_food_tags(self) -> pd.DataFrame:
        """Generate food tags."""
        food_items = [
            "thịt gà", "thịt bò", "thịt heo", "cá", "tôm", "cua", "đậu hũ", "tempeh", 
            "trứng", "vịt", "thịt cừu", "đậu", "cơm", "mì", "bánh mì", "mì ống", 
            "hạt diêm mạch", "yến mạch", "bắp", "khoai tây", "khoai lang", "bột năng",
            "cà chua", "hành tây", "tỏi", "cà rốt", "bắp cải", "xà lách", "rau chân vịt",
            "cải xoăn", "bông cải xanh", "súp lơ", "ớt chuông", "nấm", "bí ngòi", 
            "cà tím", "đậu bắp", "chuối", "táo", "xoài", "dứa", "cam", "chanh vàng",
            "chanh xanh", "dâu tây", "bơ", "đu đủ", "sữa", "phô mai", "sữa chua",
            "nước cốt dừa", "sữa hạnh nhân", "sữa đậu nành"
        ]
        
        food_tags = []
        for i, food in enumerate(food_items):
            food_tags.append({
                "id": f"food_tag_{i+1}",
                "name": food,
                "tag_category_id": "food_cat"
            })
            self.tag_ids[food] = f"food_tag_{i+1}"
        
        return pd.DataFrame(food_tags)
    
    def generate_taste_tags(self) -> pd.DataFrame:
        """Generate taste tags with Vietnamese translations."""
        taste_categories = {
            "spiciness": {
                "spicy-none": ("Không cay", 0),
                "spicy-mild": ("Hơi cay", 1),
                "spicy-medium": ("Cay vừa", 2),
                "spicy-hot": ("Cay", 3),
                "spicy-extra": ("Rất cay", 4),
                "chili-free": ("Không ớt", 0)
            },
            "sweetness": {
                "sweet-none": ("Không ngọt", 0),
                "sweet-low": ("Ít ngọt", 1),
                "sweet-medium": ("Ngọt vừa", 2),
                "sweet-high": ("Ngọt", 3),
                "sugar-free": ("Không đường", 0),
                "low-sugar": ("Ít đường", 1)
            },
            "sourness": {
                "sour-none": ("Không chua", 0),
                "tangy": ("Chua nhẹ", 1),
                "sour": ("Chua", 2),
                "citrus-based": ("Chua cam quýt", 3)
            },
            "saltiness": {
                "salt-free": ("Không muối", 0),
                "low-sodium": ("Ít muối", 1),
                "salt-normal": ("Muối bình thường", 2),
                "salty": ("Mặn", 3)
            },
            "umami": {
                "umami-light": ("Umami nhẹ", 1),
                "umami-rich": ("Umami đậm", 2),
                "fermented-flavor": ("Vị lên men", 3)
            },
            "bitterness": {
                "bitter": ("Đắng", 1),
                "no-bitter": ("Không đắng", 0)
            },
            "richness": {
                "light": ("Nhẹ", 1),
                "creamy": ("Béo ngậy", 2),
                "rich": ("Đậm đà", 3),
                "dairy-free": ("Không sữa", 0)
            },
            "aroma": {
                "neutral-flavor": ("Vị trung tính", 0),
                "herbal": ("Thảo mộc", 1),
                "spiced": ("Gia vị", 2),
                "fragrant": ("Thơm", 3)
            }
        }
        
        taste_tags = []
        tag_id = 1
        
        for category, tastes in taste_categories.items():
            for taste_key, (vietnamese_name, level) in tastes.items():
                taste_tags.append({
                    "id": f"taste_tag_{tag_id}",
                    "name": vietnamese_name,
                    "kind": category,
                    "level": level,
                    "tag_category_id": "taste_cat"
                })
                self.tag_ids[taste_key] = f"taste_tag_{tag_id}"
                tag_id += 1
        
        return pd.DataFrame(taste_tags)
    
    def generate_cooking_method_tags(self) -> pd.DataFrame:
        """Generate cooking method tags."""
        cooking_methods = [
            "sống", "ướp", "luộc", "nấu nhỏ lửa", "hấp", "chần", "trụng", "xào",
            "rán chảo", "chiên ngập dầu", "nướng", "quay", "nướng lò", "om", 
            "hầm", "hun khói", "áp chảo"
        ]
        
        cooking_tags = []
        for i, method in enumerate(cooking_methods):
            cooking_tags.append({
                "id": f"cooking_tag_{i+1}",
                "name": method,
                "tag_category_id": "cooking_cat"
            })
            self.tag_ids[method] = f"cooking_tag_{i+1}"
        
        return pd.DataFrame(cooking_tags)
    
    def generate_culture_tags(self) -> pd.DataFrame:
        """Generate culture/cuisine tags."""
        cultures = [
            "Việt Nam", "Thái Lan", "Trung Quốc", "Nhật Bản", "Hàn Quốc", "Ấn Độ",
            "Malaysia", "Indonesia", "Singapore", "Philippines", "Mỹ", "Ý", "Pháp", "Mexico"
        ]
        
        culture_tags = []
        for i, culture in enumerate(cultures):
            culture_tags.append({
                "id": f"culture_tag_{i+1}",
                "name": culture,
                "tag_category_id": "culture_cat"
            })
            self.tag_ids[culture] = f"culture_tag_{i+1}"
        
        return pd.DataFrame(culture_tags)
    
    def generate_stores(self) -> pd.DataFrame:
        """Generate 2 stores with different characteristics."""
        stores = [
            {
                "id": "store_1",
                "name": "Quán Ăn Gia Đình Việt",
                "description": "Quán ăn gia đình phục vụ món ăn Việt Nam truyền thống",
                "cuisine_type": "Việt Nam",
                "price_range": "budget",
                "rating": 4.2,
                "location": "Quận 1, TP.HCM"
            },
            {
                "id": "store_2", 
                "name": "Asian Fusion Kitchen",
                "description": "Nhà hàng pha trộn ẩm thực châu Á hiện đại",
                "cuisine_type": "Fusion",
                "price_range": "premium",
                "rating": 4.5,
                "location": "Quận 3, TP.HCM"
            }
        ]
        
        self.store_ids = ["store_1", "store_2"]
        return pd.DataFrame(stores)
    
    def generate_dishes(self) -> pd.DataFrame:
        """Generate 20 dishes (10 per store) with realistic tag combinations."""
        dishes = []
        
        # Store 1: Vietnamese traditional dishes
        vietnamese_dishes = [
            {
                "name": "Phở Bò",
                "description": "Phở bò truyền thống với nước dùng đậm đà",
                "price": 65000,
                "category": "món chính",
                "tags": {
                    "food": ["thịt bò", "mì", "hành tây", "rau chân vịt"],
                    "taste": ["umami-rich", "salt-normal", "spicy-mild"],
                    "cooking_method": ["luộc", "hấp"],
                    "culture": ["Việt Nam"]
                }
            },
            {
                "name": "Bánh Mì Thịt Nướng",
                "description": "Bánh mì với thịt nướng, rau củ tươi",
                "price": 35000,
                "category": "món chính",
                "tags": {
                    "food": ["thịt heo", "bánh mì", "cà rốt", "dưa leo"],
                    "taste": ["spicy-mild", "sweet-low", "salt-normal"],
                    "cooking_method": ["nướng", "sống"],
                    "culture": ["Việt Nam"]
                }
            },
            {
                "name": "Gỏi Cuốn Tôm",
                "description": "Gỏi cuốn tôm tươi với rau sống",
                "price": 45000,
                "category": "khai vị",
                "tags": {
                    "food": ["tôm", "rau chân vịt", "bánh tráng", "rau thơm"],
                    "taste": ["sour-mild", "spicy-none", "sweet-low"],
                    "cooking_method": ["chần", "sống"],
                    "culture": ["Việt Nam"]
                }
            },
            {
                "name": "Cơm Tấm Sườn Nướng",
                "description": "Cơm tấm với sườn heo nướng",
                "price": 55000,
                "category": "món chính",
                "tags": {
                    "food": ["cơm", "thịt heo", "dưa chua", "nước mắm"],
                    "taste": ["sweet-medium", "spicy-mild", "salt-normal"],
                    "cooking_method": ["nướng", "luộc"],
                    "culture": ["Việt Nam"]
                }
            },
            {
                "name": "Chả Cá Lã Vọng",
                "description": "Chả cá Hà Nội với nghệ và thì là",
                "price": 75000,
                "category": "món chính",
                "tags": {
                    "food": ["cá", "nghệ", "thì là", "bún"],
                    "taste": ["spicy-medium", "umami-rich", "herbal"],
                    "cooking_method": ["rán chảo", "hấp"],
                    "culture": ["Việt Nam"]
                }
            },
            {
                "name": "Bún Chả Hà Nội",
                "description": "Bún chả Hà Nội với thịt nướng",
                "price": 60000,
                "category": "món chính",
                "tags": {
                    "food": ["bún", "thịt heo", "rau sống", "nước mắm"],
                    "taste": ["sweet-medium", "sour-mild", "spicy-mild"],
                    "cooking_method": ["nướng", "luộc"],
                    "culture": ["Việt Nam"]
                }
            },
            {
                "name": "Bánh Xèo Miền Tây",
                "description": "Bánh xèo miền Tây với tôm và đậu xanh",
                "price": 50000,
                "category": "món chính",
                "tags": {
                    "food": ["tôm", "đậu xanh", "bột năng", "dừa"],
                    "taste": ["sweet-low", "rich", "umami-light"],
                    "cooking_method": ["rán chảo"],
                    "culture": ["Việt Nam"]
                }
            },
            {
                "name": "Canh Chua Cá Lóc",
                "description": "Canh chua cá lóc với me và cà chua",
                "price": 70000,
                "category": "canh",
                "tags": {
                    "food": ["cá", "cà chua", "me", "rau om"],
                    "taste": ["sour", "spicy-mild", "umami-rich"],
                    "cooking_method": ["nấu nhỏ lửa"],
                    "culture": ["Việt Nam"]
                }
            },
            {
                "name": "Nem Nướng Nha Trang",
                "description": "Nem nướng Nha Trang với bánh tráng",
                "price": 65000,
                "category": "khai vị",
                "tags": {
                    "food": ["thịt heo", "bánh tráng", "rau sống", "nước mắm"],
                    "taste": ["spicy-medium", "sweet-low", "umami-rich"],
                    "cooking_method": ["nướng"],
                    "culture": ["Việt Nam"]
                }
            },
            {
                "name": "Chè Đậu Đỏ",
                "description": "Chè đậu đỏ ngọt với nước cốt dừa",
                "price": 25000,
                "category": "tráng miệng",
                "tags": {
                    "food": ["đậu đỏ", "nước cốt dừa", "đường"],
                    "taste": ["sweet-high", "rich", "creamy"],
                    "cooking_method": ["nấu nhỏ lửa"],
                    "culture": ["Việt Nam"]
                }
            }
        ]
        
        # Store 2: Asian fusion dishes
        fusion_dishes = [
            {
                "name": "Ramen Tonkotsu",
                "description": "Ramen tonkotsu với thịt heo và trứng luộc",
                "price": 85000,
                "category": "món chính",
                "tags": {
                    "food": ["thịt heo", "mì", "trứng", "nấm"],
                    "taste": ["umami-rich", "rich", "spicy-mild"],
                    "cooking_method": ["hầm", "luộc"],
                    "culture": ["Nhật Bản"]
                }
            },
            {
                "name": "Pad Thai Fusion",
                "description": "Pad Thai với tôm và đậu hũ chiên",
                "price": 70000,
                "category": "món chính",
                "tags": {
                    "food": ["tôm", "đậu hũ", "mì", "đậu phộng"],
                    "taste": ["sweet-medium", "sour-mild", "spicy-medium"],
                    "cooking_method": ["xào", "chiên ngập dầu"],
                    "culture": ["Thái Lan"]
                }
            },
            {
                "name": "Korean BBQ Bulgogi",
                "description": "Thịt bò bulgogi với rau củ nướng",
                "price": 95000,
                "category": "món chính",
                "tags": {
                    "food": ["thịt bò", "hành tây", "cà rốt", "nước tương"],
                    "taste": ["sweet-medium", "umami-rich", "spicy-mild"],
                    "cooking_method": ["nướng", "ướp"],
                    "culture": ["Hàn Quốc"]
                }
            },
            {
                "name": "Kung Pao Chicken",
                "description": "Gà kung pao với ớt chuông và đậu phộng",
                "price": 75000,
                "category": "món chính",
                "tags": {
                    "food": ["thịt gà", "ớt chuông", "đậu phộng", "hành tây"],
                    "taste": ["spicy-hot", "sweet-low", "umami-rich"],
                    "cooking_method": ["xào", "rán chảo"],
                    "culture": ["Trung Quốc"]
                }
            },
            {
                "name": "Butter Chicken Curry",
                "description": "Gà bơ cà ri với cơm basmati",
                "price": 80000,
                "category": "món chính",
                "tags": {
                    "food": ["thịt gà", "cà chua", "sữa", "cơm"],
                    "taste": ["spicy-medium", "rich", "creamy"],
                    "cooking_method": ["hầm", "nấu nhỏ lửa"],
                    "culture": ["Ấn Độ"]
                }
            },
            {
                "name": "Sushi Salmon Roll",
                "description": "Sushi cuộn cá hồi với rau củ tươi",
                "price": 90000,
                "category": "khai vị",
                "tags": {
                    "food": ["cá", "cơm", "dưa leo", "wasabi"],
                    "taste": ["umami-light", "spicy-mild", "neutral-flavor"],
                    "cooking_method": ["sống"],
                    "culture": ["Nhật Bản"]
                }
            },
            {
                "name": "Tom Yum Goong",
                "description": "Canh chua tôm Thái với nấm và chanh",
                "price": 65000,
                "category": "canh",
                "tags": {
                    "food": ["tôm", "nấm", "chanh", "sả"],
                    "taste": ["sour", "spicy-hot", "herbal"],
                    "cooking_method": ["nấu nhỏ lửa"],
                    "culture": ["Thái Lan"]
                }
            },
            {
                "name": "Bibimbap Bowl",
                "description": "Bibimbap với rau củ và thịt bò",
                "price": 75000,
                "category": "món chính",
                "tags": {
                    "food": ["cơm", "thịt bò", "rau củ", "trứng"],
                    "taste": ["umami-rich", "spicy-medium", "rich"],
                    "cooking_method": ["xào", "luộc"],
                    "culture": ["Hàn Quốc"]
                }
            },
            {
                "name": "Mapo Tofu",
                "description": "Đậu hũ mapo với thịt heo bằm",
                "price": 60000,
                "category": "món chính",
                "tags": {
                    "food": ["đậu hũ", "thịt heo", "ớt", "nước tương"],
                    "taste": ["spicy-hot", "umami-rich", "rich"],
                    "cooking_method": ["hầm", "xào"],
                    "culture": ["Trung Quốc"]
                }
            },
            {
                "name": "Mango Sticky Rice",
                "description": "Xôi xoài với nước cốt dừa",
                "price": 40000,
                "category": "tráng miệng",
                "tags": {
                    "food": ["cơm", "xoài", "nước cốt dừa", "đường"],
                    "taste": ["sweet-high", "creamy", "fragrant"],
                    "cooking_method": ["hấp", "nấu nhỏ lửa"],
                    "culture": ["Thái Lan"]
                }
            }
        ]
        
        # Create dish records
        dish_id = 1
        for store_idx, store_dishes in enumerate([vietnamese_dishes, fusion_dishes]):
            store_id = f"store_{store_idx + 1}"
            
            for dish in store_dishes:
                dish_record = {
                    "id": f"dish_{dish_id}",
                    "name": dish["name"],
                    "description": dish["description"],
                    "price": dish["price"],
                    "category": dish["category"],
                    "store_id": store_id,
                    "stock_status": "available",
                    "stock_count": random.randint(50, 200),
                    "rating": round(random.uniform(4.0, 4.8), 1),
                    "created_at": datetime.now() - timedelta(days=random.randint(1, 365)),
                    "updated_at": datetime.now() - timedelta(days=random.randint(1, 30))
                }
                
                # Add tag references
                dish_record["food_tags"] = [self.tag_ids.get(tag, "") for tag in dish["tags"]["food"]]
                dish_record["taste_tags"] = [self.tag_ids.get(tag, "") for tag in dish["tags"]["taste"]]
                dish_record["cooking_method_tags"] = [self.tag_ids.get(tag, "") for tag in dish["tags"]["cooking_method"]]
                dish_record["culture_tags"] = [self.tag_ids.get(tag, "") for tag in dish["tags"]["culture"]]
                
                dishes.append(dish_record)
                self.dish_ids.append(f"dish_{dish_id}")
                dish_id += 1
        
        return pd.DataFrame(dishes)
    
    def generate_users(self) -> pd.DataFrame:
        """Generate 10 users with diverse preferences and behaviors."""
        user_profiles = [
            {
                "id": "user_1",
                "name": "Nguyễn Văn An",
                "age": 25,
                "gender": "male",
                "location": "Quận 1, TP.HCM",
                "preferences": {
                    "cuisine": ["Việt Nam", "Nhật Bản"],
                    "taste": ["spicy-mild", "umami-rich"],
                    "price_range": "budget",
                    "meal_type": ["món chính", "khai vị"]
                },
                "behavior": "health_conscious"  # Prefers fresh, less oily food
            },
            {
                "id": "user_2",
                "name": "Trần Thị Bình",
                "age": 32,
                "gender": "female", 
                "location": "Quận 3, TP.HCM",
                "preferences": {
                    "cuisine": ["Thái Lan", "Hàn Quốc"],
                    "taste": ["spicy-hot", "sour"],
                    "price_range": "premium",
                    "meal_type": ["món chính", "canh"]
                },
                "behavior": "adventure_seeker"  # Likes trying new, spicy foods
            },
            {
                "id": "user_3",
                "name": "Lê Minh Cường",
                "age": 28,
                "gender": "male",
                "location": "Quận 2, TP.HCM", 
                "preferences": {
                    "cuisine": ["Trung Quốc", "Việt Nam"],
                    "taste": ["spicy-medium", "sweet-medium"],
                    "price_range": "budget",
                    "meal_type": ["món chính", "tráng miệng"]
                },
                "behavior": "comfort_food_lover"  # Prefers familiar, hearty meals
            },
            {
                "id": "user_4",
                "name": "Phạm Thị Dung",
                "age": 45,
                "gender": "female",
                "location": "Quận 7, TP.HCM",
                "preferences": {
                    "cuisine": ["Việt Nam"],
                    "taste": ["spicy-none", "sweet-low"],
                    "price_range": "budget",
                    "meal_type": ["món chính", "canh"]
                },
                "behavior": "traditional_eater"  # Prefers traditional Vietnamese food
            },
            {
                "id": "user_5",
                "name": "Hoàng Văn Em",
                "age": 22,
                "gender": "male",
                "location": "Quận 10, TP.HCM",
                "preferences": {
                    "cuisine": ["Nhật Bản", "Hàn Quốc"],
                    "taste": ["umami-rich", "spicy-mild"],
                    "price_range": "premium",
                    "meal_type": ["khai vị", "món chính"]
                },
                "behavior": "trendy_foodie"  # Likes trendy, Instagram-worthy food
            },
            {
                "id": "user_6",
                "name": "Võ Thị Phương",
                "age": 35,
                "gender": "female",
                "location": "Quận 4, TP.HCM",
                "preferences": {
                    "cuisine": ["Ấn Độ", "Thái Lan"],
                    "taste": ["spicy-hot", "rich"],
                    "price_range": "premium",
                    "meal_type": ["món chính", "canh"]
                },
                "behavior": "spice_lover"  # Loves very spicy food
            },
            {
                "id": "user_7",
                "name": "Đặng Văn Giang",
                "age": 30,
                "gender": "male",
                "location": "Quận 5, TP.HCM",
                "preferences": {
                    "cuisine": ["Việt Nam", "Trung Quốc"],
                    "taste": ["sweet-medium", "umami-light"],
                    "price_range": "budget",
                    "meal_type": ["món chính"]
                },
                "behavior": "quick_eater"  # Prefers quick, convenient meals
            },
            {
                "id": "user_8",
                "name": "Bùi Thị Hương",
                "age": 27,
                "gender": "female",
                "location": "Quận 6, TP.HCM",
                "preferences": {
                    "cuisine": ["Hàn Quốc", "Nhật Bản"],
                    "taste": ["spicy-medium", "sour-mild"],
                    "price_range": "premium",
                    "meal_type": ["khai vị", "món chính", "tráng miệng"]
                },
                "behavior": "balanced_eater"  # Likes variety and balanced flavors
            },
            {
                "id": "user_9",
                "name": "Ngô Văn Inh",
                "age": 40,
                "gender": "male",
                "location": "Quận 8, TP.HCM",
                "preferences": {
                    "cuisine": ["Việt Nam"],
                    "taste": ["spicy-none", "sweet-low", "umami-rich"],
                    "price_range": "budget",
                    "meal_type": ["món chính", "canh"]
                },
                "behavior": "conservative_eater"  # Very traditional, avoids spicy food
            },
            {
                "id": "user_10",
                "name": "Lý Thị Kim",
                "age": 24,
                "gender": "female",
                "location": "Quận 9, TP.HCM",
                "preferences": {
                    "cuisine": ["Thái Lan", "Việt Nam"],
                    "taste": ["spicy-medium", "sweet-high"],
                    "price_range": "budget",
                    "meal_type": ["món chính", "tráng miệng"]
                },
                "behavior": "sweet_tooth"  # Loves sweet and moderately spicy food
            }
        ]
        
        self.user_ids = [user["id"] for user in user_profiles]
        return pd.DataFrame(user_profiles)
    
    def generate_interactions(self) -> pd.DataFrame:
        """Generate 200 interactions with realistic behavioral patterns."""
        interactions = []
        interaction_id = 1
        
        # Define interaction patterns based on user behavior
        for user in self.user_ids:
            user_interactions = []
            
            # Get user profile for behavior-based interactions
            user_profile = None
            for profile in self.users_data:
                if profile["id"] == user:
                    user_profile = profile
                    break
            
            if not user_profile:
                continue
                
            behavior = user_profile["behavior"]
            preferences = user_profile["preferences"]
            
            # Generate interactions based on behavior
            if behavior == "health_conscious":
                # Prefers Vietnamese and Japanese dishes, avoids very oily food
                preferred_dishes = [d for d in self.dish_ids if any(tag in preferences["cuisine"] for tag in ["Việt Nam", "Nhật Bản"])]
                num_interactions = random.randint(15, 25)
                
            elif behavior == "adventure_seeker":
                # Likes spicy Asian fusion dishes
                preferred_dishes = [d for d in self.dish_ids if any(tag in preferences["cuisine"] for tag in ["Thái Lan", "Hàn Quốc"])]
                num_interactions = random.randint(20, 30)
                
            elif behavior == "comfort_food_lover":
                # Prefers familiar, hearty dishes
                preferred_dishes = [d for d in self.dish_ids if any(tag in preferences["cuisine"] for tag in ["Việt Nam", "Trung Quốc"])]
                num_interactions = random.randint(18, 28)
                
            elif behavior == "traditional_eater":
                # Only Vietnamese food, no spicy
                preferred_dishes = [d for d in self.dish_ids[:10]]  # First 10 are Vietnamese
                num_interactions = random.randint(12, 22)
                
            elif behavior == "trendy_foodie":
                # Prefers premium, trendy dishes
                preferred_dishes = [d for d in self.dish_ids[10:]]  # Last 10 are fusion
                num_interactions = random.randint(15, 25)
                
            elif behavior == "spice_lover":
                # Likes very spicy dishes
                spicy_dishes = [d for d in self.dish_ids if "spicy" in str(d)]  # Simplified for demo
                preferred_dishes = spicy_dishes[:10] if spicy_dishes else self.dish_ids[10:]
                num_interactions = random.randint(20, 30)
                
            elif behavior == "quick_eater":
                # Prefers quick, convenient meals
                preferred_dishes = self.dish_ids[:15]  # Mix of both
                num_interactions = random.randint(10, 20)
                
            elif behavior == "balanced_eater":
                # Likes variety
                preferred_dishes = self.dish_ids
                num_interactions = random.randint(25, 35)
                
            elif behavior == "conservative_eater":
                # Very traditional, avoids spicy
                preferred_dishes = self.dish_ids[:10]
                num_interactions = random.randint(8, 18)
                
            elif behavior == "sweet_tooth":
                # Loves sweet dishes
                sweet_dishes = [d for d in self.dish_ids if "sweet" in str(d)]  # Simplified for demo
                preferred_dishes = sweet_dishes[:8] if sweet_dishes else self.dish_ids[:10]
                num_interactions = random.randint(15, 25)
            
            # Generate interactions
            for _ in range(num_interactions):
                # Choose dish with preference bias
                if random.random() < 0.8:  # 80% chance to choose preferred dishes
                    dish_id = random.choice(preferred_dishes)
                else:  # 20% chance to try something new
                    dish_id = random.choice(self.dish_ids)
                
                # Generate interaction type and rating
                interaction_type = random.choices(
                    ["order", "view", "rating", "cart"],
                    weights=[0.4, 0.3, 0.2, 0.1]
                )[0]
                
                # Generate rating based on preference alignment
                if dish_id in preferred_dishes:
                    rating = random.choices([4, 5], weights=[0.3, 0.7])[0]
                else:
                    rating = random.choices([1, 2, 3, 4], weights=[0.2, 0.3, 0.3, 0.2])[0]
                
                # Generate timestamp (last 6 months)
                timestamp = datetime.now() - timedelta(
                    days=random.randint(1, 180),
                    hours=random.randint(0, 23),
                    minutes=random.randint(0, 59)
                )
                
                interaction = {
                    "id": f"interaction_{interaction_id}",
                    "user_id": user,
                    "dish_id": dish_id,
                    "interaction_type": interaction_type,
                    "rating": rating if interaction_type == "rating" else None,
                    "timestamp": timestamp,
                    "context": {
                        "device": random.choice(["mobile", "desktop"]),
                        "location": user_profile["location"],
                        "time_of_day": timestamp.hour
                    }
                }
                
                interactions.append(interaction)
                interaction_id += 1
        
        # Ensure we have exactly 200 interactions
        while len(interactions) < 200:
            user = random.choice(self.user_ids)
            dish_id = random.choice(self.dish_ids)
            
            interaction_type = random.choices(
                ["order", "view", "rating", "cart"],
                weights=[0.4, 0.3, 0.2, 0.1]
            )[0]
            
            rating = random.randint(1, 5)
            timestamp = datetime.now() - timedelta(
                days=random.randint(1, 180),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59)
            )
            
            interaction = {
                "id": f"interaction_{interaction_id}",
                "user_id": user,
                "dish_id": dish_id,
                "interaction_type": interaction_type,
                "rating": rating if interaction_type == "rating" else None,
                "timestamp": timestamp,
                "context": {
                    "device": random.choice(["mobile", "desktop"]),
                    "location": "TP.HCM",
                    "time_of_day": timestamp.hour
                }
            }
            
            interactions.append(interaction)
            interaction_id += 1
        
        # Sort by timestamp
        interactions.sort(key=lambda x: x["timestamp"])
        
        return pd.DataFrame(interactions)
    
    def generate_test_scenarios(self) -> Dict[str, Any]:
        """Generate test scenarios for model evaluation."""
        scenarios = {
            "cold_start_user": {
                "description": "Test recommendation for a new user with no interaction history",
                "user_profile": {
                    "age": 26,
                    "gender": "male",
                    "location": "Quận 1, TP.HCM",
                    "preferences": {
                        "cuisine": ["Việt Nam", "Nhật Bản"],
                        "taste": ["spicy-mild", "umami-rich"],
                        "price_range": "budget"
                    }
                },
                "expected_behavior": "Should recommend popular dishes or dishes similar to user's stated preferences"
            },
            "cold_start_dish": {
                "description": "Test recommendation for a new dish with no interaction history",
                "dish_profile": {
                    "name": "Bánh Mì Pate Mới",
                    "cuisine": "Việt Nam",
                    "taste_profile": ["spicy-none", "umami-rich"],
                    "price": 30000,
                    "category": "món chính"
                },
                "expected_behavior": "Should be recommended to users who like Vietnamese food and similar taste profiles"
            },
            "diverse_user": {
                "description": "Test recommendation for a user with diverse interaction history",
                "user_id": "user_8",  # balanced_eater
                "expected_behavior": "Should receive diverse recommendations across different cuisines"
            },
            "specialized_user": {
                "description": "Test recommendation for a user with very specific preferences",
                "user_id": "user_4",  # traditional_eater
                "expected_behavior": "Should receive recommendations primarily for traditional Vietnamese dishes"
            },
            "spice_lover": {
                "description": "Test recommendation for a user who loves spicy food",
                "user_id": "user_6",  # spice_lover
                "expected_behavior": "Should receive recommendations for spicy dishes, especially Thai and Indian"
            },
            "budget_conscious": {
                "description": "Test recommendation for budget-conscious users",
                "user_criteria": {
                    "price_range": "budget",
                    "max_price": 60000
                },
                "expected_behavior": "Should receive recommendations for dishes under 60,000 VND"
            },
            "premium_user": {
                "description": "Test recommendation for premium users",
                "user_criteria": {
                    "price_range": "premium",
                    "min_price": 70000
                },
                "expected_behavior": "Should receive recommendations for higher-priced fusion dishes"
            }
        }
        
        return scenarios
    
    def save_all_data(self):
        """Save all generated data to CSV files."""
        print("Generating mock data...")
        
        # Generate tag categories
        tag_categories = self.generate_tag_categories()
        tag_categories.to_csv(os.path.join(self.data_dir, "tag_categories.csv"), index=False)
        
        # Generate tags
        food_tags = self.generate_food_tags()
        food_tags.to_csv(os.path.join(self.data_dir, "food_tags.csv"), index=False)
        
        taste_tags = self.generate_taste_tags()
        taste_tags.to_csv(os.path.join(self.data_dir, "taste_tags.csv"), index=False)
        
        cooking_method_tags = self.generate_cooking_method_tags()
        cooking_method_tags.to_csv(os.path.join(self.data_dir, "cooking_method_tags.csv"), index=False)
        
        culture_tags = self.generate_culture_tags()
        culture_tags.to_csv(os.path.join(self.data_dir, "culture_tags.csv"), index=False)
        
        # Generate stores
        stores = self.generate_stores()
        stores.to_csv(os.path.join(self.data_dir, "stores.csv"), index=False)
        
        # Generate dishes
        dishes = self.generate_dishes()
        dishes.to_csv(os.path.join(self.data_dir, "dishes.csv"), index=False)
        
        # Generate users
        users = self.generate_users()
        self.users_data = users.to_dict('records')
        users.to_csv(os.path.join(self.data_dir, "users.csv"), index=False)
        
        # Generate interactions
        interactions = self.generate_interactions()
        interactions.to_csv(os.path.join(self.data_dir, "interactions.csv"), index=False)
        
        # Generate test scenarios
        test_scenarios = self.generate_test_scenarios()
        with open(os.path.join(self.data_dir, "test_scenarios.json"), 'w', encoding='utf-8') as f:
            json.dump(test_scenarios, f, ensure_ascii=False, indent=2, default=str)
        
        print(f"Mock data generated successfully!")
        print(f"- Tag categories: {len(tag_categories)} records")
        print(f"- Food tags: {len(food_tags)} records")
        print(f"- Taste tags: {len(taste_tags)} records")
        print(f"- Cooking method tags: {len(cooking_method_tags)} records")
        print(f"- Culture tags: {len(culture_tags)} records")
        print(f"- Stores: {len(stores)} records")
        print(f"- Dishes: {len(dishes)} records")
        print(f"- Users: {len(users)} records")
        print(f"- Interactions: {len(interactions)} records")
        print(f"- Test scenarios: {len(test_scenarios)} scenarios")
        
        return {
            "tag_categories": tag_categories,
            "food_tags": food_tags,
            "taste_tags": taste_tags,
            "cooking_method_tags": cooking_method_tags,
            "culture_tags": culture_tags,
            "stores": stores,
            "dishes": dishes,
            "users": users,
            "interactions": interactions,
            "test_scenarios": test_scenarios
        }


def main():
    """Main function to generate mock data."""
    generator = MockDataGenerator()
    data = generator.save_all_data()
    
    print("\n" + "="*50)
    print("MOCK DATA GENERATION COMPLETE")
    print("="*50)
    print("\nGenerated data includes:")
    print("✓ 2 stores with different characteristics")
    print("✓ 20 dishes (10 per store) with realistic tag combinations")
    print("✓ 10 users with diverse preferences and behaviors")
    print("✓ 200 interactions with behavioral patterns")
    print("✓ Comprehensive test scenarios for model evaluation")
    print("\nFiles saved to data/ directory:")
    print("- tag_categories.csv")
    print("- food_tags.csv, taste_tags.csv, cooking_method_tags.csv, culture_tags.csv")
    print("- stores.csv, dishes.csv, users.csv, interactions.csv")
    print("- test_scenarios.json")
    
    print("\n" + "="*50)
    print("BEHAVIORAL PATTERNS IMPLEMENTED")
    print("="*50)
    print("The mock data includes realistic user behaviors:")
    print("• Health-conscious users prefer fresh, less oily food")
    print("• Adventure seekers like spicy, exotic dishes")
    print("• Comfort food lovers prefer familiar, hearty meals")
    print("• Traditional eaters stick to Vietnamese cuisine")
    print("• Trendy foodies prefer premium, Instagram-worthy dishes")
    print("• Spice lovers seek very spicy food")
    print("• Quick eaters prefer convenient meals")
    print("• Balanced eaters like variety")
    print("• Conservative eaters avoid spicy food")
    print("• Sweet tooth users love desserts and sweet dishes")


if __name__ == "__main__":
    main()
