import re
from flask import Blueprint, request, jsonify
from boto3.dynamodb.conditions import Key
from database import foods_table, diary_table, decimal_to_native, native_to_decimal
from middleware.auth import get_user_from_token
from events.sqs_publisher import publish_event

diary_bp = Blueprint("diary_bp", __name__)

VALID_MEAL_TYPES = {"breakfast", "lunch", "dinner", "snack"}
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

def _is_valid_date(date_str):
    return bool(date_str and isinstance(date_str, str) and DATE_PATTERN.match(date_str))

def _get_or_create_diary_doc(user_id, date_str):
    """Helper to fetch or instantiate a diary document for a given user and date."""
    res = diary_table.get_item(Key={"userId": str(user_id), "date": date_str})
    doc = res.get("Item")
    if not doc:
        doc = {
            "userId": str(user_id),
            "date": date_str,
            "meals": {
                "breakfast": [],
                "lunch": [],
                "dinner": [],
                "snack": []
            },
            "activities": [],
            "water": 0
        }
    else:
        doc = decimal_to_native(doc)
        if "meals" not in doc:
            doc["meals"] = {"breakfast": [], "lunch": [], "dinner": [], "snack": []}
        if "activities" not in doc:
            doc["activities"] = []
        if "water" not in doc:
            doc["water"] = 0
    return doc

# 3. Get Diary for a specific date
@diary_bp.route("/api/diary", methods=["GET"])
def get_diary():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    date_str = request.args.get("date")
    if not _is_valid_date(date_str):
        return jsonify({"error": "Valid date in YYYY-MM-DD format required"}), 400

    doc = _get_or_create_diary_doc(user["userId"], date_str)
    return jsonify(doc)

# 3b. Batch Get Diary entries for a date range
@diary_bp.route("/api/diary/range", methods=["GET"])
def get_diary_range():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    start_date = request.args.get("startDate")
    end_date = request.args.get("endDate")
    if not _is_valid_date(start_date) or not _is_valid_date(end_date):
        return jsonify({"error": "Valid startDate and endDate in YYYY-MM-DD format required"}), 400

    try:
        query_res = diary_table.query(
            KeyConditionExpression=Key("userId").eq(str(user["userId"])) & Key("date").between(start_date, end_date)
        )
        items = [decimal_to_native(item) for item in query_res.get("Items", [])]
        result_map = {item["date"]: item for item in items}
    except Exception as e:
        print(f"Error querying DynamoDB diary table range: {e}")
        result_map = {}

    return jsonify(result_map)

