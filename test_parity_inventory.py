import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
INVENTORY = ROOT / "BAMBU_PARITE_ENVANTERI.json"
REQUIRED = {"id", "area", "bambu", "ours", "capability", "status", "acceptance", "evidence"}
STATUSES = {"implemented", "partial", "planned", "capability-gated"}


def main() -> None:
    data = json.loads(INVENTORY.read_text(encoding="utf-8"))
    assert data["schema"] == "bambu-parity-inventory-v1"
    items = data["items"]
    assert len(items) >= 35
    ids = [item["id"] for item in items]
    assert len(ids) == len(set(ids)), "parity ids must be unique"
    for item in items:
        missing = REQUIRED - set(item)
        assert not missing, f"{item.get('id')} missing {sorted(missing)}"
        assert item["status"] in STATUSES, f"invalid status for {item['id']}"
        assert all(str(item[field]).strip() for field in REQUIRED), f"blank field in {item['id']}"
        evidence_path = ROOT / item["evidence"].split("#", 1)[0]
        assert evidence_path.exists(), f"missing evidence for {item['id']}: {evidence_path}"
    print(f"PASS parity inventory: {len(items)} unique feature families")


if __name__ == "__main__":
    main()
