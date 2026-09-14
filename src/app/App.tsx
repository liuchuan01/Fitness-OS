import { ThemeProvider } from "../design/theme";
import { useEffect, useState } from "react";
import { AutomationSettings } from "../features/automation/AutomationSettings";
import { Dashboard } from "./Dashboard";

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const [settingsPage, setSettingsPage] = useState(() => window.location.hash === "#/settings");
  useEffect(() => {
    const navigate = () => setSettingsPage(window.location.hash === "#/settings");
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  if (settingsPage)
    return (
      <AutomationSettings
        onClose={() => {
          window.location.hash = "/";
        }}
      />
    );
  return <Dashboard />;
}
