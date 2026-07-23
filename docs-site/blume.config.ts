import { defineConfig } from "blume";

export default defineConfig({
  title: "~/.claude Reference",
  description: "A guided tour of the thin-harness, fat-skills Claude Code setup.",
  content: {
    root: "content",
  },
  navigation: {
    tabs: [
      { label: "Overview", path: "/overview" },
      { label: "Architecture", path: "/architecture" },
      { label: "Skills", path: "/skills" },
      { label: "OpenWolf", path: "/openwolf" },
    ],
  },
  theme: {
    accent: "teal",
    radius: "md",
    mode: "system",
  },
});
