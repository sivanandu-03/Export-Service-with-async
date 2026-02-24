CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    signup_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    country_code CHAR(2) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    lifetime_value NUMERIC(10, 2) DEFAULT 0.00
);

-- Efficiently seed 10 million rows
INSERT INTO users (name, email, country_code, subscription_tier, lifetime_value)
SELECT 
    'User_' || i,
    'user' || i || '@example.com',
    (ARRAY['US', 'GB', 'CA', 'DE', 'FR', 'IN', 'JP', 'BR'])[floor(random() * 8 + 1)],
    (ARRAY['free', 'pro', 'enterprise'])[floor(random() * 3 + 1)],
    (random() * 5000)::numeric(10,2)
FROM generate_series(1, 10000000) s(i);

CREATE INDEX idx_users_country_code ON users(country_code);
CREATE INDEX idx_users_subscription_tier ON users(subscription_tier);

-- Job metadata table
CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'pending',
    processed_rows INT DEFAULT 0,
    total_rows INT DEFAULT 0,
    file_path TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);