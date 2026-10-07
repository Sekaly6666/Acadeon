import { Router, type IRouter } from "express";
import { ListGuidesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const guides = [
  {
    id: "guide-problematique",
    title: "Construire une problématique claire",
    category: "Méthodologie",
    summary: "Passer d’un thème général à une question de recherche précise.",
    content:
      "Une problématique relie un contexte à un problème identifiable et à une question de recherche. Délimite la population, le lieu et la période quand ils comptent. Vérifie que la question peut être étudiée avec les moyens disponibles. Cette démarche est générique : suis les consignes validées par ton établissement lorsqu’elles existent.",
    level: "Débutant",
  },
  {
    id: "guide-objectifs",
    title: "Rédiger des objectifs observables",
    category: "Mémoire",
    summary: "Relier chaque objectif à la question centrale du travail.",
    content:
      "L’objectif général exprime le résultat global recherché. Les objectifs spécifiques décrivent des actions ou résultats vérifiables qui y contribuent. Utilise des verbes précis et assure-toi que chaque objectif correspond à une partie de ta méthode.",
    level: "Intermédiaire",
  },
  {
    id: "guide-plan",
    title: "Organiser un plan de recherche",
    category: "Plan",
    summary: "Faire progresser le lecteur du contexte aux résultats.",
    content:
      "Un plan doit répondre à la question de recherche et suivre une progression logique. Pour chaque partie, indique son rôle, les idées à démontrer et les éléments qui la relient à la partie suivante. Les structures varient selon les disciplines et les consignes de l’établissement.",
    level: "Intermédiaire",
  },
  {
    id: "guide-sources",
    title: "Gérer ses sources avec rigueur",
    category: "Recherche documentaire",
    summary: "Consigner les références dès la lecture et vérifier chaque citation.",
    content:
      "Note immédiatement le titre, l’auteur, l’année, l’éditeur ou le lien et la page utile. Vérifie les métadonnées sur la source originale avant de citer. Acadéon ne certifie pas les références et ne remplace pas la norme bibliographique demandée par ton établissement.",
    level: "Tous niveaux",
  },
  {
    id: "guide-soutenance",
    title: "Préparer une soutenance sereine",
    category: "Soutenance",
    summary: "Structurer un exposé oral et s’entraîner aux questions.",
    content:
      "Présente le contexte, la question, la méthode, les résultats et les limites dans un temps maîtrisé. Répète à voix haute, chronomètre-toi et prépare une réponse argumentée sur les choix méthodologiques. Si tu ne connais pas une réponse, explique honnêtement ce que tu sais et ce qui reste à vérifier.",
    level: "Tous niveaux",
  },
];

router.get("/guides", (_req, res): void => {
  res.json(ListGuidesResponse.parse(guides));
});

export default router;
