"use client";

import { AdultVerifyClient } from "./ui";
import { Suspense } from "react";

export default function AdultVerifyPage() {
  return (
    <Suspense fallback={null}>
      <AdultVerifyClient />
    </Suspense>
  );
}
