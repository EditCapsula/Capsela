import { describe, expect, it } from "vitest";
import { accordAPlusieursCouleurs, estFranche, formeUnAccord } from "../accordsCouleurs";

/** Les principes de A Dictionary of Color Combinations (12/11/2026, accordsCouleurs.ts). */
const c = (color: string, hex: string) => ({ color, hex });
const VIEUX_ROSE = c("Vieux rose", "#C9A0A0");
const OLIVE = c("Olive", "#6B6A3A");
const OCRE = c("Ocre", "#C49A45");
const ROUGE = c("Rouge", "#C8102E");
const BLEU_ROI = c("Bleu roi", "#1F4BD8");
const CREME = c("Crème", "#F3EBDD");
const NOIR = c("Noir", "#1D1A16");

describe("accords à la Wada", () => {
  it("distingue une couleur franche d'un ton rompu ; un neutre n'est jamais franc", () => {
    expect(estFranche(ROUGE)).toBe(true);
    expect(estFranche(VIEUX_ROSE)).toBe(false);
    expect(estFranche(OLIVE)).toBe(false);
    expect(estFranche(NOIR)).toBe(false);
  });

  it("accepte des tons rompus qui ne sont ni voisins ni opposés sur le cercle, avec un écart de clarté", () => {
    expect(formeUnAccord([VIEUX_ROSE, OLIVE])).toBe(true);
    expect(formeUnAccord([VIEUX_ROSE, OLIVE, CREME])).toBe(true);
    expect(accordAPlusieursCouleurs([VIEUX_ROSE, OLIVE])).toBe(true);
  });

  it("au plus une couleur franche, en accent", () => {
    expect(formeUnAccord([OLIVE, ROUGE, CREME])).toBe(true);
    expect(formeUnAccord([ROUGE, BLEU_ROI, CREME])).toBe(false);
  });

  it("refuse un ensemble sans écart de clarté", () => {
    expect(formeUnAccord([VIEUX_ROSE, OCRE])).toBe(false);
  });

  it("jamais plus de trois couleurs non neutres, jamais une couleur inconnue, jamais un tout-neutre", () => {
    expect(formeUnAccord([VIEUX_ROSE, OLIVE, OCRE, c("Lilas", "#B9A6C9"), NOIR])).toBe(false);
    expect(formeUnAccord([VIEUX_ROSE, c("Inconnue", "#DCCFBC"), NOIR])).toBe(false);
    expect(formeUnAccord([CREME, NOIR])).toBe(false);
    expect(accordAPlusieursCouleurs([OLIVE, CREME])).toBe(false);
  });
});
