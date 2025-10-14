# Training Guide for Recommendation System with Mock Data

## Overview

This guide explains how to train your recommendation system using the generated mock data. The training pipeline includes data preprocessing, model training, and comprehensive evaluation.

## Prerequisites

Make sure you have the required dependencies installed:

```bash
pip install torch pandas numpy scikit-learn matplotlib seaborn tqdm
```

## Training Pipeline

### Step 1: Generate Mock Data (Already Done)

The mock data has been generated with:
- 2 stores with different characteristics
- 20 dishes with realistic tag combinations
- 10 users with diverse behavioral patterns
- 225 interactions with behavioral rules
- Comprehensive test scenarios

### Step 2: Train the Model

Run the training script:

```bash
python scripts/train_mock_model.py
```

This will:
1. Load and preprocess the mock data
2. Create positive and negative samples for training
3. Initialize the two-tower recommendation model
4. Train the model with validation
5. Save the best model and training artifacts

**Training Configuration:**
- Batch size: 16
- Learning rate: 0.001
- Epochs: 20
- Embedding dimension: 64
- Device: Auto-detect (CPU/CUDA)

### Step 3: Evaluate the Model

Run the evaluation script:

```bash
python scripts/evaluate_mock_model.py
```

This will:
1. Load the trained model
2. Run all test scenarios
3. Generate comprehensive evaluation metrics
4. Create an evaluation report

## Model Architecture

The two-tower model consists of:

### User Tower
- User ID embedding
- Age, gender, location features
- Time and context features
- Recency features

### Item Tower
- Dish ID embedding
- Store and category embeddings
- Multi-hot tag embeddings (food, taste, cooking method, culture)
- Price, rating, and popularity features
- Location and context features

### Similarity Computation
- Normalized embeddings from both towers
- Dot product similarity scoring
- Binary classification (like/not like)

## Training Data Structure

### Positive Samples
- Real user-dish interactions from mock data
- Orders, ratings, and other positive interactions

### Negative Samples
- Random dishes that users haven't interacted with
- 4 negative samples per positive sample
- Temporal consistency maintained

### Data Split
- Training: 80% of interactions
- Validation: 10% of interactions
- Test: 10% of interactions

## Evaluation Scenarios

The model is evaluated on 7 comprehensive scenarios:

### 1. Cold Start User
- New user with no interaction history
- Tests recommendation based on user profile alone

### 2. Cold Start Dish
- New dish with no interaction history
- Tests similarity to existing dishes

### 3. Diverse User
- User with varied interaction history
- Tests recommendation diversity

### 4. Specialized User
- User with very specific preferences
- Tests preference adherence

### 5. Spice Lover
- User who loves spicy food
- Tests taste preference alignment

### 6. Budget Conscious
- Price-sensitive users
- Tests price constraint respect

### 7. Premium User
- Users willing to pay premium prices
- Tests high-quality dish recommendations

## Behavioral Patterns Learned

The model learns to recognize and respond to these user behaviors:

### Health Conscious
- Prefers fresh, less oily food
- Likes Vietnamese and Japanese cuisine
- Avoids very spicy dishes

### Adventure Seeker
- Likes trying new, exotic dishes
- Prefers Thai and Korean cuisine
- Enjoys spicy and sour flavors

### Comfort Food Lover
- Prefers familiar, hearty meals
- Likes Chinese and Vietnamese cuisine
- Enjoys sweet and moderately spicy food

### Traditional Eater
- Sticks to Vietnamese cuisine
- Avoids spicy food
- Prefers budget-friendly options

### Trendy Foodie
- Likes premium, Instagram-worthy dishes
- Prefers Japanese and Korean cuisine
- Values presentation and uniqueness

### Spice Lover
- Seeks very spicy food
- Likes Indian and Thai cuisine
- Enjoys rich, complex flavors

### Quick Eater
- Prefers convenient, fast meals
- Values speed over complexity
- Likes familiar options

### Balanced Eater
- Enjoys variety across cuisines
- Likes different meal types
- Values balanced flavors

### Conservative Eater
- Very traditional preferences
- Avoids spicy and exotic food
- Prefers budget options

### Sweet Tooth
- Loves desserts and sweet dishes
- Enjoys moderately spicy food
- Values taste over health

## Training Outputs

After training, you'll find these files in `runs/mock_training/`:

- `best_model.pth` - Best model checkpoint
- `model_info.json` - Model configuration and vocabularies
- `checkpoint_epoch_*.pth` - Regular checkpoints

## Evaluation Outputs

After evaluation, you'll find these files in `evaluation_results/`:

- `evaluation_report.txt` - Comprehensive evaluation report
- Performance metrics for each scenario
- Recommendation analysis and insights

## Key Metrics

The evaluation provides these metrics:

### Recommendation Quality
- Precision@K (K=5, 10)
- Recall@K (K=5, 10)
- Hit Rate
- Coverage

### Behavioral Alignment
- Cuisine preference alignment
- Taste preference alignment
- Price range alignment
- Behavior-specific metrics

### Diversity and Novelty
- Recommendation diversity
- Novelty scores
- Coverage of different categories

## Troubleshooting

### Common Issues

1. **CUDA Out of Memory**
   - Reduce batch size in the training script
   - Use CPU training by setting device='cpu'

2. **Model Not Converging**
   - Increase learning rate
   - Train for more epochs
   - Check data quality

3. **Poor Recommendations**
   - Verify behavioral patterns in data
   - Check feature encoding
   - Ensure proper negative sampling

### Performance Tips

1. **For Better Results**
   - Increase training epochs
   - Add more diverse mock data
   - Implement more sophisticated negative sampling

2. **For Faster Training**
   - Reduce embedding dimensions
   - Use smaller batch sizes
   - Train on subset of data

## Next Steps

After successful training:

1. **Deploy the Model**
   - Use the trained model for real-time recommendations
   - Implement the serving pipeline

2. **Collect Real Data**
   - Replace mock data with real user interactions
   - Retrain with actual behavioral patterns

3. **Improve the Model**
   - Add more sophisticated features
   - Implement advanced architectures
   - Add temporal modeling

4. **A/B Testing**
   - Test different recommendation strategies
   - Measure real-world performance
   - Iterate based on user feedback

## Understanding the Results

### Good Training Indicators
- Decreasing training and validation loss
- Validation loss stabilizes without overfitting
- Model saves as "best" multiple times

### Good Evaluation Indicators
- High success rate across scenarios (>80%)
- Good alignment with user behaviors
- Diverse and novel recommendations
- Respect for constraints (budget, preferences)

The mock data provides a solid foundation for understanding how your recommendation system will perform with real data. The behavioral patterns are designed to be learnable, so you should see good performance across all test scenarios.
