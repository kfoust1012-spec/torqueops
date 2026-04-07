import { LoadingState } from "../components/ui";

export default function AppLoading() {
  return (
    <main className="page-shell">
      <LoadingState
        className="ui-route-state"
        description="Loading the latest service threads and opening the operating shell."
        title="Opening desk"
      />
    </main>
  );
}
