---
name: design-prototype-archie
description: Session de prototypage guidée pour Archie dans ce repo — l'équivalent de design-prototype, mais câblé sur rebel-racoon (vanilla JS statique) au lieu du monorepo platform. Déclencher sur : prototype, prototyper, prototypage, crée un prototype, maquette, mockup, nouvel écran, tester une idée d'écran, proto Archie, build a prototype, prototype a screen. Amène un PM d'une idée à un écran visible : branche proto/ jetable, UI 100% design-system en classes .ap-*, aperçu local immédiat, hand-off en spec visuelle.
---

# Prototypage Archie — session guidée

Amener un Product Manager non technique d'une idée à un prototype visuel dans ce repo, en
masquant la mécanique git. Le résultat est une **spec visuelle jetable**, jamais du code de
production. **Parler la langue du PM ; français par défaut.**

Lire `references/archie-mechanics.md` avant la phase 4.

## Pourquoi ce skill existe

`design-prototype` (plugin `agorapulse-marketplace`) **ne s'applique pas à ce repo** et ne peut
pas y tourner : il est câblé sur le monorepo platform — `pulse run <mfe>`, ancrage sur
`app.beta.agorapulse.com`, ticket Shortcut + `flow:start-story`, branches `prototype/sc-<id>`,
`design-guidelines` en mode `angular`. Archie n'existe pas comme app dans platform (pas de MFE,
pas d'entrée dans la carte `pulse`) ; sa vraie UI est un widget hébergé hors monorepo. Ce skill
rejoue les mêmes phases avec les outils d'ici.

Ne pas essayer de faire tourner `pulse`, `flow`, ou de créer un ticket Shortcut : rebel-racoon
est hors process de delivery.

## Garde-fous

- La branche `proto/*` est **jetable et non mergeable** — une spec visuelle, pas du code de
  production. Un dev la réimplémente proprement ensuite.
- **JAMAIS** : merger, marquer une PR ready-for-review, force-pusher, toucher `main`.
  `main` est un miroir d'`upstream` (fork de `mbousendorfer/rebel-racoon`) que le workflow
  `sync-upstream.yml` resynchronise chaque jour — y écrire casse la sync.
- Rester strictement dans le périmètre du prototype : aucun nettoyage ni refactor collatéral.
- Ne jamais éditer `ds/` — c'est généré par `scripts/sync-ds.mjs`.
- Pas de stack trace au PM : un message clair qui nomme ce qui bloque.
- La note de hand-off redit toujours : « Ceci est une spec visuelle. Un dev la réimplémente
  proprement. »

## Phase 0 — Préflight & mémoire

1. **Charger la mémoire proto partagée.** Elle vit dans `$CLAUDE_PROJECTS_DIR/proto/`
   (`~/.claude/projects-memory/proto/`) : `summary.md`, `details/prototypes/<slug>.md`,
   `details/learnings.md`. C'est la même mémoire que les protos platform — un seul endroit où la
   pratique de prototypage s'accumule. Lire au moins `summary.md` et
   `details/prototypes/playbook-page-archie.md` (le proto Archie précédent).
   > Un dossier `prototypes/` existe aussi à côté ; c'est un doublon non alimenté. Utiliser `proto/`.
2. **Préflight, léger.** `npm install` dans le repo si `node_modules/` ou `ds/` manquent — le
   postinstall `sync-ds.mjs` synchronise le design system. C'est tout : **ni pulse, ni sudo, ni
   `/etc/hosts`, ni provisioning machine.**
3. Vérifier que `git` et `gh` sont authentifiés (nécessaire seulement en phase 7).

## Phase 1 — Nouveau prototype ou reprise ?

Demander en langage clair : « Tu démarres un nouveau prototype, ou tu reprends un proto en
cours ? » Proposer les reprises **par objectif / écran, jamais par nom de branche** : croiser les
fiches de `details/prototypes/` avec `git branch --list 'proto/*'`.

- **Nouveau** → capter l'objectif en une ligne : « Quel écran ou quelle fonctionnalité veux-tu
  prototyper ? »
- **Reprise** → l'objectif et l'ancrage sont déjà dans la fiche.

Ne jamais parler de branches ni de git au PM.

## Phase 2 — Bootstrap (invisible pour le PM)

