# Odměny, ostrá verze 1.0: poznámky pro Clauda

Claude Code si tenhle soubor načte sám na začátku každé session.

**Tohle je ostrá verze, která běží v provozu na `/odmeny/`.** Je to hodnocení operátorů ve
výrobě: měsíčně tabáky (počet) a Kafe (ano, nebo ne). Uživatel ji používá a nesmí se
poškodit.

- **Nové funkce se dělají ve verzi 2**, v repozitáři `ecko456/odmeny_v2` (adresa `/odmeny_v2/`).
  Tady jen opravy, a to jen na výslovný pokyn uživatele.
- Kód odpovídá tagu `v1.0`. Historie pochází z repozitáře `ecko456/trading_desk`, kde Odměny
  dřív byly ve složce `odmeny/` (commit `ffe47d2` tam).
- Na serveru nejspíš běží právě tahle verze; ověřit se to dá tak, že
  `grep -c ODM_VERSION /var/www/odmeny/lib/odmeny.php` vypíše 0. Když vypíše víc, běží tam
  novější verze a tenhle repozitář ji nepopisuje: zastav se a zeptej se uživatele.

## Tři oddělené projekty (dřív jeden repozitář)

| projekt | repozitář | adresa | kód na serveru | data |
|---|---|---|---|---|
| Trading Desk | `ecko456/trading_desk` | `/trading/` | `/var/www/trading-journal` | `/var/lib/trading-journal` |
| **Odměny ostré (tady)** | `ecko456/odmeny` | `/odmeny/` | `/var/www/odmeny` | `/var/lib/odmeny` |
| Odměny verze 2 | `ecko456/odmeny_v2` | `/odmeny_v2/` | `/var/www/odmeny_v2` | `/var/lib/odmeny_v2` |

- Klony na serveru: `/root/trading_desk`, `/root/odmeny`, `/root/odmeny_v2`.
- Verze 2 si umí udělat kopii zdejších dat. Ostrou databázi při tom jen čte.
- Věci, které musí zůstat stejné, jinak se verze 2 rozbije:
  - řetězce pro kryptografii (`odmeny/v1`, `odmeny/data/v1`, `odmeny/dek|…`);
  - tvar databáze (`cards`, `devices`, `sessions`, `attempts`, `versions`).

## Pravidla spolupráce

- Komunikace **česky**, věcně. UI texty a komentáře v kódu jsou česky.
- **Nikdy se nepřipojuj na server uživatele.** Do repa nedávej IP ani adresu serveru, ani
  žádná data. **Repozitář je veřejný.**
- Aplikace běží jen za HTTPS (Apache) a data musí zůstat šifrovaná a přístupná jen po přihlášení.
- Opatrně. **Nepushuj neotestovaný kód.** Před každou změnou v ostré verzi musí mít uživatel
  zálohu `/var/lib/odmeny`, třeba `sudo tar -czf /root/odmeny-zaloha-$(date +%F-%H%M).tar.gz -C /var/lib odmeny`.
- Instalace 1.0 (`deploy/install.sh`) před aktualizací databázi **nezálohuje** (to umí až
  verze 2). Při jakékoli opravě proto dej uživateli příkaz se zálohou.
- Do commitů, PR, kódu ani dokumentace nepiš identifikátor modelu. Patičku commitu ber
  z pokynů aktuální session. Commit message česky: `Odměny: co se změnilo`.
- Na konci práce dej uživateli přesný příkaz pro server, včetně názvu větve, ze které má
  stáhnout. Server má `main`, session pracuje ve vlastní větvi:
  `cd /root/odmeny && git pull origin <větev>`, nebo sloučení do `main`.

## Struktura

- `index.php`: zámek.
- `app.php`: kód aplikace až po odemčení.
- `api.php` a `lib/odmeny.php`: server. Vidí jen šifrovaný blok, kartičky, zařízení s PINem,
  relace a verze.
- `static/vault.js`: šifrování v prohlížeči. Zapamatované zařízení je v localStorage pod klíčem
  `odmeny.device.v1`. Verze 2 má na `/odmeny_v2/` vlastní klíč, takže se nepletou.
- `static/lock.js`: přihlašovací obrazovka.
- `private/core.js`: výpočty z původní aplikace. Opravy jsou označené `Oprava:`.
- `private/app.js`: rozhraní.
- `deploy/`: instalace a konfigurace Apache.
- `tests/`:
  - `test_odmeny.py` (server a šifrovaný tok);
  - `test_core.js` (výpočty proti původní aplikaci `tests/hodnoceni-operatoru.html`).
- Podrobný popis architektury, výpočtů a datového modelu je v `CLAUDE.md` repozitáře
  `odmeny_v2`. Verze 2 z této verze vychází.

## Testy

```bash
python3 -m unittest discover -s tests     # 12 testů, pár vteřin
node tests/test_core.js
# lokální server s čistými daty
ODMENY_DATA_DIR=/tmp/odm php -S 127.0.0.1:8490 -t . dev-router.php
```

Kontejner má PHP 8.4 CLI, Node 22 a Playwright s Chromiem:

- `require('/opt/node22/lib/node_modules/playwright')`;
- `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.
