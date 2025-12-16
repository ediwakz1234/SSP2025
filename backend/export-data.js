// Export all Supabase data to JSON files - NO ROW LIMIT
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://wundkfxjbzpqsfvctxoa.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bmRrZnhqYnpwcXNmdmN0eG9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjU5MzQ3OSwiZXhwIjoyMDc4MTY5NDc5fQ.Z370FJFEgLkWUf8KfCz-OxQoqFjU8XA_qdVOI0FjuUI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const tables = [
    'businesses',
    'users',
    'profiles',
    'clustering_results',
    'activity_logs',
    'admin_profiles',
    'seed_businesses',
    'clustering_opportunities',
    'enhanced_data',
    'business_raw',
    'businesses_raw',
    'analytics_cache',
    'model_metadata',
    'optimal_k'
];

const exportDir = './data_export';

// Fetch ALL records using pagination
async function fetchAllRecords(table) {
    const allRecords = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(offset, offset + pageSize - 1);

        if (error) throw error;

        allRecords.push(...(data || []));

        if (!data || data.length < pageSize) {
            hasMore = false;
        } else {
            offset += pageSize;
        }
    }

    return allRecords;
}

async function exportData() {
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }

    console.log('Starting FULL data export from Supabase (no row limit)...\n');

    for (const table of tables) {
        try {
            console.log(`Exporting ${table}...`);
            const data = await fetchAllRecords(table);

            const filePath = path.join(exportDir, `${table}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`  ✅ Exported ${data.length} records to ${filePath}`);
        } catch (err) {
            console.log(`  ❌ Failed: ${err.message}`);
        }
    }

    console.log('\n✅ Export complete! Files saved in:', exportDir);
}

exportData();
