const { pipeline, Transform } = require('stream');
const { promisify } = require('util');
const fs = require('fs');
const QueryStream = require('pg-query-stream');
const pipelineAsync = promisify(pipeline);

async function runExport(pool, jobId, filters, options) {
    const client = await pool.connect();
    const filePath = `${process.env.EXPORT_STORAGE_PATH}/export_${jobId}.csv`;
    
    try {
        await pool.query('UPDATE export_jobs SET status = $1 WHERE id = $2', ['processing', jobId]);
        let queryText = `SELECT ${options.columns || '*'} FROM users WHERE 1=1`;
        const params = [];
        if (filters.country_code) { params.push(filters.country_code); queryText += ` AND country_code = $${params.length}`; }
        if (filters.subscription_tier) { params.push(filters.subscription_tier); queryText += ` AND subscription_tier = $${params.length}`; }

        const query = new QueryStream(queryText, params);
        const dbStream = client.query(query);

        let count = 0;
        const csvTransformer = new Transform({
            writableObjectMode: true,
            transform(row, encoding, callback) {
                if (count === 0) {
                    this.push(Object.keys(row).join(options.delimiter) + '\n');
                }
                const line = Object.values(row)
                    .map(v => `${options.quoteChar}${v}${options.quoteChar}`)
                    .join(options.delimiter);
                this.push(line + '\n');
                
                count++;
                if (count % 10000 === 0) { 
                    pool.query('UPDATE export_jobs SET processed_rows = $1 WHERE id = $2', [count, jobId]);
                }
                callback();
            }
        });

        await pipelineAsync(
            dbStream,
            csvTransformer,
            fs.createWriteStream(filePath)
        );

        await pool.query(
            'UPDATE export_jobs SET status = $1, completed_at = NOW(), processed_rows = $2 WHERE id = $3', 
            ['completed', count, jobId]
        );
    } catch (err) {
        console.error(`Job ${jobId} failed:`, err);
        await pool.query('UPDATE export_jobs SET status = $1, error_message = $2 WHERE id = $3', ['failed', err.message, jobId]);
    } finally {
        client.release();
    }
}

module.exports = { runExport };