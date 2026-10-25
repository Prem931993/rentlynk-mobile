import React from "react";
import { View } from "react-native";
import { Button, EmptyState, SkeletonList, Skeleton } from "./ui";

export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <View>
    <EmptyState icon="cloud-offline-outline" title="Couldn't load this" message={message} />
    {onRetry && <Button title="Try again" icon="refresh" variant="secondary" onPress={onRetry} />}
  </View>
);

/** Renders skeleton → error → children depending on load state. */
export const Loadable = ({ loading, error, onRetry, children, skeleton = "list" }: {
  loading: boolean; error?: string | null; onRetry?: () => void; children: React.ReactNode; skeleton?: "list" | "detail";
}) => {
  if (loading) {
    return skeleton === "detail" ? (
      <View style={{ gap: 14 }}>
        <Skeleton height={150} radius={24} />
        <Skeleton height={20} width="50%" />
        <Skeleton height={90} radius={20} />
        <Skeleton height={90} radius={20} />
      </View>
    ) : <SkeletonList rows={5} />;
  }
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  return <>{children}</>;
};
