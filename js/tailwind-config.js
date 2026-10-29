/* Shared Tailwind theme. Loaded right after cdn.tailwindcss.com on every page. */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        "surface": "#fcf9f8",
        "surface-container-lowest": "#ffffff",
        "on-primary-fixed": "#1c1b1b",
        "surface-container": "#f0eded",
        "surface-variant": "#e5e2e1",
        "outline-variant": "#c4c7c7",
        "inverse-primary": "#c8c6c5",
        "outline": "#747878",
        "on-secondary-container": "#705100",
        "secondary": "#7a5900",
        "on-tertiary": "#ffffff",
        "surface-dim": "#dcd9d9",
        "surface-tint": "#5f5e5e",
        "secondary-fixed": "#ffdea2",
        "on-error-container": "#93000a",
        "on-background": "#1c1b1b",
        "on-surface-variant": "#444748",
        "primary": "#000000",
        "secondary-container": "#fdc340",
        "background": "#fcf9f8",
        "on-tertiary-container": "#8d8462",
        "on-secondary": "#ffffff",
        "surface-container-low": "#f6f3f2",
        "surface-bright": "#fcf9f8",
        "tertiary": "#000000",
        "inverse-on-surface": "#f3f0ef",
        "on-tertiary-fixed": "#211b04",
        "on-primary": "#ffffff",
        "on-secondary-fixed": "#261900",
        "tertiary-fixed-dim": "#d1c6a1",
        "secondary-fixed-dim": "#f7bd3b",
        "on-secondary-fixed-variant": "#5c4200",
        "primary-fixed-dim": "#c8c6c5",
        "primary-fixed": "#e5e2e1",
        "on-primary-fixed-variant": "#474646",
        "on-tertiary-fixed-variant": "#4e472a",
        "inverse-surface": "#313030",
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "tertiary-fixed": "#eee2bc",
        "primary-container": "#1c1b1b",
        "on-error": "#ffffff",
        "on-primary-container": "#858383",
        "on-surface": "#1c1b1b",
        "surface-container-high": "#eae7e7",
        "tertiary-container": "#211b04",
        "surface-container-highest": "#e5e2e1",
        "success": "#2e6b3f",
        "success-container": "#cdeed6",
        "warning": "#8a5300",
        "warning-container": "#ffe2b0"
      },
      "borderRadius": {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      "spacing": {
        "space-md": "1rem",
        "space-xl": "2rem",
        "gutter": "0.75rem",
        "space-sm": "0.5rem",
        "gutter-desktop": "1.5rem",
        "margin-desktop": "2rem",
        "space-lg": "1.5rem",
        "margin": "1rem",
        "space-xs": "0.25rem",
        /* Le header fait 64px + encoche iOS, la barre du bas 64px + trait
           d'accueil : sans ces jetons, le contenu passe sous l'un des deux
           sur iPhone. Les marges des vues doivent reprendre ces valeurs. */
        /* 4.125rem et non 4rem : le header contient aussi la barre de
           progression (#route-bar, 2px) qui reste en flux meme invisible.
           Sans ce cran, le contenu passe 2px dessous. */
        "header": "calc(4.125rem + env(safe-area-inset-top, 0px))",
        "nav": "calc(4rem + env(safe-area-inset-bottom, 0px) + 0.5rem)"
      },
      "fontFamily": {
        "body-sm": ["Plus Jakarta Sans"],
        "headline-sm": ["Plus Jakarta Sans"],
        "data-mono": ["Plus Jakarta Sans"],
        "label-md": ["Plus Jakarta Sans"],
        "display-lg": ["Playfair Display"],
        "label-lg": ["Plus Jakarta Sans"],
        "headline-md": ["Playfair Display"],
        "display-lg-mobile": ["Playfair Display"],
        "headline-lg-mobile": ["Playfair Display"],
        "body-md": ["Plus Jakarta Sans"],
        "body-lg": ["Plus Jakarta Sans"],
        "label-sm": ["Plus Jakarta Sans"],
        "headline-lg": ["Playfair Display"]
      },
      "fontSize": {
        "body-sm": ["12px", {"lineHeight": "18px", "fontWeight": "400"}],
        "headline-sm": ["18px", {"lineHeight": "24px", "fontWeight": "700"}],
        "data-mono": ["14px", {"lineHeight": "20px", "fontWeight": "600"}],
        "label-md": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "600"}],
        "display-lg": ["40px", {"lineHeight": "48px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "label-lg": ["14px", {"lineHeight": "20px", "letterSpacing": "0.01em", "fontWeight": "600"}],
        "headline-md": ["22px", {"lineHeight": "28px", "fontWeight": "600"}],
        "display-lg-mobile": ["30px", {"lineHeight": "38px", "letterSpacing": "-0.01em", "fontWeight": "700"}],
        "headline-lg-mobile": ["24px", {"lineHeight": "32px", "fontWeight": "600"}],
        "body-md": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
        "body-lg": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
        "label-sm": ["11px", {"lineHeight": "14px", "letterSpacing": "0.05em", "fontWeight": "700"}],
        "headline-lg": ["32px", {"lineHeight": "40px", "fontWeight": "600"}]
      }
    }
  }
};