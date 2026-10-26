# PomaaaloDesk — potpuni backup i obnova

Ovaj dokument je dovoljan za obnovu aplikacije bez pristupa starom Codex razgovoru.

## Trenutna infrastruktura

| Dio | Vrijednost |
|---|---|
| GitHub | `https://github.com/salemko72/bookweb.git` |
| Produkcijska grana | `main` |
| Cloudflare Pages projekt | `bookweb` |
| Web | `https://bookweb.pages.dev` |
| Cloudflare account ID | `21db5c0516fc09fed9e4b49aed03f06d` |
| Image Worker | `pomaaalodesk-images` |
| Worker URL | `https://pomaaalodesk-images.salemko.workers.dev` |
| R2 bucket | `pomaaalodesk-property-images` |
| Supabase projekt | `Booking Manager Web 2` |
| Supabase project ref | `jawcaedeynlbyntjolrg` |
| Supabase URL | `https://jawcaedeynlbyntjolrg.supabase.co` |
| Glavna demo agencija | `Jolie Agency` |

## Šta mora biti sačuvano

Potpuna kopija ima četiri dijela:

1. **Izvorni kod i historija** — GitHub plus lokalni `bookweb.bundle`.
2. **Supabase baza** — schema, public data, roles, Auth podaci i Storage metadata.
3. **R2 slike** — svi objekti iz bucketa `pomaaalodesk-property-images`.
4. **Privatni ključevi** — čuvaju se u password manageru, odvojeno od ZIP-a i GitHuba.

JSON koji se preuzima u aplikaciji preko **Settings → Data backup** je dodatna, čitljiva kopija jedne agencije. Koristan je za brz povrat podataka, ali nije zamjena za puni dump baze.

## Jedna naredba za backup

Iz `C:\BOOKWEB` pokrenuti:

```powershell
npm.cmd run backup:recovery
```

Skripta traži Supabase database password i pravi ZIP u `C:\BOOKWEB\backups`. Password se koristi samo u procesu izvoza i ne zapisuje se u ZIP.

Ako želiš uključiti i JSON iz aplikacije:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\create-recovery-backup.ps1 -AgencyJson "C:\TEMP\jolie-agency-backup-2026-09-10.json"
```

## Jednokratno podešavanje R2 kopije

Wrangler može dohvatiti jedan R2 objekt, ali nema naredbu za masovno preuzimanje cijelog bucketa. Za potpunu kopiju koristi se `rclone` preko R2 S3 API-ja.

1. U Cloudflare Dashboardu otvori **R2 → Manage R2 API Tokens**.
2. Napravi token sa read pristupom bucketu `pomaaalodesk-property-images`.
3. Sačuvaj Access Key ID i Secret Access Key u password manager.
4. Instaliraj `rclone` i napravi remote nazvan `pomaaalodesk-r2` prema službenom Cloudflare R2 uputstvu: <https://developers.cloudflare.com/r2/examples/rclone/>.
5. Potpuni backup zatim pokreni ovako:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\create-recovery-backup.ps1 -R2Remote pomaaalodesk-r2
```

Dok `-R2Remote` nije naveden, skripta će napraviti ostatak kopije i jasno označiti da R2 slike nisu uključene.

## Privatne vrijednosti

Cloudflare nakon spremanja više ne pokazuje vrijednost Worker secreta. Zato u password manageru treba sačuvati:

- Supabase database password;
- Supabase publishable key;
- Supabase service-role key;
- Cloudflare pristup ili API token;
- R2 S3 Access Key ID i Secret Access Key;
- GitHub recovery podatke.

Frontend varijable koje treba ponovo postaviti nalaze se u `.env.example`. Worker lokalni secret nalazi se u `.dev.vars.example`. Stvarni `.env.local`, `.dev.vars` i backup ZIP-ovi su namjerno isključeni iz Gita.

## Provjera kopije

Uz svaki ZIP skripta pravi `.sha256` datoteku. Integritet se provjerava naredbom:

```powershell
Get-FileHash C:\putanja\pomaaalodesk-recovery-DATUM.zip -Algorithm SHA256
```

Rezultat mora odgovarati vrijednosti u pripadajućem `.sha256` fajlu. Drži najmanje dvije kopije: jednu lokalno i jednu na drugom fizičkom ili cloud disku.

## Obnova od nule

1. Instaliraj Git, Node.js, Docker Desktop, Supabase CLI i Wrangler.
2. Vrati kod iz GitHuba:

   ```powershell
   git clone https://github.com/salemko72/bookweb.git C:\BOOKWEB
   cd C:\BOOKWEB
   npm.cmd ci
   ```

   Ako GitHub nije dostupan, koristi bundle:

   ```powershell
   git clone C:\BACKUP\source\bookweb.bundle C:\BOOKWEB
   ```

3. Napravi novi Supabase projekt. Poveži ga i primijeni migracije iz repozitorija:

   ```powershell
   npx.cmd supabase login
   npx.cmd supabase link --project-ref NOVI_PROJECT_REF
   npx.cmd supabase db push
   ```

4. Podatke iz `public-data.sql` vrati kontrolirano u novu bazu. `auth-data.sql` i `storage-metadata.sql` su sigurnosne kopije managed schema; njih vraćaj tek nakon provjere kompatibilnosti nove Supabase verzije. Ako Auth restore nije kompatibilan, ponovo pozovi korisnike kroz **People**.
5. Napravi R2 bucket `pomaaalodesk-property-images` i vrati slike:

   ```powershell
   rclone copy C:\BACKUP\r2\pomaaalodesk-property-images pomaaalodesk-r2:pomaaalodesk-property-images --checksum --metadata
   ```

6. Unesi nove vrijednosti u `.env.local`, Cloudflare Pages production variables i Worker secret `SUPABASE_PUBLISHABLE_KEY`.
7. Objavi image Worker:

   ```powershell
   npm.cmd run images:deploy
   ```

8. Pushaj `main` na GitHub. Cloudflare Pages automatski gradi i objavljuje web.
9. Provjeri login, Jolie Agency, nekretnine, rezervacije, iCal linkove i prikaz/upload slika.

Supabase preporučuje redovne CLI dumpove za Free projekte: <https://supabase.com/docs/guides/platform/backups>. Baza ne sadrži same R2 slike, zato se R2 mora kopirati zasebno.
