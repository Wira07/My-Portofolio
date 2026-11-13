import fs from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

let cachedFonts: Array<{ name: string; data: Buffer; weight: 400 | 600; style: "normal" }> | null = null;

function loadFonts() {
  if (cachedFonts) return cachedFonts;
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  const interReg = fs.readFileSync(path.join(fontsDir, "inter-tight-latin-400-normal.woff"));
  const interSemi = fs.readFileSync(path.join(fontsDir, "inter-tight-latin-600-normal.woff"));
  const monoReg = fs.readFileSync(path.join(fontsDir, "jetbrains-mono-latin-400-normal.woff"));
  cachedFonts = [
    { name: "Inter Tight", data: interReg, weight: 400, style: "normal" },
    { name: "Inter Tight", data: interSemi, weight: 600, style: "normal" },
    { name: "JetBrains Mono", data: monoReg, weight: 400, style: "normal" }
  ];
  return cachedFonts;
}

export async function renderOgPng(opts: {
  eyebrow: string;
  title: string;
  subtitle: string;
  tag?: string;
}): Promise<Buffer> {
  const fonts = loadFonts();
  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0A0B0D",
          color: "#ECEAE4",
          padding: "56px 64px",
          fontFamily: "Inter Tight",
          border: "1px solid #23272F"
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #23272F",
                paddingBottom: "24px"
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      fontFamily: "JetBrains Mono",
                      fontSize: "22px",
                      color: "#9A9DA5"
                    },
                    children: [
                      {
                        type: "span",
                        props: {
                          style: {
                            width: "12px",
                            height: "12px",
                            borderRadius: "99px",
                            backgroundColor: "#C8FF3D"
                          }
                        }
                      },
                      opts.eyebrow
                    ]
                  }
                },
                {
                  type: "span",
                  props: {
                    style: {
                      fontFamily: "JetBrains Mono",
                      fontSize: "20px",
                      color: "#C8FF3D"
                    },
                    children: opts.tag || "WIRA.STUDIO"
                  }
                }
              ]
            }
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                marginTop: "24px",
                marginBottom: "24px"
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "64px",
                      fontWeight: 600,
                      lineHeight: 1.08,
                      letterSpacing: "-0.02em",
                      color: "#ECEAE4"
                    },
                    children: opts.title
                  }
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "26px",
                      lineHeight: 1.4,
                      color: "#9A9DA5"
                    },
                    children: opts.subtitle
                  }
                }
              ]
            }
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #23272F",
                paddingTop: "22px",
                fontFamily: "JetBrains Mono",
                fontSize: "19px",
                color: "#9A9DA5"
              },
              children: [
                "Wira Sukma Saputra · Independent Software & Product Studio",
                "wira.studio"
              ]
            }
          }
        ]
      }
    } as never,
    {
      width: 1200,
      height: 630,
      fonts
    }
  );

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return resvg.render().asPng();
}

