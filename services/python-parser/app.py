from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import csv_parser_fixed_v2 as parser

app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/parse")
async def parse(request: Request):
    try:
        body = await request.body()
        csv_text = body.decode("utf-8", errors="replace")
        entries = parser.parse_csv_content(csv_text)
        return JSONResponse(entries)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
