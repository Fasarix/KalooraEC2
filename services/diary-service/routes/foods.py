import json
from flask import Blueprint, request, jsonify
from boto3.dynamodb.conditions import Attr, Key
from database import foods_table, decimal_to_native, native_to_decimal, FOODS_CATEGORY_GSI, get_redis_client
from middleware.auth import get_user_from_token

food_bp = Blueprint("food_bp", __name__)

# 1. Search food / recipes with Redis Caching and GSI Acceleration
@food_bp.route("/api/food/search", methods=["GET"])
def search_food():
    query = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()
    is_recipe = request.args.get("isRecipe")

    redis_client = get_redis_client()
    cache_key = f"foods:search:{query.lower()}:{category.lower()}:{is_recipe}"

    # Check cache first (< 1ms response time)
    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                return jsonify(json.loads(cached_data))
        except Exception as e:
            print(f"Redis get cache error: {e}")

    results = []
    try:
        if category:
            # High-performance GSI Query when category is provided
            key_exp = Key("category").eq(category)
            query_kwargs = {
                "IndexName": FOODS_CATEGORY_GSI,
                "KeyConditionExpression": key_exp,
                "Limit": 50
            }
            if query:
                query_kwargs["FilterExpression"] = Attr("name").contains(query) | Attr("name").contains(query.capitalize()) | Attr("name").contains(query.lower())
            
            response = foods_table.query(**query_kwargs)
            results = [decimal_to_native(item) for item in response.get("Items", [])]
        else:
            # Filtered scan with pagination cap
            filter_exp = None
            if query:
                exp = Attr("name").contains(query) | Attr("name").contains(query.capitalize()) | Attr("name").contains(query.lower())
                filter_exp = exp if filter_exp is None else filter_exp & exp

            if is_recipe is not None:
                exp = Attr("isRecipe").eq(is_recipe.lower() == "true")
                filter_exp = exp if filter_exp is None else filter_exp & exp

            scan_kwargs = {}
            if filter_exp is not None:
                scan_kwargs["FilterExpression"] = filter_exp

            items = []
            done = False
            start_key = None

            while not done and len(items) < 50:
                if start_key:
                    scan_kwargs["ExclusiveStartKey"] = start_key
                response = foods_table.scan(**scan_kwargs)
                batch = [decimal_to_native(item) for item in response.get("Items", [])]
                items.extend(batch)
                start_key = response.get("LastEvaluatedKey")
                done = start_key is None

            results = items[:50]

        # Cache search results for 10 minutes (600s)
        if redis_client:
            try:
                redis_client.setex(cache_key, 600, json.dumps(results))
            except Exception as e:
                print(f"Redis set cache error: {e}")

    except Exception as e:
        print(f"Error searching DynamoDB foods: {e}")
        results = []

    return jsonify(results)

# 2. Create new custom food item (with Cache Invalidation)
@food_bp.route("/api/food", methods=["POST"])
def create_food():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    name = data.get("name")
    calories = data.get("calories")

    if not name or calories is None:
        return jsonify({"error": "Name and calories are required"}), 400

    try:
        cals_val = int(calories)
        carbs_val = float(data.get("carbs", 0))
        prot_val = float(data.get("protein", 0))
        fat_val = float(data.get("fat", 0))

        if cals_val < 0 or cals_val > 10000 or carbs_val < 0 or carbs_val > 1000 or prot_val < 0 or prot_val > 1000 or fat_val < 0 or fat_val > 1000:
            return jsonify({"error": "Nutritional values out of realistic range"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numeric value for calories, carbs, protein or fat"}), 400

    new_food = {
        "name": str(name).strip(),
        "calories": cals_val,
        "carbs": carbs_val,
        "protein": prot_val,
        "fat": fat_val,
        "unit": data.get("unit", "100g"),
        "category": "Personalizzati",
        "isRecipe": False,
        "createdBy": str(user["userId"])
    }

    try:
        foods_table.put_item(Item=native_to_decimal(new_food))

        # Invalidate search cache in Redis so that new custom foods are visible immediately
        redis_client = get_redis_client()
        if redis_client:
            try:
                for key in redis_client.scan_iter("foods:search:*"):
                    redis_client.delete(key)
            except Exception as e:
                print(f"Redis cache invalidate error: {e}")

    except Exception as e:
        print(f"Error putting item into DynamoDB foods: {e}")
        return jsonify({"error": "Database error creating food"}), 500

    return jsonify(new_food), 201

