"""Fetch species photos from iNaturalist API for species missing images."""
import json
import time
import urllib.request
import urllib.parse
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

PHOTOS_FILE = "frontend/public/data/species-photos.json"
APP_DATA_FILE = "frontend/public/data/app-data.json"

with open(APP_DATA_FILE) as f:
    app_data = json.load(f)
with open(PHOTOS_FILE) as f:
    photos = json.load(f)

species_ids = [n["id"] for n in app_data.get("nodes", [])]
missing = [s for s in species_ids if s not in photos]
print(f"{len(missing)} species missing photos", flush=True)

found = 0
failed = []

for i, name in enumerate(missing):
    try:
        url = f"https://api.inaturalist.org/v1/taxa?q={urllib.parse.quote(name)}&per_page=5"
        req = urllib.request.Request(url, headers={"User-Agent": "BioScope/1.0"})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            data = json.loads(resp.read())

        photo_url = None
        for result in data.get("results", []):
            if result.get("name", "").lower() == name.lower():
                dp = result.get("default_photo")
                if dp and dp.get("medium_url"):
                    photo_url = dp["medium_url"]
                    break

        if not photo_url and data.get("results"):
            dp = data["results"][0].get("default_photo")
            if dp and dp.get("medium_url"):
                photo_url = dp["medium_url"]

        if photo_url:
            photos[name] = photo_url
            found += 1
        else:
            failed.append(name)

        if (i + 1) % 25 == 0:
            print(f"  {i+1}/{len(missing)} processed, {found} found", flush=True)
            with open(PHOTOS_FILE, "w") as f:
                json.dump(photos, f, indent=2)

        time.sleep(0.5)

    except Exception as e:
        failed.append(name)
        if (i + 1) % 25 == 0:
            print(f"  {i+1}/{len(missing)} processed, {found} found (error: {e})", flush=True)

with open(PHOTOS_FILE, "w") as f:
    json.dump(photos, f, indent=2)

print(f"\nDone! Found {found}/{len(missing)} photos. {len(failed)} failed.", flush=True)
if failed:
    print(f"Failed species: {failed[:10]}{'...' if len(failed) > 10 else ''}", flush=True)
