# Property image sizing and storage

## Measured UI requirement

PomaaaloDesk currently has no property-photo gallery or full-screen lightbox. Property photos appear only as visual identifiers.

| Surface | Largest CSS render | Relevant density | Required source pixels |
| --- | ---: | ---: | ---: |
| Properties grid, desktop | about 363 × 275 px | 2× desktop Retina | about 726 × 550 px |
| Property editor preview | about 398 × 144 px | 2× desktop Retina | about 796 × 288 px |
| Properties grid, iPhone portrait | about 197 × 150 px | 3× iPhone Retina | about 591 × 450 px |
| Home event row | 44 × 44 px | up to 3× | 132 × 132 px |
| Calendar property row | 28 × 28 px | up to 3× | 84 × 84 px |

The 398 px editor width is the limiting horizontal case. The desktop card is the limiting vertical crop. An **800 px short edge** covers the useful 2× resolution in both cases and also covers the smaller 3× mobile cards. The processor preserves aspect ratio, limits the long edge to 1600 px for extreme panoramas, and never upscales.

## Current processing pipeline

Every property upload goes through `propertyImageStorage.store()`:

1. validate image type and protect the browser with a 30 MB source limit;
2. decode with EXIF orientation (`createImageBitmap(..., { imageOrientation: 'from-image' })`), with a native image fallback;
3. calculate dimensions from the measured UI limits;
4. resize once with high-quality canvas resampling;
5. encode WebP using descending quality steps;
6. target 160 KB and enforce a 240 KB binary ceiling;
7. return the optimized image and a metadata report to the storage provider.

The current provider is `InlinePropertyImageStorage`, because existing rows store a Base64 data URL in `properties.image_url`. It stores only the optimized result, never the original camera file. The Base64 row payload is normally below 320 KB including Base64 overhead, far below the old 900 KB payload ceiling.

HEIC/HEIF is accepted. Safari 17 and newer can decode it natively and the pipeline converts it to WebP. Browsers without a HEIC decoder receive a clear instruction to use iPhone's Most Compatible/JPEG setting. This avoids shipping a large HEIC/WASM decoder to every user for a property thumbnail.

## Browser benchmark (Chrome, 10 September 2026)

The production processing function was compiled by itself and run inside Chrome against generated photo-like fixtures. The EXIF fixture was physically 1200 × 800 with Orientation=6; the reported 800 × 1200 dimensions confirm that orientation was applied before resize.

| Fixture | Original | Final WebP | Final/original | Reduction | Processing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Landscape phone photo | 4032 × 3024 · 1.70 MB | 1067 × 800 · 99.3 KB | 5.72% | 94.28% | 231 ms |
| Portrait phone photo | 3024 × 4032 · 6.43 MB | 800 × 1067 · 89.7 KB | 1.36% | 98.64% | 278 ms |
| 10 MB+ phone photo | 6000 × 4500 · 13.59 MB | 1067 × 800 · 101.4 KB | 0.73% | 99.27% | 493 ms |
| Panoramic photo | 6000 × 2000 · 4.06 MB | 1600 × 533 · 69.5 KB | 1.67% | 98.33% | 313 ms |
| EXIF Orientation=6 | physical 1200 × 800 · 261.7 KB | oriented 800 × 1200 · 107.5 KB | 41.08% | 58.92% | 127 ms |
| AVIF portrait input | 2400 × 3200 · 472.2 KB | 800 × 1067 · 90.0 KB | 19.07% | 80.93% | 227 ms |

These results support the 800-pixel short edge and 160 KB target. All photo-like cases landed between 69.5 KB and 101.4 KB without an arbitrary 2 MB target.

## Storage abstraction and R2 implementation

React screens do not know where the image lives. Both the existing inline provider and `CloudflareR2PropertyImageStorage` implement the same interface. The active provider is selected with `VITE_PROPERTY_IMAGE_API_URL`. Without it, local development remains compatible with inline images.

The Cloudflare Worker in `worker/property-images.ts`:

1. verifies the user's Supabase JWT and Owner/Admin agency membership;
2. accepts only an already optimized WebP/JPEG body of at most 240 KB through a private R2 binding;
3. restricts the key to the active agency, for example `agencies/{agency_id}/properties/{property_id}/{uuid}.webp`;
4. returns the storage key and public delivery URL;
5. serves opaque image keys through the Worker with immutable Cloudflare/browser caching.

The migration `supabase/migrations/20260910083903_property_images_r2.sql` adds the RLS-protected metadata table. Binary image bytes live only in R2; Supabase stores the storage key and processing report.

```sql
create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  provider text not null check (provider in ('r2')),
  storage_key text not null unique,
  width integer not null,
  height integer not null,
  file_size integer not null,
  format text not null,
  sort_order integer not null default 0,
  is_cover boolean not null default true,
  created_at timestamptz not null default now()
);
```

R2 credentials must remain in the Worker. The browser should receive only a scoped, short-lived upload URL. A custom domain is preferred for production delivery and caching; Cloudflare documents `r2.dev` as a development endpoint.

Cloudflare references used for this decision:

- [R2 Workers API and bucket bindings](https://developers.cloudflare.com/r2/get-started/workers-api/)
- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 public buckets and production custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [R2 browser CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [WebKit: HEIC support in Safari 17](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)

## Deployment

1. Apply the Supabase migration.
2. Enable R2 for the Cloudflare account and create `pomaaalodesk-property-images`.
3. Set the Worker secret `SUPABASE_PUBLISHABLE_KEY`.
4. Run `npm run images:deploy`.
5. Add the resulting Worker URL as the Pages build variable `VITE_PROPERTY_IMAGE_API_URL` and rebuild Pages.

## Migration decision

Existing Base64 images should remain untouched during this phase. After the Worker, R2 bucket, custom domain, CORS policy, metadata table and deletion lifecycle are tested, a one-time migration can process each legacy image through the same pipeline, upload it to R2, write metadata, update `properties.image_url`, verify the new object, and only then remove the old inline value.
