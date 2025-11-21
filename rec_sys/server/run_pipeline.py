# run_pipeline.py
import os
import subprocess
import json
import time
from datetime import datetime
from typing import Dict, Any

# --- Paths (Adjust as needed) ---
# Assuming Node.js scripts are in a 'scripts/export_scripts' relative path
# Define the absolute path to the 'server' directory
# (Assumes run_pipeline.py is located inside 'server/')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define where the node scripts live relative to BASE_DIR
EXPORT_SCRIPTS = {
    "users": "src/data/export_script/user.js",
    "dishes": "src/data/export_script/dish.js",
    "stores": "src/data/export_script/store.js",
    "interactions": "src/data/export_script/interaction.js",
    "food_tags": "src/data/export_script/food_tag.js",
    "taste_tags": "src/data/export_script/taste_tag.js",
    "cooking_tags": "src/data/export_script/cooking_method_tag.js",
    "culture_tags": "src/data/export_script/culture_tag.js",
}
TRAIN_SCRIPT = "server/train.py"
EVALUATE_SCRIPT = "scripts/evaluate_notebook_cli.py"

MODEL_SAVE_DIR = "server/model/"
EVALUATION_OUTPUT_PATH = os.path.join(MODEL_SAVE_DIR, "evaluation_results.json")
# --- End Paths ---

# --- Status Update Function (Signature only) ---
def update_status_func(job_id: str, status: str, message: str = None, result: Any = None, error: str = None):
    pass

# --- Pipeline Steps ---

def export_data(job_id: str, update_status):
    current_status = "EXPORTING"
    update_status(job_id, status=current_status, message="Starting data export...")
    print(f"[{job_id}] Initializing data export pipeline...")

    # 1. Determine the Node Execution Root (Where package.json/.env usually are)
    # Since BASE_DIR is 'server/', we can likely run node from there.
    node_execution_cwd = BASE_DIR 
    print(f"[{job_id}] Setting Node execution CWD to: {node_execution_cwd}")
    
    env_vars = os.environ.copy()
    if "MONGODB_URL" not in env_vars:
            print(f"[{job_id}] ⚠️ WARNING: MONGODB_URL not found in Python environment!")

    for name, relative_path in EXPORT_SCRIPTS.items():
        # 2. Construct absolute path using BASE_DIR + relative_path
        # This prevents the "double path" error
        absolute_script_path = os.path.join(BASE_DIR, relative_path)
        
        # Normalize path for Windows (changes / to \)
        absolute_script_path = os.path.normpath(absolute_script_path)

        update_status(job_id, status=current_status, message=f"Exporting {name}...")
        print(f"[{job_id}] Script Path: {absolute_script_path}")

        if not os.path.exists(absolute_script_path):
            error_msg = f"Script file not found: {absolute_script_path}"
            print(f"[{job_id}] ❌ {error_msg}")
            update_status(job_id, status="FAILED", error=error_msg)
            raise RuntimeError(error_msg)

        try:
            result = subprocess.run(
                ["node", absolute_script_path],
                cwd=node_execution_cwd, # Run from 'server/' folder
                capture_output=True,
                text=True,
                encoding='utf-8',
                check=True,
                env=env_vars
            )
            # print(f"[{job_id}] Output: {result.stdout}") # Optional debug

        except subprocess.CalledProcessError as e:
            stderr_safe = e.stderr or "No error output captured."
            # ... (keep your existing error handling logic) ...
            
            full_error_msg = f"Failed to export {name}.\nDetails:\n{stderr_safe}"
            print(f"[{job_id}] ❌ {full_error_msg}")
            
            update_status(job_id, status="FAILED", error=f"Export failed for {name}: {stderr_safe[:200]}")
            raise RuntimeError(f"Export pipeline stopped at {name}.")
            
        except Exception as e:
            # ... (keep your existing generic error handling) ...
            error_msg = f"Unexpected Python error: {str(e)}"
            update_status(job_id, status="FAILED", error=error_msg)
            raise RuntimeError(error_msg)

    print(f"[{job_id}] ✅ All export scripts completed successfully.")