# 4. Add food item to meal (with SQS event publish)
@diary_bp.route("/api/diary/meal", methods=["POST"])
def add_meal_item():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    date_str = data.get("date")
    meal_type = data.get("mealType")
    food_name = data.get("foodName")

    if not _is_valid_date(date_str):
        return jsonify({"error": "Valid date (YYYY-MM-DD) required"}), 400

    if not meal_type or str(meal_type).lower() not in VALID_MEAL_TYPES:
        return jsonify({"error": f"mealType must be one of: {list(VALID_MEAL_TYPES)}"}), 400

    meal_type = str(meal_type).lower()

    if not food_name or not isinstance(food_name, str) or not food_name.strip():
        return jsonify({"error": "foodName is required"}), 400

    try:
        quantity = float(data.get("quantity", 100))
        if quantity <= 0 or quantity > 10000:
            return jsonify({"error": "Quantity must be between 0 and 10000"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid quantity"}), 400

    food_res = foods_table.get_item(Key={"name": str(food_name).strip()})
    food = food_res.get("Item")
    if not food:
        return jsonify({"error": "Food item not found"}), 404

    food = decimal_to_native(food)
    unit_str = str(food.get("unit", "")).lower()
    multiplier = (quantity / 100.0) if ("100" in unit_str) else quantity
    item_cals = round(food["calories"] * multiplier)
    item_carbs = round(food.get("carbs", 0) * multiplier, 1)
    item_prot = round(food.get("protein", 0) * multiplier, 1)
    item_fat = round(food.get("fat", 0) * multiplier, 1)

    meal_item = {
        "foodName": food["name"],
        "quantity": quantity,
        "calories": item_cals,
        "carbs": item_carbs,
        "protein": item_prot,
        "fat": item_fat
    }

    doc = _get_or_create_diary_doc(user["userId"], date_str)
    if meal_type not in doc["meals"]:
        doc["meals"][meal_type] = []

    doc["meals"][meal_type].append(meal_item)
    diary_table.put_item(Item=native_to_decimal(doc))

    publish_event("MEAL_ADDED", user["userId"], date_str, meal_item)
    return jsonify({"message": "Meal item added successfully", "item": meal_item})

# 5. Update meal item quantity
@diary_bp.route("/api/diary/meal", methods=["PUT"])
def update_meal_item():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    date_str = data.get("date")
    meal_type = data.get("mealType")
    item_index = data.get("itemIndex")

    if not _is_valid_date(date_str):
        return jsonify({"error": "Valid date (YYYY-MM-DD) required"}), 400

    if not meal_type or str(meal_type).lower() not in VALID_MEAL_TYPES or item_index is None:
        return jsonify({"error": "Valid date, mealType, and itemIndex required"}), 400

    meal_type = str(meal_type).lower()

    try:
        new_quantity = float(data.get("quantity", 100))
        item_index = int(item_index)
        if new_quantity <= 0 or new_quantity > 10000:
            return jsonify({"error": "Quantity must be between 0 and 10000"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid quantity or itemIndex"}), 400

    doc = _get_or_create_diary_doc(user["userId"], date_str)
    if "meals" not in doc or meal_type not in doc["meals"] or item_index < 0 or item_index >= len(doc["meals"][meal_type]):
        return jsonify({"error": "Item not found"}), 404

    target_item = doc["meals"][meal_type][item_index]
    food_name = target_item["foodName"]
    food_res = foods_table.get_item(Key={"name": str(food_name)})
    food = food_res.get("Item")

    if food:
        food = decimal_to_native(food)
        unit_str = str(food.get("unit", "")).lower()
        multiplier = (new_quantity / 100.0) if ("100" in unit_str) else new_quantity
        target_item["quantity"] = new_quantity
        target_item["calories"] = round(food["calories"] * multiplier)
        target_item["carbs"] = round(food.get("carbs", 0) * multiplier, 1)
        target_item["protein"] = round(food.get("protein", 0) * multiplier, 1)
        target_item["fat"] = round(food.get("fat", 0) * multiplier, 1)

    doc["meals"][meal_type][item_index] = target_item
    diary_table.put_item(Item=native_to_decimal(doc))

    publish_event("MEAL_UPDATED", user["userId"], date_str, target_item)
    return jsonify({"message": "Meal item updated successfully", "item": target_item})

# 6. Delete meal item
@diary_bp.route("/api/diary/meal", methods=["DELETE"])
def delete_meal_item():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    date_str = data.get("date")
    meal_type = data.get("mealType")
    item_index = data.get("itemIndex")

    if not _is_valid_date(date_str) or not meal_type or item_index is None:
        return jsonify({"error": "Valid date, mealType, itemIndex required"}), 400

    meal_type = str(meal_type).lower()

    try:
        item_index = int(item_index)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid itemIndex"}), 400

    doc = _get_or_create_diary_doc(user["userId"], date_str)
    if "meals" not in doc or meal_type not in doc["meals"] or item_index < 0 or item_index >= len(doc["meals"][meal_type]):
        return jsonify({"error": "Item not found"}), 404

    removed_item = doc["meals"][meal_type].pop(item_index)
    diary_table.put_item(Item=native_to_decimal(doc))

    publish_event("MEAL_REMOVED", user["userId"], date_str, removed_item)
    return jsonify({"message": "Meal item removed successfully", "removedItem": removed_item})

# 7. Update Water Intake
@diary_bp.route("/api/diary/water", methods=["PUT"])
def update_water():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    date_str = data.get("date")

    if not _is_valid_date(date_str):
        return jsonify({"error": "Valid date (YYYY-MM-DD) required"}), 400

    try:
        amount = int(data.get("amount", 0))
        if amount < 0 or amount > 20000:
            return jsonify({"error": "Water amount must be between 0 and 20000 ml"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount"}), 400

    doc = _get_or_create_diary_doc(user["userId"], date_str)
    doc["water"] = amount
    diary_table.put_item(Item=native_to_decimal(doc))

    publish_event("WATER_UPDATED", user["userId"], date_str, {"water": amount})
    return jsonify({"message": "Water intake updated", "water": amount})

# 8. Add Physical Activity
@diary_bp.route("/api/diary/activity", methods=["POST"])
def add_activity():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    date_str = data.get("date")
    name = data.get("name")

    if not _is_valid_date(date_str):
        return jsonify({"error": "Valid date (YYYY-MM-DD) required"}), 400

    if not name or not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Activity name is required"}), 400

    try:
        calories = int(data.get("calories", 0))
        duration = int(data.get("durationMin", 30))
        if calories <= 0 or duration <= 0:
            return jsonify({"error": "Calories and durationMin must be positive integers"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid calories or durationMin"}), 400

    act_item = {"name": name.strip(), "calories": calories, "durationMin": duration}

    doc = _get_or_create_diary_doc(user["userId"], date_str)
    doc["activities"].append(act_item)
    diary_table.put_item(Item=native_to_decimal(doc))

    publish_event("ACTIVITY_ADDED", user["userId"], date_str, act_item)
    return jsonify({"message": "Activity added", "activity": act_item})

# 9. Delete Physical Activity
@diary_bp.route("/api/diary/activity", methods=["DELETE"])
def delete_activity():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    date_str = data.get("date")
    act_index = data.get("activityIndex")

    if not _is_valid_date(date_str) or act_index is None:
        return jsonify({"error": "Valid date and activityIndex required"}), 400

    try:
        act_index = int(act_index)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid activityIndex"}), 400

    doc = _get_or_create_diary_doc(user["userId"], date_str)
    if "activities" not in doc or act_index < 0 or act_index >= len(doc["activities"]):
        return jsonify({"error": "Activity not found"}), 404

    removed_act = doc["activities"].pop(act_index)
    diary_table.put_item(Item=native_to_decimal(doc))

    publish_event("ACTIVITY_REMOVED", user["userId"], date_str, removed_act)
    return jsonify({"message": "Activity removed", "activity": removed_act})
