/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        midnight: "#080b14",
        panel: "#101626",
        primary: {
          DEFAULT: "#7167ff",
          dark: "#5146e5",
          light: "#a89fff"
        },
        accent: {
          DEFAULT: "#35d9f2",
          dark: "#00aeca"
        }
      },
      boxShadow: {
        glow: "0 0 36px rgb(113 103 255 / 25%)"
      },
      backgroundImage: {
        "hero-glow": "radial-gradient(ellipse at 75% 15%, rgb(81 70 229 / 18%), transparent 48%)"
      }
    }
  },
  plugins: []
};
