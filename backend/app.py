# backend/app.py
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from planner import generate_savings_plan, predict_property, load_models, reload_models
from .train_models import train_gold_model, train_property_models, DATA_DIR, MODELS_DIR

# ---------------------------
# Load environment variables
# ---------------------------
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

# Flask setup
app = Flask(
    __name__,
    static_folder=str(Path(__file__).parent.parent / "frontend"),
    static_url_path=""
)

# ---------------------------
# Load Models on Startup
# ---------------------------
MODEL_LOAD_INFO = load_models(models_dir=MODELS_DIR)


# ---------------------------
# Serve Frontend
# ---------------------------
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:p>")
def serve_static(p):
    return send_from_directory(app.static_folder, p)


# ---------------------------
# API: Generate Savings Plan
# ---------------------------
@app.route("/api/plan_goal", methods=["POST"])
def api_plan_goal():
    try:
        data = request.get_json(force=True)
        plan = generate_savings_plan(data, models=MODEL_LOAD_INFO)
        return jsonify(plan)
    except Exception as e:
        app.logger.exception("Error in /api/plan_goal")
        return jsonify({"error": str(e)}), 500


# ---------------------------
# API: Predict Property Value
# ---------------------------
@app.route("/api/property_predict", methods=["POST"])
def api_property_predict():
    try:
        data = request.get_json(force=True)
        result = predict_property(data, models=MODEL_LOAD_INFO)
        return jsonify(result)
    except Exception as e:
        app.logger.exception("Error in /api/property_predict")
        return jsonify({"error": str(e)}), 500


# ---------------------------
# API: AI Chat Advisor (Groq only)
# ---------------------------
@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(force=True)
    query = data.get("query", "")
    context = data.get("context", {})

    GROQ_KEY = os.getenv("GROQ_API_KEY")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    if not GROQ_KEY:
        return jsonify({
            "answer": "⚠️ No GROQ_API_KEY found. Please add it to backend/.env"
        }), 400

    # Build AI prompt
    prompt = f"""
You are a friendly, knowledgeable Indian financial assistant.
User's question: {query}
Context: {json.dumps(context, indent=2)}

Provide a clear, concise financial suggestion.
Use ₹ (INR) for all currency values and include 2–3 actionable tips if possible.
"""

    try:
        # Groq SDK client
        from groq import Client
        client = Client(api_key=GROQ_KEY)

        # Send query to Groq model
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a professional Indian financial advisor."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.25,
            max_output_tokens=500
        )

        # Extract response text
        answer = None
        if hasattr(response, "choices"):
            answer = response.choices[0].message.content
        else:
            # In case SDK returns dict-like
            answer = response.get("choices", [{}])[0].get("message", {}).get("content", "")

        return jsonify({"answer": answer or "No response received from Groq."})

    except Exception as e:
        app.logger.exception("Groq SDK call failed")
        return jsonify({
            "answer": f"⚠️ Groq API call failed: {str(e)}"
        }), 500


# ---------------------------
# Optional: Train All Models
# ---------------------------
@app.route("/api/train_all", methods=["POST"])
def api_train_all():
    data = request.get_json(force=True) or {}
    sample_size = int(data.get("sample_size", 50000))

    try:
        gold_csv = DATA_DIR / "gold_data.csv"
        prop_csv = DATA_DIR / "property_data.csv"
        gold_model, gold_mae = train_gold_model(gold_csv, MODELS_DIR / "gold_prophet_model.pkl")
        metrics = train_property_models(
            prop_csv,
            MODELS_DIR / "property_gbm_model.pkl",
            MODELS_DIR / "property_gbm_classifier.pkl",
            sample_size=sample_size
        )
        reload_models(MODELS_DIR, MODEL_LOAD_INFO)
        return jsonify({"gold_mae": gold_mae, **metrics})
    except Exception as e:
        app.logger.exception("Error in /api/train_all")
        return jsonify({"error": str(e)}), 500


# ---------------------------
# Start Flask Server
# ---------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
