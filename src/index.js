const express = require('express');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const zlib = require('zlib');
const { runExport } = require('./worker');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 1. POST: Initiate Export
app.post('/exports/csv', async (req, res) => {
    const jobId = uuidv4();
    const { country_code, subscription_tier, columns, delimiter = ',', quoteChar = '"' } = req.query;

    await pool.query('INSERT INTO export_jobs (id, status) VALUES ($1, $2)', [jobId, 'pending']);
    
    // Non-blocking background call
    runExport(pool, jobId, { country_code, subscription_tier }, { columns, delimiter, quoteChar });

    res.status(202).json({ exportId: jobId, status: 'pending' });
});

// 2. GET: Status
app.get('/exports/:id/status', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM export_jobs WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).send();
    
    const job = rows[0];
    res.json({
        exportId: job.id,
        status: job.status,
        progress: { processedRows: job.processed_rows, percentage: job.status === 'completed' ? 100 : null },
        error: job.error_message,
        createdAt: job.created_at
    });
});

// 3. GET: Download (with Gzip & Range Support)
app.get('/exports/:id/download', async (req, res) => {
    const filePath = `${process.env.EXPORT_STORAGE_PATH}/export_${req.params.id}.csv`;
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Job not finished" });

    const stats = fs.statSync(filePath);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="export_${req.params.id}.csv"`);
    res.setHeader('Accept-Ranges', 'bytes');

    if (req.headers['accept-encoding']?.includes('gzip')) {
        res.setHeader('Content-Encoding', 'gzip');
        fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
    } else {
        res.setHeader('Content-Length', stats.size);
        fs.createReadStream(filePath).pipe(res);
    }
});

// 4. DELETE: Cancel/Cleanup
app.delete('/exports/:id', async (req, res) => {
    const filePath = `${process.env.EXPORT_STORAGE_PATH}/export_${req.params.id}.csv`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM export_jobs WHERE id = $1', [req.params.id]);
    res.status(204).send();
});

// 5. Health Check
app.get('/health', (req, res) => res.json({ status: "ok" }));

app.listen(8080, () => console.log('Service running on 8080'));