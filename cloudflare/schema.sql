PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS mystery_snapshots (
  id TEXT PRIMARY KEY,
  metadata TEXT NOT NULL CHECK(json_valid(metadata))
);
CREATE TABLE IF NOT EXISTS mystery_characters (
  snapshot_id TEXT NOT NULL REFERENCES mystery_snapshots(id),
  row_no INTEGER NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  PRIMARY KEY(snapshot_id, row_no)
);
CREATE TABLE IF NOT EXISTS mystery_publication (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  snapshot_id TEXT NOT NULL REFERENCES mystery_snapshots(id)
);
