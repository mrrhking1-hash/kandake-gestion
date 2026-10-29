#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validation statique de la PWA Kandake Gestion, version SPA (aucune dependance externe)."""
import re, json, pathlib, sys, subprocess

R = pathlib.Path(__file__).resolve().parent

ROUTES = {
    "accueil":  ("dashboard", "Accueil"),
    "stocks":   ("stocks", "Stocks"),
    "caisse":   ("pos", "Caisse"),
    "ventes":   ("orders", "Ventes"),
    "finances": ("finance", "Finances"),
    "reglages": ("settings", "Réglages"),
}
# la connexion n'appartient pas a la barre du bas
EXTRA_VIEWS = ["connexion"]
OLD_PAGES = ["stocks.html", "caisse.html", "ventes.html", "finances.html", "reglages.html"]
fail = 0


def ok(label, cond, extra=""):
    global fail
    if not cond:
        fail += 1
    print("  %s %-54s %s" % ("OK " if cond else "KO ", label, extra))


def read(rel):
    return (R / rel).read_text(encoding="utf-8")


# --------------------------------------------------------------------------- shell
print("=== 1. shell SPA (index.html) ===")
sh = read("index.html")
ok("un seul <!DOCTYPE html", sh.lower().count("<!doctype html") == 1)
ok("un seul <body>", sh.count("<body") == 1)
ok("conteneur #view-root", 'id="view-root"' in sh)
ok('rel="manifest"', 'rel="manifest"' in sh)
ok("meta viewport avec viewport-fit=cover", "viewport-fit=cover" in sh)
ok("meta theme-color", 'name="theme-color"' in sh)
ok("meta apple-mobile-web-app-capable", 'name="apple-mobile-web-app-capable"' in sh)
ok("lien icones apple-touch", 'rel="apple-touch-icon"' in sh)
ok("css/app.css", 'href="css/app.css"' in sh)
ok("js/app.js", 'src="js/app.js"' in sh)
ok("js/router.js", 'src="js/router.js"' in sh)
ok("js/tailwind-config.js", 'src="js/tailwind-config.js"' in sh)
ok("police Material Symbols", "Material+Symbols+Outlined" in sh)
ok("entete sans titre de route (la barre du bas suffit)", 'id="page-title"' not in sh)
ok("entete : un seul <h1> (la marque)", sh.count("<h1") == 1)
ok("barre de navigation unique", sh.count("<nav") == 1 and sh.count("</nav>") == 1)
ok("6 onglets de nav", len(re.findall(r'class="nav-link[^"]*"', sh)) == 6)
ok("onglets en routage hash", len(re.findall(r'nav-link[^>]*href="#/', sh)) == 6)
ok("les 6 routes sont presentes dans la nav",
   all('href="#/%s"' % r in sh for r in ROUTES))
ok("la connexion n'est pas dans la barre du bas", 'href="#/connexion"' not in sh)

# --------------------------------------------------------------------------- vues
print("=== 2. fragments de vues ===")
for route in list(ROUTES) + EXTRA_VIEWS:
    v = read("views/%s.html" % route)
    ok("%s.html : un seul <main>" % route, v.count("<main") == 1 and v.count("</main>") == 1)
    ok("%s.html : pas de <nav> heritee" % route, "<nav" not in v)
    ok("%s.html : pas de <html>/<body>" % route,
       "<html" not in v.lower() and "<body" not in v.lower())
    ok("%s.html : pas de lien vers une ancienne page" % route,
       not re.search(r'href="(stocks|caisse|ventes|finances|reglages)\.html', v))
    ok("%s.html : pas de <script> inline" % route, "<script" not in v.lower())

# --------------------------------------------------------------------------- modules
print("=== 3. modules de logique ===")
for route in list(ROUTES) + EXTRA_VIEWS:
    f = "js/views/%s.js" % route
    ok("%s.js present" % route, (R / f).exists())
    src = read(f)
    ok("%s.js : accolades equilibrees" % route,
       src.count("{") == src.count("}"), "%d / %d" % (src.count("{"), src.count("}")))
    ok("%s.js : expose KD.views.<route>.mount" % route, "KD.views." + route in src)
    ok("%s.js : (function ()" % route, src.lstrip().splitlines()[1].startswith("(function ()"))

# --------------------------------------------------------------------------- stubs
print("=== 4. anciennes URL conservees (compatibilite) ===")
for page in OLD_PAGES:
    route = page[:-5]
    t = read(page)
    ok("%s redirige vers #/%s" % (page, route), 'content="0; url=index.html#/%s"' % route in t)
    ok("%s : meta refresh" % page, 'http-equiv="refresh"' in t)
    ok("%s : pas de contenu applicatif" % page, "<main" not in t)

