import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY is not defined in environment variables.');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

const TEMPLATES_DIR = path.join(__dirname, '../src/email/templates');

async function getAllResendTemplates() {
  let allTemplates: any[] = [];
  let hasMore = true;
  let after: string | undefined = undefined;

  console.log('🔄 Fetching existing templates from Resend...');

  while (hasMore) {
    try {
      // @ts-ignore
      const response = await resend.templates.list({
        limit: 100, // Max limit
        after,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data?.data || [];
      allTemplates = [...allTemplates, ...data];

      // Pagination logic based on response structure
      // Note: The Resend Node SDK list response type might vary, checking available props
      // Assuming straightforward pagination if 'has_more' is present in the response object wrapper
      // If the SDK returns { data: [...], has_more: boolean }

      // Based on user provided example:
      // { object: 'list', data: [...], has_more: false }

      if (response.data && 'has_more' in response.data) {
        hasMore = response.data.has_more;
      } else {
        hasMore = false;
      }

      if (hasMore && data.length > 0) {
        after = data[data.length - 1].id;
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error('❌ Error fetching templates:', error);
      process.exit(1);
    }
  }

  console.log(`✅ Found ${allTemplates.length} existing templates.`);
  return allTemplates;
}

async function syncTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.error(`❌ Templates directory not found at: ${TEMPLATES_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((file) => file.endsWith('.hbs'));
  const existingTemplates = await getAllResendTemplates();
  const existingSlugs = new Set(
    existingTemplates.map((t) => t.alias || t.name),
  );

  console.log(`📂 Found ${files.length} local template files.`);

  for (const file of files) {
    const slug = path.basename(file, '.hbs');
    console.log(`\nProcessing: ${slug}`);

    if (existingSlugs.has(slug)) {
      console.log(`  ⏭️  Template "${slug}" already exists. Skipping.`);
      continue;
    }

    console.log(`  ✨ Creating template "${slug}"...`);

    try {
      const content = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8');

      const { data, error } = await resend.templates.create({
        name: slug,
        html: content,
        alias: slug, // Using slug as alias for easier reference
      });

      if (error) {
        console.error(
          `  ❌ Failed to create template "${slug}":`,
          error.message,
        );
      } else {
        console.log(`  ✅ Template created successfully! ID: ${data?.id}`);
      }
    } catch (err) {
      console.error(`  ❌ Error processing file ${file}:`, err);
    }
  }

  console.log('\n🎉 Synchronization complete!');
}

syncTemplates();
