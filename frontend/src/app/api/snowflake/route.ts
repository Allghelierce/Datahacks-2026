import { NextRequest, NextResponse } from "next/server";
import snowflake from "snowflake-sdk";

snowflake.configure({ logLevel: "OFF" });

function getConnection(): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT!,
      username: process.env.SNOWFLAKE_USER!,
      password: process.env.SNOWFLAKE_PASSWORD!,
      database: "BIOSCOPE",
      schema: "PUBLIC",
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
    });
    conn.connect((err, c) => (err ? reject(err) : resolve(c)));
  });
}

function executeQuery(conn: snowflake.Connection, sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows || [])),
    });
  });
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  const species = req.nextUrl.searchParams.get("species");
  const zone = req.nextUrl.searchParams.get("zone");

  try {
    const conn = await getConnection();

    let rows: any[];

    switch (action) {
      case "analyze_species":
        if (!species) return NextResponse.json({ error: "species param required" }, { status: 400 });
        rows = await executeQuery(conn, `SELECT analyze_species('${species.replace(/'/g, "''")}') AS analysis`);
        return NextResponse.json({ analysis: rows[0]?.ANALYSIS });

      case "zone_biodiversity":
        rows = await executeQuery(conn, "SELECT * FROM zone_biodiversity LIMIT 50");
        return NextResponse.json({ zones: rows });

      case "species_rankings":
        rows = await executeQuery(conn, "SELECT * FROM species_rankings LIMIT 30");
        return NextResponse.json({ species: rows });

      case "yearly_trends":
        rows = await executeQuery(conn, "SELECT * FROM yearly_trends");
        return NextResponse.json({ trends: rows });

      case "taxonomic_breakdown":
        rows = await executeQuery(conn, "SELECT * FROM taxonomic_breakdown");
        return NextResponse.json({ breakdown: rows });

      case "cortex_analyze":
        if (!zone) return NextResponse.json({ error: "zone param required" }, { status: 400 });
        const safeZone = zone.replace(/'/g, "''");
        rows = await executeQuery(conn, `
          SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large',
            CONCAT('You are a conservation ecologist. Analyze the biodiversity of the ',
              '${safeZone}',
              ' zone in San Diego County in 3-4 sentences. Species count: ',
              (SELECT unique_species::VARCHAR FROM zone_biodiversity WHERE zone LIKE '%${safeZone}%' LIMIT 1),
              '. Observations: ',
              (SELECT total_observations::VARCHAR FROM zone_biodiversity WHERE zone LIKE '%${safeZone}%' LIMIT 1),
              '. Provide ecological assessment and conservation recommendations.')
          ) AS analysis
        `);
        return NextResponse.json({ analysis: rows[0]?.ANALYSIS });

      default:
        return NextResponse.json({ error: "Unknown action. Use: analyze_species, zone_biodiversity, species_rankings, yearly_trends, taxonomic_breakdown, cortex_analyze" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
