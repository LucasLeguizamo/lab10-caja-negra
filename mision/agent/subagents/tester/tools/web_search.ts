import { disableTool } from "eve/tools";

// Regla 3: ningún request al original fuera de probe.py. web_* corre fuera del sandbox y saltaría el firewall.
export default disableTool();
