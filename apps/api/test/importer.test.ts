import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseFablePageHtml, parseIndexHtml } from "../src/services/importer";

const fixturesDir = path.join(process.cwd(), "test", "fixtures");

describe("importer", () => {
  it("extrait les liens utiles depuis l’index Wikisource", () => {
    const html = fs.readFileSync(path.join(fixturesDir, "index.html"), "utf8");
    const entries = parseIndexHtml(html, "https://fr.wikisource.org/wiki/Fables_de_La_Fontaine_(%C3%A9d._1874)");

    expect(entries).toHaveLength(2);
    expect(entries[0]?.title).toBe("La Cigale et la Fourmi");
    expect(entries[1]?.slug).toContain("le-corbeau-et-le-renard");
  });

  it("extrait les entrées depuis une structure livre suivie d’une liste ordonnée", () => {
    const html = `
      <!doctype html>
      <html lang="fr">
        <body>
          <div class="mw-parser-output">
            <div style="text-align:center;clear:both;">LIVRE I</div>
            <ol>
              <li><a href="/wiki/Fables_de_La_Fontaine_(%C3%A9d._1874)/La_Cigale_et_la_Fourmi">La Cigale et la Fourmi</a></li>
              <li><a href="/wiki/Fables_de_La_Fontaine_(%C3%A9d._1874)/Le_Corbeau_et_le_Renard">Le Corbeau et le Renard</a></li>
            </ol>
            <div style="text-align:center;clear:both;">TABLE ALPHABÉTIQUE</div>
          </div>
        </body>
      </html>
    `;

    const entries = parseIndexHtml(html, "https://fr.wikisource.org/wiki/Fables_de_La_Fontaine_(%C3%A9d._1874)");

    expect(entries).toHaveLength(2);
    expect(entries[0]?.itemNumber).toBe(1);
    expect(entries[1]?.title).toBe("Le Corbeau et le Renard");
  });

  it("descend dans le wrapper prp-pages-output utilisé par Wikisource", () => {
    const html = `
      <!doctype html>
      <html lang="fr">
        <body>
          <div id="mw-content-text">
            <div class="mw-parser-output">
              <div class="prp-pages-output">
                <div style="text-align:center;clear:both;">LIVRE I</div>
                <ol>
                  <li><a href="/wiki/Fables_de_La_Fontaine_(%C3%A9d._1874)/La_Cigale_et_la_Fourmi">La Cigale et la Fourmi</a></li>
                </ol>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const entries = parseIndexHtml(html, "https://fr.wikisource.org/wiki/Fables_de_La_Fontaine_(%C3%A9d._1874)");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.slug).toBe("livre-01-01-la-cigale-et-la-fourmi");
  });

  it("nettoie une page de fable et produit des unités d’apprentissage", () => {
    const html = fs.readFileSync(path.join(fixturesDir, "fable.html"), "utf8");
    const parsed = parseFablePageHtml(html, {
      title: "La Cigale et la Fourmi",
      bookNumber: 1,
      bookLabel: "Livre 1",
      itemNumber: 1,
      url: "https://fr.wikisource.org/wiki/Fables_de_La_Fontaine_(%C3%A9d._1874)/La_Cigale_et_la_Fourmi",
      slug: "livre-01-01-la-cigale-et-la-fourmi"
    });

    expect(parsed.verseCount).toBe(8);
    expect(parsed.text).toContain("La Cigale, ayant chanté");
    expect(parsed.text).not.toContain("Récupérée de");
    expect(parsed.units).toHaveLength(2);
  });

  it("retire le titre répété en première ligne du poème (cas réel Wikisource)", () => {
    // Sur les vraies pages, le titre (souvent en capitales) apparaît comme première ligne
    // du bloc de poème et n'est pas un bloc autonome → l'ancien découpage le gardait,
    // créant une unité d'apprentissage dégénérée égale au titre.
    const html = `
      <!doctype html>
      <html lang="fr">
        <body>
          <div id="mw-content-text">
            <div class="mw-parser-output">
              <div class="prp-pages-output">
                <div class="poem verse">
                  <p>
                    LE CORBEAU ET LE RENARD<br />
                    <br />
                    Maître corbeau, sur un arbre perché,<br />
                    Tenait en son bec un fromage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const parsed = parseFablePageHtml(html, {
      title: "Le Corbeau et le Renard",
      bookNumber: 1,
      bookLabel: "Livre 1",
      itemNumber: 2,
      url: "https://fr.wikisource.org/wiki/x",
      slug: "livre-01-02-le-corbeau-et-le-renard"
    });

    expect(parsed.text.startsWith("Maître corbeau")).toBe(true);
    expect(parsed.text).not.toContain("LE CORBEAU ET LE RENARD");
    expect(parsed.verseCount).toBe(2);
    // La première unité ne doit jamais être le titre seul.
    expect(parsed.units[0]?.text).not.toContain("CORBEAU ET LE RENARD");
  });

  it("supprime les en-têtes éditoriaux et métadonnées Wikisource des pages réelles", () => {
    const html = `
      <!doctype html>
      <html lang="fr">
        <body>
          <div id="mw-content-text">
            <div class="mw-parser-output">
              <div class="prp-pages-output" lang="fr">
                <p><small class="ws-noexport">Pour les autres éditions de ce texte, voir Le Bûcheron et Mercure.</small></p>
                <div itemscope>
                  <div id="headertemplate" class="ws-noexport">
                    Jean de La Fontaine Livre V Fables, Bernardin-Béchet, Libraire-Éditeur, 1874 (p. 152-154).
                  </div>
                  <div id="subheader" class="ws-noexport">
                    ◄ L'Alouette et ses petits, avec le Maître d'un champ
                    Le Pot de terre et le Pot de fer ►
                  </div>
                  <div id="ws-data" class="ws-noexport">
                    collection Livre V Jean de La Fontaine Bernardin-Béchet, Libraire-Éditeur
                    1874 Paris V Livre V La Fontaine - Fables, Bernardin-Bechet, 1874.djvu
                    La Fontaine - Fables, Bernardin-Bechet, 1874.djvu/1 152-154
                  </div>
                </div>
                <div class="poem verse">
                  <p>
                    Le Bûcheron trouva son trésor dans l'onde.<br />
                    Mercure l'éprouva, puis lui rendit son bien.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const parsed = parseFablePageHtml(html, {
      title: "Le Bûcheron et Mercure",
      bookNumber: 5,
      bookLabel: "Livre 5",
      itemNumber: 1,
      url: "https://fr.wikisource.org/wiki/Fables_de_La_Fontaine_(%C3%A9d._1874)/Le_B%C3%BBcheron_et_Mercure",
      slug: "livre-05-01-le-bucheron-et-mercure"
    });

    expect(parsed.text).toContain("Le Bûcheron trouva son trésor dans l'onde.");
    expect(parsed.text).not.toContain("Pour les autres éditions");
    expect(parsed.text).not.toContain("Jean de La Fontaine");
    expect(parsed.text).not.toContain("Le Pot de terre et le Pot de fer");
    expect(parsed.text).not.toContain("La Fontaine - Fables, Bernardin-Bechet, 1874.djvu");
  });
});