**Nouveau :** partir de `main` à jour, puis créer `proto/<slug>` (slug court dérivé de
l'objectif). Si `main` est en retard sur `upstream/main`, ne pas le mettre à jour soi-même — le
workflow quotidien s'en charge ; brancher depuis `main` tel quel et le signaler en une ligne.
Si l'arbre est sale, S'ARRÊTER et le dire en langage clair.

**Reprise :** checkout de la branche existante. La rafraîchir seulement si son dernier commit a
plus d'une journée, par un rebase sur `main`. Sur conflit : S'ARRÊTER et le dire — un proto
jetable ne vaut pas un rebase pénible.

Pas de ticket, pas de `flow`.

## Phase 3 — Ancrage

Lancer l'aperçu (`preview_start` avec `name: "archie"`, déclaré dans `.claude/launch.json`) et
laisser le PM naviguer jusqu'à l'écran cible et pointer la zone. Pas de MFE à identifier : il n'y
a qu'un seul app. Mapper la zone vers le code via la route (hash router, `src/router.js`) → le
module d'écran correspondant dans `src/screens/`, puis **confirmer avant d'éditer** : « J'ajoute
ça sur l'écran <X>, sous <Y>. C'est bien ça ? »

Si le mapping n'est pas certain, demander au PM de pointer plus précisément — ne jamais deviner.

**Reprise :** l'ancrage est connu, passer directement à la boucle 4↔5.

## Phase 4 — Construire (TOUJOURS via le design system)

**Le design system est la source de vérité.** Toute UI passe par `design-guidelines` en
**`mode: html-prototype`** — classes `.ap-*` CSS-UI + tokens, zéro build. C'est le mode par
défaut du skill, et exactement le modèle de ce repo.

⚠️ **Les règles DS sont inversées par rapport à platform** : ici ce sont les **classes** `.ap-*`
qui marchent et les composants Angular `<ap-*>` qui n'existent pas. Détails et conventions de
code dans `references/archie-mechanics.md` — le lire avant d'écrire.

Le workflow DS de `CLAUDE.md` est contraignant, dans cet ordre :

1. `list_components` / `get_component <name>` sur le MCP `ds-css` **avant** d'écrire du CSS.
2. `search_tokens` / `recommend_token` pour toute valeur — jamais de px ni de hex en dur.
3. `search_icons` pour les icônes.
4. `validate_css` avant de commiter.

Chaque ajustement de la boucle 4↔5 (« mets-le en bleu », « raccourcis le bandeau ») repasse par
là — jamais de retouche ad hoc.

## Phase 5 — Voir (la boucle rapide)

`preview_start` (`name: "archie"`) puis naviguer sur la route concernée. Pas de build : la
modification est visible au rechargement. Laisser le PM réagir en langage clair, puis retour en
phase 4. C'est le chemin de feedback principal.

## Phase 6 — Partager (optionnel)

Pousser la branche sur `origin` (le fork `jean-loup-marquis/rebel-racoon`). Pas de spot env ici —
pas de label `release-sc-*`, ce mécanisme est propre à platform. Pour un lien cliquable, GitHub
Pages sur la branche est l'option (précédent : un `.nojekyll` dans un build de proto antérieur).

## Phase 7 — Finir

1. Vérifier qu'on est bien sur une branche `proto/*`. Sinon, S'ARRÊTER.
2. **Porte DS** : `validate_css` sur tout le CSS touché. Corriger les violations nettes ; noter
   le reste dans la note de hand-off plutôt que de bloquer.
3. Commiter, pousser, ouvrir une PR **draft** : `gh pr create --draft`. Jamais ready-for-review.
4. Note de hand-off en commentaire de PR (`gh pr comment`) : ce qui a été construit, l'écran
   ancré, et explicitement « spec visuelle jetable, pas du code de production — un dev la
   réimplémente proprement ».

## Phase 8 — Capitaliser (mémoire)

Mettre à jour `$CLAUDE_PROJECTS_DIR/proto/`, en français : la fiche
`details/prototypes/<slug>.md`, les apprentissages dans `details/learnings.md` (ce qui a marché /
échoué), et une entrée dans `CHANGELOG.md`. Capitaliser au fil de la session, pas seulement à la
fin. Ne rien écrire de tout ça dans le repo.

## Limites

- Produit une spec jetable, jamais du code de production.
- Aucune suite de tests dans ce repo : la vérification passe par l'app qui tourne et par
  `validate_css`.
- Les données sont mockées (`src/mocks.js`) — un prototype ne prouve rien sur le comportement réel.