# --------------------------------------------------------------------------- liens
print("=== 5. liens internes ===")
hl = read("hors-ligne.html")
ok("hors-ligne.html : liens en hash",
   not re.search(r'href="(stocks|caisse|ventes|finances|reglages)\.html', hl))
ok("hors-ligne.html : autonome (ni shell ni Tailwind CDN)",
   'id="view-root"' not in hl and "cdn.tailwindcss.com" not in hl)
ok("hors-ligne.html : explique la situation", "Hors-ligne" in hl or "hors-ligne" in hl)

# --------------------------------------------------------------------------- PWA
print("=== 6. manifest ===")
man = json.loads(read("manifest.json"))
ok("manifest valide", isinstance(man, dict))
ok("name", bool(man.get("name")))
ok("start_url = index.html", man.get("start_url") in ("index.html", ".", "./"))
ok("scope = ./", man.get("scope") == "./")
ok("display standalone", man.get("display") == "standalone")
ok("theme_color", bool(man.get("theme_color")))
ok("raccourcis vers le shell + hash",
   len(man.get("shortcuts", [])) == 3 and
   all(s.get("url", "").startswith("index.html#/") for s in man["shortcuts"]))
for icon in man.get("icons", []):
    ok("icone presente : %s" % icon["src"], (R / icon["src"]).exists())
ok("ecran de demarrage maskable",
   any("maskable" in i.get("purpose", "") for i in man.get("icons", [])))

# --------------------------------------------------------------------------- SW
print("=== 7. service worker ===")
sw = read("sw.js")
pre = re.search(r"const SHELL_ASSETS = \[(.*?)\];", sw, re.S)
ok("SHELL_ASSETS declare", pre is not None)
if pre:
    assets = re.findall(r"'([^']+)'", pre.group(1))
    missing = [a for a in assets if not a.startswith("./") and not (R / a).exists()]
    ok("tous les assets precaches existent", not missing, ", ".join(missing))
    for req in ["index.html", "js/app.js", "js/router.js", "manifest.json", "css/app.css"]:
        ok("precache : %s" % req, req in assets)
    for route in list(ROUTES) + EXTRA_VIEWS:
        ok("precache : views/%s.html" % route, "views/%s.html" % route in assets)
        ok("precache : js/views/%s.js" % route, "js/views/%s.js" % route in assets)
ok("version de cache declaree", re.search(r"const VERSION = 'v\d+';", sw) is not None)
ok("noms de cache derives de la version",
   "kandake-shell-${VERSION}" in sw and "kandake-runtime-${VERSION}" in sw)
ok("install : precache + skipWaiting", "skipWaiting" in sw)
ok("activate : purge des anciens caches", "caches.delete" in sw)
ok("navigations : reseau d'abord puis shell", "handleNavigation" in sw and "SHELL_URL" in sw)
ok("fallback hors-ligne", "hors-ligne.html" in sw)
ok("assets externes : cache-first", "cacheFirst(request, RUNTIME_CACHE)" in sw)
ok("assets locaux : stale-while-revalidate", "staleWhileRevalidate(request)" in sw)

# --------------------------------------------------------------------------- traces
print("=== 8. liens de routage ===")
r = read("js/router.js")
ok("js/router.js : route connexion declaree", "views/connexion.html" in r)
ok("js/router.js : connexion hors navigation", "hidden: true" in r and "bare: true" in r)
ok("js/router.js : ORDER exclut la connexion", "!KD.ROUTES[k].hidden" in r)
ok("js/app.js : garde de session", "KD.guard" in read("js/router.js") and "KD.isAuthenticated" in read("js/app.js"))
ok("css/app.css : chrome masquee sur vue bare", "body.is-bare header" in read("css/app.css"))
ok("connexion.html : hauteur mobile (dvh)", "min-h-dvh" in read("views/connexion.html"))
ok("connexion.html : pas de debordement horizontal racine",
   "overflow-x-hidden" in read("views/connexion.html").split("<!-- halos")[0])
ok("connexion.html : champs a 16px sur mobile (pas de zoom iOS)",
   read("views/connexion.html").count("text-[16px] sm:text-[15px]") == 2)
ok("connexion.html : fond jaune de la palette du logo",
   "from-secondary-container to-secondary-fixed-dim" in read("views/connexion.html"))
ok("connexion.html : aucun selecteur de profil",
   "team-picker" not in read("views/connexion.html") and "data-pick" not in read("js/views/connexion.js"))
ok("connexion.html : bouton blanc arrondi Entreer",
   "bg-white text-primary" in read("views/connexion.html") and re.search(r">\s*Entrer\s*<", read("views/connexion.html")))
_c = read("views/connexion.html")
ok("connexion.html : un seul bloc blanc pour les deux zones de formulaire",
   _c.count("login-card rounded-[26px]") == 1)
