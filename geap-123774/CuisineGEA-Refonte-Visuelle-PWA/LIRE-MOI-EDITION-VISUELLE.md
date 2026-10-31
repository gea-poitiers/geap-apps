# Cuisine GEA — Édition visuelle (prototype)

## Principe

Cette version conserve le moteur de données GEAP, les tables, les recettes, les relations, les filtres globaux, les formulaires, les actions et le suivi des recettes réalisées de l'export existant.
Elle ajoute une **couche visuelle propre à Cuisine GEA**, dans `cuisine-design.js` et `cuisine-style.css`, et cinq créations graphiques locales dans `assets/`.

## Direction artistique

- Ambiance : carnet de cuisine contemporain, chaleureux et éditorial, ni interface administrative ni vitrine commerciale.
- Couleurs : vert sapin `#284B3D`, terre cuite `#C16A45`, ivoire `#FBF8F3`, or doux `#D8B27A` et texte `#273B31`.
- Typographie : titres en Georgia (serif, éditorial) et textes en polices système (lisibilité et fonctionnement hors ligne).
- Images : scènes culinaires douces et cohérentes, sans téléchargement externe.

## Parcours revisités

1. **Accueil** : grand bandeau photographique, introduction, trois portes d'entrée (recettes, catégories, ingrédients) et encart « Ajouter une recette ».
2. **Listes** : titres hiérarchisés, bandeau illustré, cartes photo, badges de durée et « Réalisée » lorsqu'une recette a été faite.
3. **Fiche recette** : photographie avant les informations pratiques, durée en vignettes et composants plus aérés. Les actions GEAP restent reliées au même moteur.
4. **Formulaires** : visuel discret et champs regroupés dans des surfaces lisibles.
5. **Navigation** : barre basse sur smartphone, barre horizontale près du haut sur ordinateur ; visuels et tap targets adaptés aux écrans tactiles.

## Mise en service

- Pour tester : extraire *tout* le ZIP puis ouvrir `index.html`, en conservant les fichiers `css`, `js` et le dossier `assets` au même niveau.
- Pour publier : copier le contenu du dossier extrait dans le sous-dossier publié de Cuisine GEA, faire un commit puis un push avec GitHub Desktop.
- Ne pas copier uniquement `index.html` : les images et les feuilles de style sont externes.
- Le service worker inclut les nouveaux fichiers afin de permettre l'utilisation hors ligne **après la première visite en HTTPS et la mise en cache**.
- Sur une PWA déjà installée, une ancienne version peut rester visible jusqu'à l'activation de la nouvelle version ou une réouverture de l'application.

## Compatibilité et limites

- La logique des données et les flux GEAP n'ont pas été modifiés.
- Le thème de couleur est aussi réglé dans `project.geap.json` ; les changements visuels fins dépendent en revanche des fichiers `cuisine-style.css` et `cuisine-design.js` spécifiques à cette PWA. **Réimporter `project.geap.json` dans l'éditeur GEAP ne suffira donc pas à reproduire ce rendu.**
- Cette livraison est un prototype visuel. Les fichiers JavaScript ont été validés statiquement et les dépendances hors ligne vérifiées ; des essais fonctionnels complets sur Windows/iPhone/Android restent nécessaires avant publication auprès des étudiants.
- Les illustrations ont été créées pour ce prototype et sont livrées séparément.

## Images

| Image | Usage |
|---|---|
| `assets/accueil.jpg` | Bandeau de bienvenue |
| `assets/liste.jpg` | En-tête discret des listes |
| `assets/formulaire.jpg` | En-tête des formulaires |
| `assets/recette.jpg` | Encart éditorial de l'accueil |
| `assets/icone.png` | Identité visuelle et icône |

© Prototype pédagogique Cuisine GEA. Les contenus et les projets réalisés restent soumis à leurs droits respectifs.
