import os
import sys
import io

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
else:
    # Fallback for older Python versions
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
else:
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
# =============================================================================

# --- 1. Setup Paths ---
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

if project_root not in sys.path:
    sys.path.append(project_root)

try:
    from server.src.evaluate import ModelEvaluator
except ImportError as e:
    print(f"[X] Error importing ModelEvaluator: {e}")
    print(f"Current sys.path: {sys.path}")
    sys.exit(1)

MODEL_PATH = os.path.join(project_root, 'server', 'model', 'best_model.pth')
MODEL_INFO_PATH = os.path.join(project_root, 'server', 'model', 'model_info.json')
DATA_DIR = os.path.join(project_root, 'server', 'src', 'data', 'exported_data')
REPORT_OUTPUT_PATH = os.path.join(project_root, 'server', 'model', 'evaluation_report.txt')

def run_evaluation():
    print("--- Starting CLI Model Evaluation ---")
    print(f"Model Path: {MODEL_PATH}")
    print(f"Data Dir: {DATA_DIR}")

    if not os.path.exists(MODEL_PATH):
        print(f"[X] Error: Model file not found at {MODEL_PATH}")
        sys.exit(1)

    try:
        # 1. Initialize Evaluator
        evaluator = ModelEvaluator(MODEL_PATH, MODEL_INFO_PATH, DATA_DIR)
        
        # 2. Run Comprehensive Evaluation
        report_text = evaluator.run_comprehensive_evaluation()
        
        # 3. Save Report to File (This always worked, file writing handles utf-8 fine)
        os.makedirs(os.path.dirname(REPORT_OUTPUT_PATH), exist_ok=True)
        with open(REPORT_OUTPUT_PATH, 'w', encoding='utf-8') as f:
            f.write(report_text)
            
        print("------------------------------------------------")
        # This print caused the crash before the fix
        print(report_text) 
        print("------------------------------------------------")
        print(f"[OK] Evaluation successful. Report saved to: {REPORT_OUTPUT_PATH}")

    except Exception as e:
        print(f"[X] Evaluation Failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    run_evaluation()