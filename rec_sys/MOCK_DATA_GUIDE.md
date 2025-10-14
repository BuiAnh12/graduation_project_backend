# Mock Data Guide for Recommendation System

## Overview

This guide explains the comprehensive mock data generated for testing your recommendation system training pipeline. The data includes realistic user behaviors, diverse dishes, and meaningful interactions that will help your ML model learn meaningful patterns.

## Generated Data Files

### Core Data Files
- **`users.csv`** - 10 users with diverse preferences and behaviors
- **`dishes.csv`** - 20 dishes (10 per store) with realistic tag combinations
- **`interactions.csv`** - 225 interactions with behavioral patterns
- **`stores.csv`** - 2 stores with different characteristics

### Tag System Files
- **`tag_categories.csv`** - Tag category definitions
- **`food_tags.csv`** - 53 food ingredient tags
- **`taste_tags.csv`** - 33 taste profile tags (in Vietnamese)
- **`cooking_method_tags.csv`** - 17 cooking method tags
- **`culture_tags.csv`** - 14 cuisine/culture tags

### Test Scenarios
- **`test_scenarios.json`** - 7 comprehensive test scenarios for model evaluation

## Store Characteristics

### Store 1: Quán Ăn Gia Đình Việt
- **Type**: Traditional Vietnamese family restaurant
- **Price Range**: Budget (30,000 - 75,000 VND)
- **Cuisine**: Vietnamese traditional
- **Rating**: 4.2/5
- **Dishes**: 10 traditional Vietnamese dishes

### Store 2: Asian Fusion Kitchen
- **Type**: Modern Asian fusion restaurant
- **Price Range**: Premium (60,000 - 95,000 VND)
- **Cuisine**: Asian fusion
- **Rating**: 4.5/5
- **Dishes**: 10 fusion dishes (Japanese, Korean, Thai, Indian, Chinese)

## User Behavioral Patterns

The mock data includes 10 users with distinct behavioral patterns:

### 1. Health Conscious (user_1)
- **Preferences**: Vietnamese & Japanese food, mild spice, umami-rich
- **Behavior**: Prefers fresh, less oily food
- **Price Range**: Budget

### 2. Adventure Seeker (user_2)
- **Preferences**: Thai & Korean food, hot spice, sour taste
- **Behavior**: Likes trying new, spicy foods
- **Price Range**: Premium

### 3. Comfort Food Lover (user_3)
- **Preferences**: Chinese & Vietnamese food, medium spice, sweet taste
- **Behavior**: Prefers familiar, hearty meals
- **Price Range**: Budget

### 4. Traditional Eater (user_4)
- **Preferences**: Vietnamese food only, no spice, low sweetness
- **Behavior**: Very traditional, avoids spicy food
- **Price Range**: Budget

### 5. Trendy Foodie (user_5)
- **Preferences**: Japanese & Korean food, umami-rich, mild spice
- **Behavior**: Likes trendy, Instagram-worthy food
- **Price Range**: Premium

### 6. Spice Lover (user_6)
- **Preferences**: Indian & Thai food, hot spice, rich flavors
- **Behavior**: Loves very spicy food
- **Price Range**: Premium

### 7. Quick Eater (user_7)
- **Preferences**: Vietnamese & Chinese food, medium spice, sweet taste
- **Behavior**: Prefers quick, convenient meals
- **Price Range**: Budget

### 8. Balanced Eater (user_8)
- **Preferences**: Korean & Japanese food, medium spice, mild sour
- **Behavior**: Likes variety and balanced flavors
- **Price Range**: Premium

### 9. Conservative Eater (user_9)
- **Preferences**: Vietnamese food only, no spice, low sweetness
- **Behavior**: Very traditional, avoids spicy food
- **Price Range**: Budget

### 10. Sweet Tooth (user_10)
- **Preferences**: Thai & Vietnamese food, medium spice, high sweetness
- **Behavior**: Loves sweet and moderately spicy food
- **Price Range**: Budget

## Dish Categories and Tags

### Vietnamese Dishes (Store 1)
1. **Phở Bò** - Traditional beef pho (65,000 VND)
2. **Bánh Mì Thịt Nướng** - Grilled pork sandwich (35,000 VND)
3. **Gỏi Cuốn Tôm** - Fresh spring rolls with shrimp (45,000 VND)
4. **Cơm Tấm Sườn Nướng** - Broken rice with grilled pork (55,000 VND)
5. **Chả Cá Lã Vọng** - Hanoi-style fish cake (75,000 VND)
6. **Bún Chả Hà Nội** - Hanoi-style vermicelli with grilled pork (60,000 VND)
7. **Bánh Xèo Miền Tây** - Southern-style crispy pancake (50,000 VND)
8. **Canh Chua Cá Lóc** - Sour soup with snakehead fish (70,000 VND)
9. **Nem Nướng Nha Trang** - Grilled pork sausage (65,000 VND)
10. **Chè Đậu Đỏ** - Red bean sweet soup (25,000 VND)

