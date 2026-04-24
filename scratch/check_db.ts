import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Credentials not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const tables = ['profiles', 'categories', 'products', 'orders', 'user_roles'];
  console.log(`Checking project: ${process.env.VITE_SUPABASE_PROJECT_ID}`);
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`Table ${table}: Error - ${error.message}`);
    } else {
      console.log(`Table ${table}: ${count} rows`);
    }
  }
}

checkTables();
