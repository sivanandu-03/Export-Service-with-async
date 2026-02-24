# Large-Scale CSV Export Service

A high-performance, containerized Node.js service designed to export millions of database records (10M+) to CSV format. This project demonstrates advanced backend patterns including **Asynchronous I/O**, **Database Cursors**, **Backpressure Handling**, and **Pipelined Data Streaming**.

## 🏗 Architecture Overview

The system architecture is designed to maintain a flat memory footprint regardless of the dataset size.

1. **API Layer**: Handles job orchestration and status tracking.
2. **Background Worker**: Uses `pg-query-stream` to pull rows in batches.
3. **Stream Pipeline**: Data flows through a `Transform` stream (JSON to CSV) and is piped directly to a `WriteStream` on the local disk.
4. **Backpressure**: The pipeline automatically pauses the database fetch if the disk I/O or network download is slower than the data source.

---

## 🚀 Getting Started

### Prerequisites

* Docker and Docker Compose
* Disk space: ~1GB (to accommodate 10M rows in Postgres and the resulting CSV files)

### Installation

1. Clone the repository.
2. Build and start the containers:
```bash
docker-compose up --build

```


3. **Seeding**: Upon the first startup, the `db` service will automatically execute `seeds/init.sql`, generating **10,000,000 users**. This process takes approximately 1-2 minutes depending on your hardware.

---

## 📡 API Reference

### 1. Initiate Export

Starts a background export job with optional filters and formatting.

**Endpoint**: `POST /exports/csv`

| Parameter | Type | Description |
| --- | --- | --- |
| `country_code` | Query | Filter by 2-letter country code (e.g., `US`). |
| `subscription_tier` | Query | Filter by `free`, `pro`, or `enterprise`. |
| `columns` | Query | Comma-separated list of columns (e.g., `id,email`). |
| `delimiter` | Query | CSV field separator (Default: `,`). |
| `quoteChar` | Query | CSV quote character (Default: `"`). |

**Example**:

```bash
curl -X POST "http://localhost:8080/exports/csv?country_code=US&columns=id,email&delimiter=|"

```

### 2. Check Job Status

Poll the progress of an active or completed job.

**Endpoint**: `GET /exports/{exportId}/status`

### 3. Download CSV

Streams the completed file. Supports **Gzip compression** and **Resumable Downloads**.

**Endpoint**: `GET /exports/{exportId}/download`

* **For Gzip**: Include header `Accept-Encoding: gzip`.
* **For Resumable**: Supports `Range: bytes=0-1024`.

### 4. Cancel Export

Stops the background worker and deletes the temporary file.

**Endpoint**: `DELETE /exports/{exportId}`

---

## 🛠 Resource Management

This service is strictly limited to **150MB of RAM** (defined in `docker-compose.yml`).

### Verification of Memory Limit:

While a large export is running, monitor the container stats:

```bash
docker stats exporter_app

```

### Performance Features:

* **Indices**: Optimized B-Tree indices on `country_code` and `subscription_tier`.
* **Streaming**: No large arrays are created; memory remains stable during 10M row processing.
* **Non-blocking**: The `/health` endpoint remains responsive (<200ms) even during heavy exports.

---

## 📂 Project Structure

```text
.
├── exports/             # Temporary CSV storage (Volume)
├── seeds/               # Database initialization scripts
├── src/
│   ├── index.js         # API Routes & Express Setup
│   └── worker.js        # Streaming & DB Cursor Logic
├── Dockerfile
├── docker-compose.yml
└── package.json

```

---

## 🧪 Testing Backpressure

To verify the system handles backpressure, simulate a slow client:

```bash
curl --limit-rate 50k http://localhost:8080/exports/{id}/download -o test.csv

```

Observe that the application memory does not increase, as the internal Node.js buffer pauses the database stream until the client is ready for more data.

---
