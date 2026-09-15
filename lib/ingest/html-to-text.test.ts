import { describe, expect, it } from "vitest";
import { decodeEntities, htmlToText } from "./html-to-text";

describe("htmlToText", () => {
  it("handles Greenhouse's escaped HTML — entities first, then tags", () => {
    const greenhouse = "&lt;div&gt;&lt;h2&gt;About us&lt;/h2&gt;&lt;p&gt;We build &amp; ship.&lt;/p&gt;&lt;/div&gt;";
    expect(htmlToText(greenhouse)).toBe("About us\n\nWe build & ship.");
  });

  it("turns list items into bullets and blocks into line breaks", () => {
    const html = "<p>Requirements</p><ul><li>React</li><li>TypeScript</li></ul>";
    expect(htmlToText(html)).toBe("Requirements\n\n• React\n• TypeScript");
  });

  it("decodes numeric and named entities, including Greek", () => {
    expect(decodeEntities("&#913;&#952;&#942;&#957;&#945; &ndash; &#x3B1;")).toBe("Αθήνα – α");
    expect(decodeEntities("R&amp;D &nbsp;team")).toBe("R&D  team");
  });

  it("drops scripts and styles entirely", () => {
    expect(htmlToText("<style>p{}</style><p>Hi</p><script>x()</script>")).toBe("Hi");
  });

  it("leaves plain text alone", () => {
    expect(htmlToText("Just a sentence. Another one.")).toBe("Just a sentence. Another one.");
  });
});
