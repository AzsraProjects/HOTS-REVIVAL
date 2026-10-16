// Traductions anglaises de l'interface, indexées par le texte français d'origine (voir ../i18n.tsx).
// Un fichier par zone pour pouvoir traduire en parallèle sans conflit.
import { EN_COMPONENTS } from "./components";
import { EN_PAGES } from "./pages";

export const EN: Record<string, string> = { ...EN_COMPONENTS, ...EN_PAGES };
