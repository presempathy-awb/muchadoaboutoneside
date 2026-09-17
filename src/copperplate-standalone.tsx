import { createRoot } from "react-dom/client";
import { CopperplateMaker } from "./components/calligraphy/copperplate-maker";

const root = document.getElementById("root");
if (root) createRoot(root).render(<CopperplateMaker />);
