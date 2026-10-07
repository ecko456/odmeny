# Odměny, ostrá verze 1.x: poznámky pro Clauda

Claude Code si tenhle soubor načte sám na začátku každé session.

**Tohle je ostrá verze, která běží v provozu na `/odmeny/`.** Je to hodnocení operátorů ve
výrobě: měsíčně tabáky (počet) a Kafe (ano, nebo ne). Uživatel ji používá a nesmí se
poškodit.

- **Ostrá verze se aktualizuje jen na výslovné přání uživatele** (rozhodnutí z 2. 10. 2026).
  Jinak jen poběží, dokud se nepřejde na verzi 2. Nic tu neměň a neinstaluj, ani opravy,
  pokud o to uživatel výslovně nepožádá.
- **Výjimka 7. 10. 2026 (verze 1.1):** uživatel chtěl přímo v ostré verzi PDF lidí pro auditora
  (Lidé → Export do PDF) a k tomu oddělení u pozic. Viz „Verze 1.1“ níže.
- **Nové funkce jinak vznikají ve verzi 2**, v repozitáři `ecko456/odmeny_v2` (adresa `/odmeny_v2/`).
  Až bude hotová, ostrá verze se nahradí verzí 2 (čerstvá kopie dat z `/var/lib/odmeny`).
  **Verze 2 zatím PDF pro audit nemá**: před přechodem ho tam přenes (oddělení už zná).
- Verze 1.0 = commit `db14339`. Historie pochází z repozitáře `ecko456/trading_desk`, kde Odměny
  dřív byly ve složce `odmeny/` (commit `ffe47d2` tam).
- Co běží na serveru: `grep -c ODM_MIN_CLIENT /var/www/odmeny/lib/odmeny.php` vypíše 0 u verze 1.0
  a víc u 1.1. `grep -c ODM_VERSION` musí vypsat 0; když vypíše víc, běží tam verze 2 a tenhle
  repozitář ji nepopisuje: zastav se a zeptej se uživatele.

## Verze 1.1 (7. 10. 2026)

- **Oddělení u pozic:** `p.dept` (nejvýš 60 znaků, ořezané mezery), stejné pole a stejné čištění
  jako ve verzi 2 (`sanitizeState`). `deptOf(p)`: prázdné oddělení = název pozice. Pole v editoru
  pozice (`#posDept`), oddělení i v exportu zařazení (poslední sloupec; import čte podle hlavičky).
- **PDF pro audit** (`#btnPeoplePdf`, `exportPeoplePdf`, `drawPeoplePdf` v `private/app.js`):
  - data připraví `auditRoster()` v `core.js`: jen nevyřazení s pozicí i úrovní; oddělení podle
    abecedy (`Intl.Collator('cs', {numeric:true})`), v oddělení úroveň 4→1, pak příjmení a jméno;
  - jsPDF a podmnožina IBM Plex Sans (TTF) jako ve verzi 2, `app.php` je vydá až po odemčení;
  - sazba: souhrn s podpisy na první straně, oddělení se nedělí, když se vejde na stranu,
    osamocené řádky se nepřelévají, dlouhé texty se zalamují (nezkracují), zápatí „Strana X / Y“;
  - v PDF nejsou tabáky ani jiné údaje o odměnách, jen zařazení a úrovně.
- **Stará otevřená stránka:** klient posílá `X-Odmeny-Client: 2` (`static/vault.js`), server
  (`odm_require_client`, `ODM_MIN_CLIENT`) odmítne uložení bez ní kódem 426. Stránka z 1.0 by
  jinak při uložení zahodila oddělení. Nový klient na 426 vyzve k obnovení stránky.
- Ověřeno: unit testy, `tests/e2e_lide_pdf.js` (Playwright), vizuální kontrola PDF (PyMuPDF,
  malá data, 53 a 150 lidí) a aktualizace 1.0 → 1.1 na lokálním Apachi s otevřenou starou záložkou.

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
- Instalace 1.x (`deploy/install.sh`) před aktualizací databázi **nezálohuje** (to umí až
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
  - `test_core.js` (výpočty proti původní aplikaci `tests/hodnoceni-operatoru.html`, oddělení, PDF data);
  - `e2e_lide_pdf.js` (Playwright: oddělení, PDF, mobil, výzva staré stránce; návod v hlavičce).
- Podrobný popis architektury, výpočtů a datového modelu je v `CLAUDE.md` repozitáře
  `odmeny_v2`. Verze 2 z této verze vychází.

## Testy

```bash
python3 -m unittest discover -s tests     # 12 testů, pár vteřin
node tests/test_core.js
# PDF: stažené PDF z e2e jde vykreslit do PNG přes PyMuPDF (import pymupdf) a prohlédnout
# lokální server s čistými daty
ODMENY_DATA_DIR=/tmp/odm php -S 127.0.0.1:8490 -t . dev-router.php
```

Kontejner má PHP 8.4 CLI, Node 22 a Playwright s Chromiem:

- `require('/opt/node22/lib/node_modules/playwright')`;
- `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.