### Asian Fusion Dishes (Store 2)
1. **Ramen Tonkotsu** - Pork bone ramen (85,000 VND)
2. **Pad Thai Fusion** - Fusion pad thai with tofu (70,000 VND)
3. **Korean BBQ Bulgogi** - Marinated beef bulgogi (95,000 VND)
4. **Kung Pao Chicken** - Spicy chicken with peanuts (75,000 VND)
5. **Butter Chicken Curry** - Indian curry with basmati rice (80,000 VND)
6. **Sushi Salmon Roll** - Salmon sushi roll (90,000 VND)
7. **Tom Yum Goong** - Thai sour soup with shrimp (65,000 VND)
8. **Bibimbap Bowl** - Korean mixed rice bowl (75,000 VND)
9. **Mapo Tofu** - Spicy tofu with minced pork (60,000 VND)
10. **Mango Sticky Rice** - Thai dessert (40,000 VND)

## Interaction Patterns

The 225 interactions are generated with realistic behavioral patterns:

- **Order interactions**: 40% (actual purchases)
- **View interactions**: 30% (browsing behavior)
- **Rating interactions**: 20% (feedback)
- **Cart interactions**: 10% (abandoned carts)

### Behavioral Rules Implemented:
1. **Preference Alignment**: Users have 80% chance to interact with preferred dishes
2. **Behavioral Consistency**: Each user type follows specific interaction patterns
3. **Temporal Distribution**: Interactions spread over 6 months
4. **Rating Bias**: Preferred dishes get higher ratings (4-5 stars)
5. **Context Information**: Includes device type, location, and time of day

## Test Scenarios

The mock data includes 7 comprehensive test scenarios:

### 1. Cold Start User
- **Scenario**: New user with no interaction history
- **Test**: Can the model recommend based on user profile alone?

### 2. Cold Start Dish
- **Scenario**: New dish with no interaction history
- **Test**: Can the model recommend new dishes to suitable users?

### 3. Diverse User
- **Scenario**: User with varied interaction history
- **Test**: Does the model provide diverse recommendations?

### 4. Specialized User
- **Scenario**: User with very specific preferences
- **Test**: Does the model respect strong preferences?

### 5. Spice Lover
- **Scenario**: User who loves spicy food
- **Test**: Does the model recommend spicy dishes appropriately?

### 6. Budget Conscious
- **Scenario**: Price-sensitive users
- **Test**: Does the model respect price constraints?

### 7. Premium User
- **Scenario**: Users willing to pay premium prices
- **Test**: Does the model recommend high-quality, expensive dishes?

## Training Recommendations

### Data Split Strategy
- **Training Set**: 80% of interactions (180 interactions)
- **Validation Set**: 10% of interactions (22 interactions)
- **Test Set**: 10% of interactions (23 interactions)
- **Use temporal split**: Older interactions for training, newer for testing

### Feature Engineering
- **User Features**: Age, gender, location, behavior type, preferences
- **Dish Features**: Price, category, cuisine type, taste profile, cooking method
- **Interaction Features**: Time of day, device type, interaction type

### Evaluation Metrics
- **Precision@K** (K=5, 10)
- **Recall@K** (K=5, 10)
- **NDCG@K** (K=5, 10)
- **Hit Rate**
- **Coverage**
- **Diversity**
- **Novelty**

## Usage Instructions

1. **Load the data** using pandas:
   ```python
   import pandas as pd
   users = pd.read_csv('data/users.csv')
   dishes = pd.read_csv('data/dishes.csv')
   interactions = pd.read_csv('data/interactions.csv')
   ```

2. **Train your model** using the interactions and user/dish features

3. **Test using scenarios** from `test_scenarios.json`

4. **Evaluate** using the behavioral patterns as ground truth

## Behavioral Learning Opportunities

The mock data is designed to teach your ML model:

1. **Cuisine Preferences**: Users consistently prefer certain cuisines
2. **Spice Tolerance**: Clear patterns in spice preference levels
3. **Price Sensitivity**: Budget vs premium user behaviors
4. **Meal Type Preferences**: Different users prefer different meal categories
5. **Temporal Patterns**: Time-of-day and device usage patterns
6. **Interaction Types**: Different users have different interaction behaviors

This comprehensive mock data will help your recommendation system learn meaningful patterns and provide accurate, personalized recommendations for real users.
