"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Firestore failures on these screens (a missing composite index, rules not
 * deployed) otherwise look identical to "nothing to show" — an empty list.
 * Surfacing the real message stops a setup problem from masquerading as an
 * empty clinic, and links straight to the index Firestore wants building.
 */
export function QueryError({ error }: { error: Error | null }) {
  if (!error) return null;

  const message = error.message ?? String(error);
  const indexUrl = message.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
  const needsIndex = message.includes("requires an index");
  const deniedPermission = message.includes("insufficient permissions");

  return (
    <div className="flex items-start gap-md rounded-xl border border-amber-300 bg-amber-50 p-lg text-amber-900">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="space-y-sm">
        <p className="font-bold">
          {needsIndex
            ? "This screen needs a database index that hasn't been built yet."
            : deniedPermission
              ? "The database rejected this request — security rules may not be deployed."
              : "Could not load data from the database."}
        </p>
        {needsIndex && (
          <p className="text-label-md">
            Run <code className="rounded bg-amber-100 px-1">npm run firebase:deploy-rules</code>, or
            create it directly:{" "}
            {indexUrl && (
              <a
                href={indexUrl}
                target="_blank"
                rel="noreferrer"
                className="font-bold underline"
              >
                create the index
              </a>
            )}
            . Indexes take a few minutes to finish building.
          </p>
        )}
        {deniedPermission && (
          <p className="text-label-md">
            Run <code className="rounded bg-amber-100 px-1">npm run firebase:deploy-rules</code> to
            publish <code className="rounded bg-amber-100 px-1">firestore.rules</code>.
          </p>
        )}
        <p className="font-mono text-xs break-all opacity-70">{message}</p>
      </div>
    </div>
  );
}