ok("connexion.html : les deux champs sont dans ce bloc",
   _c.index('id="login-id"') > _c.index("login-card rounded-[26px]") and
   _c.index('id="login-pass"') < _c.index('id="login-submit"'))
ok("connexion.html : champs transparents (fond fourni par le bloc)",
   _c.count("bg-transparent outline-none") == 2)
ok("connexion.html : une ligne active par champ", _c.count('class="login-row"') == 2)
ok("css/app.css : autofill du navigateur neutralise sur la carte",
   ".login-card input:-webkit-autofill" in read("css/app.css"))
ok("css/app.css : retour d'animation sur erreur", "kd-shake" in read("css/app.css"))
ok("stocks.html : liste vide rendue par les donnees",
   '<div class="flex flex-col gap-gutter" id="list"></div>' in read("views/stocks.html")
   and "<article" not in read("views/stocks.html"))
ok("stocks.html : feuille de modification presente",
   all(x in read("views/stocks.html") for x in ['id="editor"', 'id="ed-form"', 'id="ed-name"',
                                               'id="ed-price"', 'id="ed-stock"', 'id="ed-cat"',
                                               'id="ed-status"', 'id="ed-save"']))
ok("js/app.js : magasin de produits (8 references)",
   "KD.defaultProducts" in read("js/app.js") and read("js/app.js").count("sku: 'KDK-") == 8)
ok("js/app.js : mise a jour / creation / suppression de produit",
   all(f in read("js/app.js") for f in ["KD.updateProduct", "KD.addProduct", "KD.saveProducts", "KD.removeProduct"]))
ok("js/views/stocks.js : le clic ouvre la modification",
   "closest('.kd-swipe[data-id]')" in read("js/views/stocks.js") and
   "openEditor" in read("js/views/stocks.js"))
ok("js/views/stocks.js : suppression confirmee",
   all(f in read("js/views/stocks.js") for f in ["KD.removeProduct", "showModal", "confirmerSuppression"]))
ok("js/views/stocks.js : les boutons +/- n'ouvrent pas la modification",
   "e.target.closest('.qty-btn')" in read("js/views/stocks.js"))
# ---- actualisation par tirage vers le bas ----
_ptr = read("js/pull-refresh.js")
ok("js/pull-refresh.js present", bool(_ptr))
ok("js/pull-refresh.js charge par le shell", 'src="js/pull-refresh.js"' in read("index.html"))
ok("sw.js : js/pull-refresh.js precache", "'js/pull-refresh.js'" in read("sw.js"))
ok("pull-refresh : le temoin existe dans le CSS",
   re.search(r"#kd-ptr\s*\{[^}]*pointer-events:\s*none", read("css/app.css"), re.S))
ok("pull-refresh : le temoin passe sous l'entete",
   re.search(r"#kd-ptr\s*\{[^}]*z-index:\s*4[0-9]", read("css/app.css"), re.S))
# touchmove doit pouvoir etre annule, sinon iOS fait rebondir la page
ok("pull-refresh : touchmove en passive: false (preventDebug)",
   re.search(r"addEventListener\('touchmove',[^)]*passive:\s*false", _ptr))
ok("pull-refresh : le geste n'arme qu'en haut de page", "window.scrollY > 0" in _ptr)
ok("pull-refresh : les feuilles et tiroirs ont la priorite",
   "kd-sheet-open" in _ptr and "#cart-drawer:not(.hidden)" in _ptr)
ok("pull-refresh : un champ focalise ou le clavier ouvert bloque le geste",
   "/^(input|textarea|select)$/i" in _ptr and "clavierOuvert" in _ptr)
ok("pull-refresh : un nouveau contact abandonne le geste precedent",
   "etat = null; /* un nouveau contact" in _ptr or
   re.search(r"if \(etat && etat\.arme\) ranger\(\);\s*etat = null;", _ptr))
ok("pull-refresh : le geste se retire vers le haut au lieu d'actualiser",
   "dy <= 0" in _ptr and "ranger()" in _ptr)
ok("pull-refresh : seuil borne et proportionnel a l'ecran",
   "SEUIL_MIN" in _ptr and "SEUIL_MAX" in _ptr and "innerHeight * 0.14" in _ptr)
ok("pull-refresh : le temoin est complet avant le seuil (retenue)",
   "FREIN" in _ptr and re.search(r"course = Math\.min\(HAUT_TEMOIN, dy \* FREIN\)", _ptr))
ok("pull-refresh : respects le mouvement reduit",
   "prefers-reduced-motion" in read("css/app.css"))
ok("router : KD.reload resout quand le rendu est pret",
   "KD.reload = function" in read("js/router.js") and "attentes" in read("js/router.js"))