def train_model(job_id: str, update_status):
    """Trains the model using the exported data."""
    # Initial status set
    update_status(job_id, status="TRAINING", message="Starting model training...")
    
    print(f"[{job_id}] Running model training...")
    
    try:
        result = subprocess.run(
            ["python", TRAIN_SCRIPT],
            capture_output=True, text=True, check=True,
        )
        print(f"[{job_id}] Model training complete.")
        update_status(job_id, status="TRAINING", message="Model training complete.")
        
    except subprocess.CalledProcessError as e:
        error_message = f"Model training failed: {e.stderr[:500]}"
        print(f"[{job_id}] ERROR: {error_message}\nFull stderr:\n{e.stderr}")
        
        # This call was already correct because you included status="FAILED"
        update_status(job_id, status="FAILED", error=error_message) 
        raise RuntimeError(error_message)
        
    except Exception as e:
        error_message = f"Unexpected error during training: {str(e)}"
        print(f"[{job_id}] ERROR: {error_message}")
        
        # This call was already correct
        update_status(job_id, status="FAILED", error=error_message)
        raise RuntimeError(error_message)


def evaluate_model(job_id: str, update_status):
    """Runs the model evaluation script."""
    update_status(job_id, status="EVALUATING", message="Running model evaluation...")
    print(f"[{job_id}] Running model evaluation...")
    
    try:
        result = subprocess.run(
            ["python", EVALUATE_SCRIPT],
            capture_output=True, 
            text=True, 
            check=True,
            encoding='utf-8'
        )
        
        print(f"[{job_id}] Model evaluation complete.")
        
        update_status(job_id, status="COMPLETED", message="Model evaluation complete.")


    except subprocess.CalledProcessError as e:
        # Fix encoding here too just in case stderr has special chars
        error_message = f"Model evaluation failed: {e.stderr[:500]}"
        print(f"[{job_id}] ERROR: {error_message}\nFull stderr:\n{e.stderr}")
        update_status(job_id, status="FAILED", error=error_message)
        raise RuntimeError(error_message)

    except Exception as e:
        error_message = f"Unexpected error during evaluation: {str(e)}"
        print(f"[{job_id}] ERROR: {error_message}")
        update_status(job_id, status="FAILED", error=error_message)
        raise RuntimeError(error_message)


# --- Wrappers for Background Tasks ---
def run_export_task(job_id: str, update_status_callback):
    global is_processing_running
    try:
        export_data(job_id, update_status_callback)
        # Only reached if export_data doesn't raise an error
        update_status_callback(job_id, status="COMPLETED", message="Data export finished successfully.")
    except RuntimeError as e: # Catch the specific error raised by export_data on failure
        # Status "FAILED" was already set inside export_data
        print(f"Export task failed for job {job_id} due to subprocess error: {e}")
    except Exception as e: # Catch other unexpected errors in this wrapper
        print(f"Unexpected error in export task wrapper for job {job_id}: {e}")
        # Ensure status is set to FAILED if not already set
        update_status_callback(job_id, status="FAILED", error=f"Unexpected wrapper error: {str(e)}")
    finally:
        is_processing_running = False # Release lock *always*
        print(f"[{job_id}] Export task finished or failed, lock released.")

def run_train_eval_task(job_id: str, update_status_callback):
    global is_processing_running
    eval_results = None
    try:
        # --- Make sure calls inside train/evaluate provide 'status' ---
        train_model(job_id, update_status_callback)
        eval_results = evaluate_model(job_id, update_status_callback)
        # --- Ensure success call provides 'status' ---
        update_status_callback(job_id, status="COMPLETED", message="Training and evaluation finished successfully.", result=eval_results) # Ensure status="COMPLETED"
    except Exception as e:
        # --- Ensure error call provides 'status' ---
        print(f"Train/Eval task failed for job {job_id}: {e}")
        update_status_callback(job_id, status="FAILED", error=str(e)) # Ensure status="FAILED"
    finally:
        # --- CRITICAL: Ensure lock is released ---
        is_processing_running = False # Release lock *always*
        print(f"[{job_id}] Train/Eval task finished, lock released.")
        # ----------------------------------------