import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { hashPassword } from '../utils/crypto.js';
import { eq, and } from 'drizzle-orm';

const execAsync = promisify(exec);

const MEDIA_DIR = path.resolve('/home/rover/Projects/Gather/server/data/media');
const TEMP_EXTRACT_DIR = '/tmp/fest_extract_temp';

const ZIP_FILES = [
  '/home/rover/Downloads/WhatsApp Unknown 2026-10-18 at 12.07.45 PM.zip',
  '/home/rover/Downloads/WhatsApp Unknown 2026-10-18 at 12.33.16 PM.zip',
  '/home/rover/Downloads/WhatsApp Unknown 2026-10-18 at 12.33.17 PM.zip'
];

const GUEST_DEFS = [
  { name: 'Rahul', phone: '917717586955' },
  { name: 'Nishchey', phone: '919872637072' },
  { name: 'Mohit', phone: '916239392619' },
  { name: 'Saurabh', phone: '918360906209' },
];

async function run() {
  console.log('1. Setting up or locating event "agc-fest"...');
  let [festEvent] = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.slug, 'agc-fest'))
    .limit(1);

  if (!festEvent) {
    const hostPwHash = await hashPassword('123456');
    [festEvent] = await db
      .insert(schema.event)
      .values({
        name: 'AGC Fest',
        slug: 'agc-fest',
        hostPwHash,
        joinOpen: true,
        requireApproval: false,
        date: new Date().toISOString().split('T')[0],
      })
      .returning();
    console.log(`Created new event: ${festEvent.name} (${festEvent.id})`);
  } else {
    console.log(`Found existing event: ${festEvent.name} (${festEvent.id})`);
  }

  console.log('2. Setting up guests (Rahul, Nishchey, Mohit, Saurabh) with pass 123456...');
  const guests: any[] = [];
  const defaultGuestPwHash = await hashPassword('123456');

  for (const def of GUEST_DEFS) {
    let [g] = await db
      .select()
      .from(schema.guests)
      .where(and(eq(schema.guests.eventId, festEvent.id), eq(schema.guests.phone, def.phone)))
      .limit(1);

    if (!g) {
      [g] = await db
        .insert(schema.guests)
        .values({
          eventId: festEvent.id,
          name: def.name,
          phone: def.phone,
          passwordHash: defaultGuestPwHash,
          status: 'active',
          canDownload: true,
        })
        .returning();
      console.log(`Created guest ${g.name} (${g.phone}) -> ${g.id}`);
    } else {
      console.log(`Found guest ${g.name} (${g.phone}) -> ${g.id}`);
    }
    guests.push(g);
  }

  console.log('3. Extracting zip files...');
  if (fs.existsSync(TEMP_EXTRACT_DIR)) {
    fs.rmSync(TEMP_EXTRACT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_EXTRACT_DIR, { recursive: true });

  for (let i = 0; i < ZIP_FILES.length; i++) {
    const zipPath = ZIP_FILES[i];
    if (!fs.existsSync(zipPath)) {
      console.error(`Zip file not found: ${zipPath}`);
      continue;
    }
    const targetSubdir = path.join(TEMP_EXTRACT_DIR, `archive_${i}`);
    fs.mkdirSync(targetSubdir, { recursive: true });
    console.log(`Unzipping ${zipPath} into ${targetSubdir}...`);
    await execAsync(`unzip -o "${zipPath}" -d "${targetSubdir}"`);
  }

  function getAllFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }

  const extractedFiles = getAllFiles(TEMP_EXTRACT_DIR);
  console.log(`Total extracted files: ${extractedFiles.length}`);

  let mediaCount = 0;
  for (const filePath of extractedFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const isVideo = ['.mp4', '.webm', '.mov', '.ogv'].includes(ext);
    const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);

    if (!isVideo && !isImage) {
      continue;
    }

    // Pick a random guest
    const guest = guests[Math.floor(Math.random() * guests.length)];
    const mediaId = crypto.randomUUID();
    const normalizedExt = isVideo ? ext : '.jpg';

    const guestMediaDir = path.join(MEDIA_DIR, guest.id);
    if (!fs.existsSync(guestMediaDir)) {
      fs.mkdirSync(guestMediaDir, { recursive: true });
    }

    const targetFilePath = path.join(guestMediaDir, `${mediaId}${normalizedExt}`);
    const thumbFilePath = path.join(guestMediaDir, `${mediaId}_thumb.jpg`);

    // Copy to target without "whatsapp" in filename
    fs.copyFileSync(filePath, targetFilePath);
    const stat = fs.statSync(targetFilePath);

    let hasThumb = false;
    if (isVideo) {
      try {
        await execAsync(`ffmpeg -y -ss 00:00:00.500 -i "${targetFilePath}" -vframes 1 -vf "scale=400:-1" "${thumbFilePath}"`);
        if (fs.existsSync(thumbFilePath) && fs.statSync(thumbFilePath).size > 0) {
          hasThumb = true;
        }
      } catch {
        try {
          await execAsync(`ffmpeg -y -ss 00:00:00.000 -i "${targetFilePath}" -vframes 1 -vf "scale=400:-1" "${thumbFilePath}"`);
          if (fs.existsSync(thumbFilePath) && fs.statSync(thumbFilePath).size > 0) {
            hasThumb = true;
          }
        } catch (err) {
          console.warn(`Could not generate thumbnail for video ${mediaId}:`, err);
        }
      }
    } else {
      try {
        await sharp(targetFilePath)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbFilePath);
        hasThumb = true;
      } catch (err) {
        fs.copyFileSync(targetFilePath, thumbFilePath);
        hasThumb = true;
      }
    }

    const relPath = `/media-files/${guest.id}/${mediaId}${normalizedExt}`;
    const relThumb = hasThumb ? `/media-files/${guest.id}/${mediaId}_thumb.jpg` : relPath;

    const [newMedia] = await db
      .insert(schema.media)
      .values({
        id: mediaId,
        eventId: festEvent.id,
        guestId: guest.id,
        kind: isVideo ? 'video' : 'photo',
        path: relPath,
        thumbPath: relThumb,
        sizeBytes: stat.size,
        visibility: 'all',
      })
      .returning();

    // Share with all guests
    for (const g of guests) {
      await db
        .insert(schema.shares)
        .values({
          mediaId: newMedia.id,
          guestId: g.id,
        })
        .onConflictDoNothing();
    }

    mediaCount++;
    console.log(`[${mediaCount}] Imported ${newMedia.kind} (${(stat.size / 1024 / 1024).toFixed(2)}MB) assigned to ${guest.name} -> ${relPath}`);
  }

  // Cleanup temp folder
  fs.rmSync(TEMP_EXTRACT_DIR, { recursive: true, force: true });
  console.log(`Done! Imported ${mediaCount} media files into "AGC Fest" (${festEvent.slug}).`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});