ok("router : KD.reload cible le rendu en vol, pas la vue precedente",
   re.search(r"var cible = name \|\| pending \|\| current;", read("js/router.js")))
ok("router : un rendu force n'est pas court-circuite",
   "name === current && !force" in read("js/router.js"))
ok("app.js : KD.checkUpdate interroge le service worker",
   "KD.checkUpdate = function" in read("js/app.js") and "swReg.update()" in read("js/app.js"))
ok("index.html : plus de meta mobile_tab inexistant",
   "mobile_tab" not in read("index.html"))
ok("css/app.css : feuille de modification animee",
   "kd-sheet-up" in read("css/app.css") and "body.kd-sheet-open" in read("css/app.css"))
ok("connexion.html : aucune classe Tailwind inexistante",
   not re.search(r"\bh-13\b", read("views/connexion.html")))
for _r in ROUTES:
    ok("%s.html : aucune classe Tailwind inexistante" % _r,
       not re.search(r"\b(?:p|px|py|pt|pb|m|mx|my|mt|mb|gap|w|h|min-h|max-w)-0\.2\b", read("views/%s.html" % _r)))
_tc = read("js/tailwind-config.js")
ok("tailwind : jeton de marge haute = header + encoche iOS",
   re.search(r'"header":\s*"calc\(4\.125rem \+ env\(safe-area-inset-top', _tc))
# Le jeton doit couvrir la hauteur REELLE du header, deduite du balisage :
# encoche (pt-safe) + 64px (h-16) + 2px (#route-bar, toujours en flux).
_idx = read("index.html")
_hdr = _idx.split("<header")[1].split("</header>")[0]
_hauteur = 64 + (2 if 'id="route-bar"' in _hdr else 0)
_marge = float(re.search(r'"header":\s*"calc\(([\d.]+)rem', _tc).group(1)) * 16
ok("marge haute >= hauteur reelle du header (encoche exclue)",
   _marge >= _hauteur, "%dpx de marge pour %dpx de header" % (_marge, _hauteur))
ok("tailwind : jeton de marge basse = barre du bas + trait d'accueil",
   re.search(r'"nav":\s*"calc\(4rem \+ env\(safe-area-inset-bottom', _tc))
ok("vues : marges hautes et basses compatibles encoche iOS",
   all("pt-header" in read("views/%s.html" % r) and "pb-nav" in read("views/%s.html" % r)
       for r in ROUTES if r != "connexion"))
ok("vues : hauteur calee sur la barre d'URL mobile (dvh)",
   all("min-h-dvh" in read("views/%s.html" % r) for r in ROUTES if r != "connexion"))
ok("connexion.html : bloc centre, pas de justify-center qui coupe le haut",
   "login-stage my-auto" in read("views/connexion.html"))
ok("connexion.html : les deux lignes du bloc ont la meme gouttiere",
   read("views/connexion.html").count('<div class="px-4">') == 1 and
   read("views/connexion.html").count('class="border-t border-black/[0.07] px-4"') == 1)
ok("connexion.js : clavier iOS mesure via visualViewport",
   "visualViewport" in read("js/views/connexion.js"))
ok("css/app.css : marge verticale du login issue des safe-areas",
   re.search(r"\.login-stage\s*\{[^}]*safe-area-inset-top[^}]*safe-area-inset-bottom",
             read("css/app.css"), re.S))
ok("connexion.html : pas de focus automatique au lancement",
   "idInput.focus()" not in read("js/views/connexion.js").split("var cancel")[1])
ok("app.js : equipe par defaut (Zenab, Ydile, Dominique)",
   all(n in read("js/app.js") for n in ["'Zenab'", "'Ydile'", "'Dominique'"]))
ok("app.js : mot de passe 1111 pour les trois",
   read("js/app.js").count("password: '1111'") == 3)
ok("js/router.js : KD.ROUTES complet",
   all(("views/%s.html" % k) in r and ("js/views/%s.js" % k) in r for k in ROUTES))
ok("js/router.js : KO.ROUTES coherent", "KD.ROUTES" in r)
ok("js/app.js : plus de syncNav", "syncNav" not in read("js/app.js"))

# --------------------------------------------------------------------------- syntaxe
print("=== 9. syntaxe JavaScript ===")
files = ["sw.js", "js/app.js", "js/router.js", "js/tailwind-config.js"] + \
        ["js/views/%s.js" % r for r in ROUTES]
for f in files:
    p = subprocess.run(["node", "--check", f], cwd=R, capture_output=True, text=True)
    ok("node --check %s" % f, p.returncode == 0, p.stderr.strip().splitlines()[0] if p.returncode else "")

print()
print("VERIFICATION STATIQUE : %s" % ("TOUT EST CONFORME" if fail == 0 else "%d ANOMALIE(S)" % fail))
sys.exit(1 if fail else 0)