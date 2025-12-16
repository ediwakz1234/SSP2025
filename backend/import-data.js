// Import data from JSON files to a NEW Supabase project
// UPDATE THESE VALUES with your new project credentials!
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ⚠️ REPLACE WITH YOUR NEW PROJECT CREDENTIALS
const NEW_SUPABASE_URL = 'https://YOUR_NEW_PROJECT.supabase.co';
const NEW_SERVICE_ROLE_KEY = 'YOUR_NEW_SERVICE_ROLE_KEY';

const supabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY);

const exportDir = './data_export';

// Tables to import (order matters for foreign keys)
const tables = [
    'businesses',        // Core business data
    'business_raw',
    'businesses_raw',
    'profiles',          // User profiles
    'admin_profiles',
    'activity_logs',
    'clustering_opportunities',
];

async function importData() {
    console.log('Starting data import to NEW Supabase project...\n');
    console.log('⚠️  Make sure you have created the tables first (run schema.sql)\n');

    for (const table of tables) {
        const filePath = path.join(exportDir, `${table}.json`);

        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ Skipping ${table}: file not found`);
            continue;
        }

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            if (!data || data.length === 0) {
                console.log(`⏭️ Skipping ${table}: no records`);
                continue;
            }

            console.log(`Importing ${table} (${data.length} records)...`);

            // Insert in batches of 100
            const batchSize = 100;
            let imported = 0;

            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);

                const { error } = await supabase
                    .from(table)
                    .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });

                if (error) {
                    console.log(`  ❌ Error at batch ${i}: ${error.message}`);
                } else {
                    imported += batch.length;
                }
            }

            console.log(`  ✅ Imported ${imported} records`);
        } catch (err) {
            console.log(`  ❌ Failed: ${err.message}`);
        }
    }

    console.log('\n✅ Import complete!');
}

// Check if credentials are set
if (NEW_SUPABASE_URL.includes('YOUR_NEW_PROJECT')) {
    console.log('❌ Please update NEW_SUPABASE_URL and NEW_SERVICE_ROLE_KEY first!');
    console.log('   Edit this file and replace the placeholder values.\n');
    process.exit(1);
}

importData();
