import { Card, CardContent, Page, Skeleton, SkeletonPanel, SkeletonText } from "../../components/ui";

export default function DashboardLoading() {
  return (
    <Page className="ui-loading-page ui-loading-page--dashboard">
      <section className="ui-card ui-loading-shell__hero">
        <div className="ui-loading-shell__hero-main">
          <div className="ui-loading-shell__copy">
            <Skeleton className="ui-skeleton--chip" width="8rem" />
            <Skeleton className="ui-skeleton--headline" width="38%" />
            <SkeletonText lines={2} widths={["72%", "54%"]} />
          </div>

          <div className="ui-loading-shell__actions">
            <Skeleton className="ui-skeleton--button" width="9rem" />
            <Skeleton className="ui-skeleton--button" width="7.5rem" />
          </div>
        </div>

        <div className="ui-loading-shell__metrics">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="ui-loading-shell__metric" key={`metric-${index}`}>
              <Skeleton className="ui-skeleton--chip" width="6rem" />
              <Skeleton className="ui-skeleton--metric" width="4.5rem" />
              <SkeletonText lines={2} widths={["88%", "70%"]} />
            </div>
          ))}
        </div>
      </section>

      <div className="ui-loading-shell__grid">
        <Card className="ui-loading-shell__panel ui-loading-shell__panel--wide">
          <CardContent>
            <SkeletonPanel rows={4} />
          </CardContent>
        </Card>

        <Card className="ui-loading-shell__panel">
          <CardContent>
            <SkeletonPanel rows={3} />
          </CardContent>
        </Card>

        <Card className="ui-loading-shell__panel">
          <CardContent>
            <SkeletonPanel rows={3} />
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
