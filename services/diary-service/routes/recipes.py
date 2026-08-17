from flask import Blueprint, request, jsonify
from boto3.dynamodb.conditions import Attr, Key
from database import foods_table, diary_table, decimal_to_native, FOODS_CATEGORY_GSI, get_redis_client
from middleware.auth import get_user_from_token


recipe_bp = Blueprint("recipe_bp", __name__)

# 10. Recommended Recipes endpoint
@recipe_bp.route("/api/diary/recipes/recommended", methods=["GET"])
def get_recommended_recipes():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    date_str = request.args.get("date")
    raw_cals = str(request.args.get("targetCalories", 2000))
    raw_prot = str(request.args.get("targetProtein", 120))
    if raw_cals.lower().strip() in ["nan", "inf", "-inf"] or raw_prot.lower().strip() in ["nan", "inf", "-inf"]:
        return jsonify({"error": "Invalid numerical parameters"}), 400
    try:
        target_cals = float(raw_cals)
        target_prot = float(raw_prot)
    except ValueError:
        return jsonify({"error": "Invalid numerical parameters"}), 400

    diary_doc = {}
    if date_str:
        try:
            res = diary_table.get_item(Key={"userId": str(user["userId"]), "date": str(date_str)})
            diary_doc = decimal_to_native(res.get("Item", {}))
        except Exception as e:
            print(f"Error fetching diary doc for recipes: {e}")
            diary_doc = {}

    current_cals = 0
    current_prot = 0

    meals = diary_doc.get("meals", {}) if isinstance(diary_doc, dict) else {}
    for m_list in meals.values():
        if isinstance(m_list, list):
            for item in m_list:
                current_cals += item.get("calories", 0)
                current_prot += item.get("protein", 0)

    rem_cals = max(0, target_cals - current_cals)
    rem_prot = max(0, target_prot - current_prot)

    recipes = []
    redis_client = get_redis_client()
    recipes_cache_key = "foods:recipes:all"

    if redis_client:
        try:
            cached_recipes = redis_client.get(recipes_cache_key)
            if cached_recipes:
                import json
                recipes = json.loads(cached_recipes)
        except Exception as e:
            print(f"Redis get recipes error: {e}")

    if not recipes:
        try:
            # Query recipes using CategoryIndex GSI across standard meal categories
            meal_categories = ["Colazione", "Pranzo", "Cena", "Spuntini", "Spuntino"]
            items = []
            for cat in meal_categories:
                try:
                    res = foods_table.query(
                        IndexName=FOODS_CATEGORY_GSI,
                        KeyConditionExpression=Key("category").eq(cat)
                    )
                    items.extend([decimal_to_native(i) for i in res.get("Items", []) if i.get("isRecipe", True)])
                except Exception:
                    pass

            if not items:
                # Fallback to scan if GSI has no match
                scan_kwargs = {"FilterExpression": Attr("isRecipe").eq(True)}
                recipes_res = foods_table.scan(**scan_kwargs)
                items = [decimal_to_native(item) for item in recipes_res.get("Items", [])]

            recipes = items

            # Cache the recipe catalog for 1 hour in Redis
            if redis_client and recipes:
                try:
                    import json
                    redis_client.setex(recipes_cache_key, 3600, json.dumps(recipes))
                except Exception as e:
                    print(f"Redis set recipes error: {e}")

        except Exception as e:
            print(f"Error retrieving recipes: {e}")
            recipes = []


    for r in recipes:
        score = 0
        reasons = []

        if rem_prot > 25 and r.get("protein", 0) >= 20:
            score += 40
            reasons.append("Alto contenuto proteico per il tuo target")
        if rem_cals < 400 and r.get("calories", 0) <= 300:
            score += 30
            reasons.append("Ipocalorico e leggero")
        if r.get("prepTime", 30) <= 15:
            score += 15
            reasons.append("Preparazione rapida in 15 min")

        r["score"] = score
        r["recommendationReason"] = reasons[0] if reasons else "Equilibrato e gustoso"

    # Sort recipes by score
    recipes.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({
        "remainingMacros": {"calories": round(rem_cals), "protein": round(rem_prot)},
        "recommendations": recipes[:50]
    })
