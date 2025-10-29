# run_pipeline.py
import os
import subprocess
import json
import time
from datetime import datetime
from typing import Dict, Any

# --- Paths (Adjust as needed) ---
# Assuming Node.js scripts are in a 'scripts/export_scripts' relative path
NODE_SCRIPT_DIR = "server\src\data\export_script" # NEW: Directory for Node exporters
EXPORT_SCRIPTS = { # NEW: Map Node scripts
    "users": os.path.join(NODE_SCRIPT_DIR, "user.js"),
    "stores": os.path.join(NODE_SCRIPT_DIR, "store.js"),
    "dishes": os.path.join(NODE_SCRIPT_DIR, "dish.js"),
    "interactions": os.path.join(NODE_SCRIPT_DIR, "interaction.js"),
    "food_tags": os.path.join(NODE_SCRIPT_DIR, "food_tag.js"),
    "taste_tags": os.path.join(NODE_SCRIPT_DIR, "taste_tag.js"),
    "cooking_method_tags": os.path.join(NODE_SCRIPT_DIR, "cooking_method_tag.js"),
    "culture_tags": os.path.join(NODE_SCRIPT_DIR, "culture_tag.js"),
}
TRAIN_SCRIPT = "scripts/train_mock_model.py"
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
    print(f"[{job_id}] Running data export...")
    failed_scripts = []
    all_logs = ""

    # --- Determine the correct CWD ---
    # Assuming run_pipeline.py is in the root 'rec_sys' folder or similar
    # The CWD should be the root of your Node.js project where node_modules is,
    # usually the parent directory of 'scripts/export_scripts'
    # Adjust this path if your structure is different!
    node_project_root = os.path.abspath(os.path.join(NODE_SCRIPT_DIR, '..')) # Go up one level from script dir
    print(f"[{job_id}] Setting Node CWD to: {node_project_root}")
    # ---------------------------------

    for name, script_path in EXPORT_SCRIPTS.items():
        update_status(job_id, status=current_status, message=f"Exporting {name}...")
        absolute_script_path = os.path.abspath(script_path) # Use absolute path for robustness
        print(f"[{job_id}] Running script: {absolute_script_path}")
        if not os.path.exists(absolute_script_path):
             failed_scripts.append(f"{name} (Script not found: {absolute_script_path})")
             all_logs += f"ERROR: Script not found: {absolute_script_path}\n"
             continue

        try:
             result = subprocess.run(
                 ["node", absolute_script_path], # Use absolute script path
                 capture_output=True,
                 encoding='utf-8',
                 text=True,
                 check=True,
                 # --- FIX: Set Current Working Directory ---
                 cwd=node_project_root # Run Node script FROM this directory
                 # ------------------------------------------
             )
             # ... (rest of try block) ...
        except subprocess.CalledProcessError as e:
            # ... (keep improved error handling) ...
            stderr_safe = e.stderr or ""
            stdout_safe = e.stdout or ""
            error_message = f"Failed to export {name} from {absolute_script_path}: {stderr_safe[:500]}"
            print(f"[{job_id}] ERROR: {error_message}")
            failed_scripts.append(f"{name} (Error: {stderr_safe[:100]}...)")
            all_logs += f"--- {name} ERROR ---\nCWD: {node_project_root}\nSCRIPT: {absolute_script_path}\nSTDOUT:\n{stdout_safe}\nSTDERR:\n{stderr_safe}\n"
        except Exception as e:
            # ... (keep improved error handling) ...
            error_message = f"Unexpected error exporting {name}: {str(e)}"
            print(f"[{job_id}] ERROR: {error_message}")
            failed_scripts.append(f"{name} (Error: {str(e)})")
            all_logs += f"--- {name} UNEXPECTED ERROR ---\n{str(e)}\n"


    if failed_scripts:
        error_summary = f"Data export failed for: {', '.join(failed_scripts)}"
        update_status(job_id, status="FAILED", error=error_summary)
        # Log more details on failure
        print(f"[{job_id}] Full export logs on failure:\n{all_logs}")
        raise RuntimeError(error_summary)
    else:
        print(f"[{job_id}] Data export script execution finished successfully.")


def train_model(job_id: str, update_status):
    """Trains the model using the exported data."""
    update_status(job_id, status="TRAINING", message="Starting model training...")
    print(f"[{job_id}] Running model training...")
    try:
        result = subprocess.run(
            ["python", TRAIN_SCRIPT],
            capture_output=True, text=True, check=True, # check=True raises error
            # shell=True # If python isn't directly callable
        )
        print(f"[{job_id}] Model training complete.")
        update_status(job_id, message="Model training complete.")
        # print(f"Training Output:\n{result.stdout}") # Optionally log stdout
    except subprocess.CalledProcessError as e:
        error_message = f"Model training failed: {e.stderr[:500]}"
        print(f"[{job_id}] ERROR: {error_message}\nFull stderr:\n{e.stderr}")
        update_status(job_id, status="FAILED", error=error_message) # Update status on failure
        raise RuntimeError(error_message)
    except Exception as e:
         error_message = f"Unexpected error during training: {str(e)}"
         print(f"[{job_id}] ERROR: {error_message}")
         update_status(job_id, status="FAILED", error=error_message)
         raise RuntimeError(error_message)


def evaluate_model(job_id: str, update_status):
    """Evaluates the newly trained model and saves results."""
    update_status(job_id, status="EVALUATING", message="Evaluating trained model...")
    print(f"[{job_id}] Running model evaluation...")
    try:
        # Ensure output directory exists for results JSON
        os.makedirs(os.path.dirname(EVALUATION_OUTPUT_PATH), exist_ok=True)

        result = subprocess.run(
            ["python", EVALUATE_SCRIPT, "--output_path", EVALUATION_OUTPUT_PATH],
            capture_output=True, text=True, check=True, # check=True raises error
            # shell=True # If python isn't directly callable
        )
        print(f"[{job_id}] Model evaluation complete.")
        update_status(job_id, message="Model evaluation complete.")
        # print(f"Evaluation Output:\n{result.stdout}") # Optionally log stdout

        # Read and return results
        with open(EVALUATION_OUTPUT_PATH, 'r') as f:
            eval_results = json.load(f)
        return eval_results

    except FileNotFoundError:
        error_message = f"Evaluation results file not found at {EVALUATION_OUTPUT_PATH} after script ran."
        print(f"[{job_id}] ERROR: {error_message}")
        update_status(job_id, status="FAILED", error=error_message)
        raise RuntimeError(error_message)
    except subprocess.CalledProcessError as e:
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