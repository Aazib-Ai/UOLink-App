from typing import List, Dict, Any
import os
import json
import io
import requests
import boto3
from botocore.config import Config

from firebase_functions import https_fn, scheduler_fn
import firebase_admin
from firebase_admin import firestore

import csv_parser_fixed_v2 as timetable_parser


PARSER_SIGNATURE = "advanced-python-firebase-functions-2025-11-26"


def build_csv_url(sheet_id: str, gid: int | str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"


def fetch_google_sheet_csv(sheet_id: str, gid: int | str) -> str:
    url = build_csv_url(sheet_id, gid)
    headers = {
        "Accept": "text/csv,*/*;q=0.8",
        "User-Agent": "UoLink-Timetable-Fetch/1.0",
    }
    r = requests.get(url, headers=headers, timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"Failed to fetch CSV (gid={gid}): {r.status_code} {r.reason}")
    r.encoding = "utf-8"
    return r.text


def parse_timetable_csv(csv_text: str) -> List[Dict[str, Any]]:
    return timetable_parser.parse_csv_content(csv_text)


def build_timetable_json() -> List[Dict[str, Any]]:
    sheet_id = (os.environ.get("SHEET_ID") or "").strip()
    tab_gids_raw = (os.environ.get("TAB_GIDS") or "[]").strip()
    if not sheet_id:
        raise RuntimeError("SHEET_ID is not configured")
    try:
        tabs = json.loads(tab_gids_raw)
    except Exception:
        raise RuntimeError("TAB_GIDS is not valid JSON")
    results: List[Dict[str, Any]] = []
    for t in tabs:
        day = t.get("day")
        gid = t.get("gid")
        csv_text = fetch_google_sheet_csv(sheet_id, gid)
        entries = parse_timetable_csv(csv_text)
        results.append({"day": day, "entries": entries})
    return results


def get_r2_client():
    access_key_id = (os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID") or "").strip()
    secret_access_key = (os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY") or "").strip()
    account_id = (os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID") or "").strip()
    if not access_key_id or not secret_access_key or not account_id:
        raise RuntimeError("Missing R2 credentials (ACCESS_KEY_ID/SECRET_ACCESS_KEY/ACCOUNT_ID)")
    endpoint = (os.environ.get("CLOUDFLARE_R2_ENDPOINT") or f"https://{account_id}.r2.cloudflarestorage.com").strip()
    session = boto3.session.Session()
    client = session.client(
        "s3",
        region_name="auto",
        endpoint_url=endpoint,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        config=Config(s3={"addressing_style": "path"}),
    )
    return client


def publish_timetable_json(object_key: str = "master_timetable.json") -> Dict[str, Any]:
    json_payload = build_timetable_json()
    body = json.dumps(json_payload, ensure_ascii=False, indent=2).encode("utf-8")
    bucket = (os.environ.get("CLOUDFLARE_R2_BUCKET_NAME") or os.environ.get("CLOUDFLARE_R2_BUCKET") or "").strip()
    if not bucket:
        raise RuntimeError("CLOUDFLARE_R2_BUCKET_NAME (or CLOUDFLARE_R2_BUCKET) is not configured")
    client = get_r2_client()
    client.put_object(
        Bucket=bucket,
        Key=object_key,
        Body=body,
        ContentType="application/json; charset=utf-8",
        CacheControl="no-cache, no-store, must-revalidate",
    )
    return {"key": object_key}


@scheduler_fn.on_schedule(
    schedule="0 6 * * *",
    timezone=scheduler_fn.Timezone("Asia/Karachi"),
    secrets=[
        "SHEET_ID",
        "TAB_GIDS",
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
        "CLOUDFLARE_R2_ACCOUNT_ID",
        "CLOUDFLARE_R2_BUCKET_NAME",
        "CLOUDFLARE_R2_ENDPOINT",
    ],
)
def schedule_timetable_fetch(event: scheduler_fn.ScheduledEvent) -> None:
    try:
        res = publish_timetable_json()
        print("[Timetable Sync] Published to R2:", res.get("key"))
        print("[Timetable Sync] Parser signature:", PARSER_SIGNATURE)
    except Exception as e:
        print("[Timetable Sync] Error:", str(e))
        raise


@https_fn.on_request(
    secrets=[
        "SHEET_ID",
        "TAB_GIDS",
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
        "CLOUDFLARE_R2_ACCOUNT_ID",
        "CLOUDFLARE_R2_BUCKET_NAME",
        "CLOUDFLARE_R2_ENDPOINT",
    ],
)
def run_timetable_fetch(req: https_fn.Request) -> https_fn.Response:
    try:
        res = publish_timetable_json()
        return https_fn.Response(json.dumps({"ok": True, "key": res.get("key")}), mimetype="application/json")
    except Exception as e:
        return https_fn.Response(json.dumps({"ok": False, "error": str(e)}), status=500, mimetype="application/json")

 
