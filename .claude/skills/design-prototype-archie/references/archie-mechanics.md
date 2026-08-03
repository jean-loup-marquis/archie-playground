# Mécanique Archie / rebel-racoon

Les spécificités de ce repo pour une session de prototypage. Complète `CLAUDE.md` et
`docs/reference/`, ne les remplace pas.

## L'inversion des règles DS (le piège principal)

Dans le monorepo platform, l'app Angular ne charge **pas** les classes css-ui : seuls les
composants `<ap-*>` marchent. **Ici c'est l'exact inverse** : classes `.ap-*` + tokens
`--ref-*` / `--sys-*`, et **aucun** composant Angular.

Donc `<ap-status>`, `<ap-widget-card>`, `WidgetCardComponent` et compagnie **n'ont pas
d'équivalent ici** — il faut les redessiner en css-ui + tokens. C'est le coût réel de tout
portage depuis un proto platform, et la source d'erreur la plus fréquente : du code recopié
depuis platform ne rendra rien.

Correspondance de mode : `design-guidelines` → **`mode: html-prototype`** (jamais `angular`).

## Conventions de code

**Pas de build, pas de bundler, pas de framework.** ES modules statiques servis depuis la racine.

- **Templates** — `html` et `raw` depuis `src/utils.js`. `html` échappe les interpolations par
  défaut ; un fragment HTML imbriqué doit passer par `raw()`, sinon il s'affiche échappé. Aussi
  `escapeText` / `escapeAttr` pour les valeurs d'attributs.
- **Écran** — un module par écran dans `src/screens/`, exportant
  `render<Screen>(params, target)`. Il pose le topbar, réinitialise son état local, appelle
  `paint(target)`, s'abonne à un store, et **retourne sa fonction de désabonnement** (teardown).
  Modèle de référence : `src/screens/contexts.js`.
- **Rendu** — `paint()` réécrit `target.innerHTML` en entier puis rappelle `bind(target)`. Pas de
  diff, pas de réconciliation. Les mises à jour viennent de `subscribe(() => paint(target))`.
- **Événements** — délégation pure via attributs `data-*` posés dans le template et écoutés dans
  `bind()`. Pas de `onclick`, pas de listener par nœud.
- **Route** — `route("/chemin", handler)` dans `src/app.js`. La regex est ancrée (`^…$`) : donc
  `/analytics` et `/analytics/x` sont deux routes indépendantes. Le handler est
  `(params, target)`. Les modules d'écran sont importés statiquement avec un cache-buster
  `?v=<n>` qu'il faut incrémenter en cas de modification.
- **Nav** — tableau déclaratif `NAV` dans `src/components/sidebar.js` :
  `{ path, icon, label, match, count }`, plus une clé **`flag`** optionnelle qui gate l'entrée
  sur un flag de `src/ff-catalog.js`. Ajouter une entrée = ajouter un objet.
- **CSS** — un fichier par écran dans `styles/screens/<écran>.css`, **plus un `<link>` à ajouter
  dans `index.html`** (pas d'import automatique). Les surcharges de classes DS vont
  exclusivement dans `styles/ds-patches.css`.
- **Données** — tout est mocké dans `src/mocks.js`, exposé via des stores (`src/*-store.js`).

## ⚠️ Le cache-buster `?v=N` est transitif — la règle à ne pas rater

Modifier un module ne suffit pas. Il faut bumper son `?v=` **et celui de tous ses importeurs,
transitivement, jusqu'à `src/app.js` dans `index.html`**. Un importeur servi depuis le cache
continue de résoudre l'**ancienne** URL de son enfant : le navigateur exécute alors un graphe de
modules périmé pendant que `curl` sert le bon fichier — on débogue un fantôme.

Deux corollaires appris à la dure :

- **La version doit rester uniforme** entre tous les importeurs d'un même module. 19 fichiers
  importaient `mocks.js?v=66` ; n'en bumper qu'un charge **deux instances** du module, donc deux
  états séparés.
- **L'échec peut être totalement silencieux.** Ajouter un flag dans `ff-catalog.js` sans bumper son
  importeur `feature-flags.js` laisse les navigateurs sur l'ancien catalogue ; `isFlagOn` fait
  `if (!flag) return false` pour un id inconnu, donc **la fonctionnalité neuve est simplement
  invisible**, sans erreur, sans trace console. Toucher `ff-catalog.js` impacte ~40 modules par
  transitivité.

Vérifier avant de conclure « ça ne marche pas » :

```bash
grep -rho "<module>\.js?v=[0-9]*" src/ index.html | sort -u   # doit renvoyer UNE seule version
```

Et se souvenir qu'un même nom de fichier peut exister dans deux dossiers frères
(`image-studio/context.js` vs `image-studio-v2/context.js`) — ce sont deux modules distincts, pas
une incohérence de version.

## Contraintes DS liantes

Détail dans `docs/reference/DESIGN-SYSTEM.md`. Ce qui fait échouer `validate_css` ou une revue :

- Vérifier qu'un composant DS existe **avant** d'écrire du CSS (`list_components` /
  `get_component` sur le MCP `ds-css`).
- Préférer les tokens `--sys-*` aux `--ref-*`.
- Ne jamais redéclarer une classe `.ap-*` hors `styles/ds-patches.css`.
- Aucune valeur px ni hex en dur ; aucun `!important`.
- Ne jamais éditer `ds/` — généré par `scripts/sync-ds.mjs`.
- Orange = actions IA / spotlight ; bleu = CTA de routine sur les pages de liste.
- Tout ce qui filtre utilise `.ap-filter-chip` ; `.ap-tag` est pour du lecture-seule.
- Le DS fournit `.ap-table` (+ `.ap-table-cell-*`, `-empty`, `-loading`) : s'en servir plutôt que
  de fabriquer une grille maison.

## Panneau latéral — avant d'y toucher

`src/components/right-panel.js` **n'est pas un overlay réutilisable** :

- C'est une **colonne de la grille de `#appShell`**, pas un calque flottant.
- C'est un **singleton mono-mode** (`drafts` | `ideas` | `sources` | `context-brief`) : ouvrir un
  mode remplace le précédent.
- `syncFromUrl()` le **referme de force sur toute route hors `^/session/`**. Un panneau sur une
  autre route demande soit d'assouplir ce garde, soit un composant distinct.

Les règles complètes (largeurs, Esc, interaction avec la sidebar) sont dans
`docs/reference/PANEL-SIDEBAR-RULES.md` et `SIDEBAR-PANEL-RECIPE.md`. Elles sont liantes.

## Le pont vers le vrai produit (non testé)

Le monorepo platform sait déjà afficher un Archie servi depuis une URL arbitraire — l'équivalent
de `pulse run <mfe>`, mais pour Archie :

`content/studio/frontend/libs/studio/studio-route/src/studio.component.ts` charge le script du
widget Studio et lui pose un attribut `data-app-url` dont la valeur vient du flag Flagsmith
**`content-publishing-lovable-studio`**. Pointer ce flag sur un rebel-racoon servi localement
devrait donc faire apparaître ce prototype **dans le vrai shell Agorapulse**.

**Non vérifié à ce jour.** Réserves connues : le flag est par identité (il faut un accès
Flagsmith) ; le contenu ainsi chargé ne parle pas le `StudioMessageBus`, donc aucune intégration
réelle avec l'hôte (ni auth, ni données) — acceptable pour une spec visuelle, pas pour valider un
comportement ; et le CSP du shell peut bloquer une origine localhost.

Par défaut, rester sur l'aperçu local (phase 5) : c'est suffisant et sans dépendance.
