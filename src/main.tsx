import { createRoot } from "react-dom/client";
import "@fontsource-variable/newsreader";
import "@fontsource/ibm-plex-sans-condensed/400.css";
import "@fontsource/ibm-plex-sans-condensed/600.css";
import "@fontsource-variable/jura";
import "@fontsource/spectral/400.css";
import "./styles/base.css";
import { App } from "./App";
import { applyMotionLevel, motion } from "./motion";

applyMotionLevel(motion.level);

createRoot(document.getElementById("root")!).render(<App />);
