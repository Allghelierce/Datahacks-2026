import json
import os
import snowflake.connector
import google.generativeai as genai

def get_snowflake_conn():
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        database=os.environ.get("SNOWFLAKE_DATABASE", "BIOSCOPE"),
        schema=os.environ.get("SNOWFLAKE_SCHEMA", "PUBLIC"),
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
    )


def query_snowflake(sql: str, params: tuple = ()):
    conn = get_snowflake_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        columns = [desc[0].lower() for desc in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def cors_response(status_code: int, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body, default=str),
    }


def handle_get_regions(event):
    rows = query_snowflake("SELECT * FROM region_rankings")
    return cors_response(200, {"regions": rows})


def handle_get_region_detail(event, region_id: str):
    region = region_id.replace("-", " ").title()

    summary = query_snowflake(
        "SELECT * FROM regional_biodiversity WHERE region = %s", (region,)
    )
    if not summary:
        return cors_response(404, {"error": "Region not found"})

    trends = query_snowflake(
        "SELECT * FROM temporal_trends WHERE region = %s ORDER BY year_month",
        (region,),
    )

    decline = query_snowflake(
        "SELECT * FROM declining_regions WHERE region = %s", (region,)
    )

    return cors_response(200, {
        "region": summary[0],
        "trends": trends,
        "decline_info": decline[0] if decline else None,
    })


def handle_get_trends(event):
    rows = query_snowflake("SELECT * FROM monthly_trends")
    declining = query_snowflake("SELECT * FROM declining_regions LIMIT 10")
    return cors_response(200, {"monthly_trends": rows, "declining_regions": declining})


def handle_explain(event):
    body = json.loads(event.get("body", "{}"))
    region_name = body.get("region")
    region_data = body.get("data", {})

    if not region_name:
        return cors_response(400, {"error": "region is required"})

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel("gemini-2.0-flash")

    prompt = f"""You are an ecology expert. Analyze the biodiversity data for {region_name} and explain the trends in plain English.

Data:
- Biodiversity Score (Shannon Index): {region_data.get('biodiversity_score', 'N/A')}
- Unique Species Observed: {region_data.get('unique_species', 'N/A')}
- Total Observations: {region_data.get('total_observations', 'N/A')}
- Species Change Over Time: {region_data.get('species_change', 'N/A')}
- Percent Change: {region_data.get('pct_change', 'N/A')}%

Provide:
1. A 2-sentence summary of the biodiversity health of this region
2. Key factors that likely contribute to the observed trends (urbanization, climate, conservation efforts, etc.)
3. One actionable recommendation

Keep the response under 200 words and accessible to a general audience."""

    response = model.generate_content(prompt)

    return cors_response(200, {
        "region": region_name,
        "explanation": response.text,
    })


def lambda_handler(event, context):
    method = event.get("httpMethod", "GET")
    path = event.get("path", "")

    if method == "OPTIONS":
        return cors_response(200, {})

    try:
        if path == "/regions" and method == "GET":
            return handle_get_regions(event)
        elif path.startswith("/regions/") and method == "GET":
            region_id = path.split("/regions/")[1]
            return handle_get_region_detail(event, region_id)
        elif path == "/trends" and method == "GET":
            return handle_get_trends(event)
        elif path == "/explain" and method == "POST":
            return handle_explain(event)
        else:
            return cors_response(404, {"error": "Not found"})
    except Exception as e:
        print(f"Error: {e}")
        return cors_response(500, {"error": str(e)})
